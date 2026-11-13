import { Router } from "express";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { supabase } from "../lib/supabase.js";
import {
  isAdminEmailConfigured,
  sendUserEmailVerificationCode,
  sendUserPasswordResetCode,
} from "../lib/admin-email.js";
import { requireAdmin, requireSuperAdmin } from "../middlewares/admin-auth.js";
import { requireUser } from "../middlewares/user-auth.js";

const router = Router();
const COL = "users";
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_DELAY_MS = 60 * 1000;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_SEARCH_LIMIT = 10;

async function createUserSession(email: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("user_sessions").insert({
    token_hash: tokenHash,
    user_email: email,
    expires_at: new Date(Date.now() + USER_SESSION_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function authenticatedUser(user: { email: string; username: string; name: string; picture?: string | null }) {
  return { ...publicUser(user), sessionToken: await createUserSession(user.email) };
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function hashResetCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function sendEmailVerificationCode(email: string) {
  const { data: user, error: lookupError } = await supabase
    .from(COL)
    .select("email_verified_at, email_verification_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!user || user.email_verified_at) return { sent: true };

  if (user.email_verification_sent_at) {
    const remaining = EMAIL_VERIFICATION_RESEND_DELAY_MS -
      (Date.now() - new Date(user.email_verification_sent_at).getTime());
    if (remaining > 0) {
      return { sent: false, retryAfterSeconds: Math.ceil(remaining / 1000) };
    }
  }

  const code = String(randomInt(100000, 1000000));
  const codeHash = hashResetCode(code);
  const { error: updateError } = await supabase
    .from(COL)
    .update({
      email_verification_code_hash: codeHash,
      email_verification_expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
      email_verification_sent_at: new Date().toISOString(),
      email_verification_attempts: 0,
    })
    .eq("email", email)
    .is("email_verified_at", null);
  if (updateError) throw updateError;

  const sent = await sendUserEmailVerificationCode(email, code);
  if (!sent) {
    const { error: clearError } = await supabase
      .from(COL)
      .update({
        email_verification_code_hash: null,
        email_verification_expires_at: null,
        email_verification_sent_at: null,
        email_verification_attempts: 0,
      })
      .eq("email", email)
      .eq("email_verification_code_hash", codeHash);
    if (clearError) throw clearError;
  }
  return { sent };
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

function publicUser(user: { email: string; username: string; name: string; picture?: string | null }) {
  return { id: user.email, email: user.email, username: user.username, name: user.name, picture: user.picture ?? undefined };
}

type GoogleProfile = {
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
};

async function getVerifiedGoogleProfile(accessToken: unknown) {
  if (typeof accessToken !== "string" || !accessToken) return null;

  const response = await fetch("https://www.googleapis.com/userinfo/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const profile = await response.json() as GoogleProfile;
  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!email.endsWith("@gmail.com") || profile.verified_email !== true) return null;

  return { email, name: profile.name?.trim() || email.split("@")[0], picture: profile.picture };
}

router.post("/users/password/register", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!validEmail(email) || !/^[a-zA-Z0-9_]{3,30}$/.test(username) || !validPassword(password)) {
    res.status(400).json({ error: "Enter a valid email, a 3-30 character username, and a password of at least 8 characters." });
    return;
  }
  if (!isAdminEmailConfigured()) {
    res.status(503).json({ error: "Email verification is unavailable. Please contact the campus administrator." });
    return;
  }

  try {
    const { data: existingEmail, error: emailLookupError } = await supabase
      .from(COL)
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (emailLookupError) throw emailLookupError;
    if (existingEmail) {
      res.status(409).json({ error: "That email is already registered. Sign in or continue with Google." });
      return;
    }

    const salt = randomBytes(16).toString("hex");
    const { data, error } = await supabase
      .from(COL)
      .insert({ email, username, name: username, password_hash: hashPassword(password, salt), password_salt: salt })
      .select("email, username, name, picture")
      .single();
    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "That email or username is already registered." });
        return;
      }
      throw error;
    }
    const verification = await sendEmailVerificationCode(data.email);
    if (!verification.sent) {
      res.status(503).json({ error: "Your account was created, but the verification email could not be sent. Please try signing in to resend the code." });
      return;
    }
    res.status(201).json({ verificationRequired: true, email: data.email });
  } catch (err) {
    req.log.error({ err }, "Failed to register user with email and password");
    res.status(500).json({ error: "Could not create your account." });
  }
});

router.post("/users/password/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!validEmail(email) || !password) {
    res.status(400).json({ error: "Enter your email and password." });
    return;
  }

  try {
    const { data: account, error } = await supabase
      .from(COL)
      .select("email, username, name, picture, password_hash, password_salt, email_verified_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!account?.password_hash || !account.password_salt) {
      res.status(401).json({ error: "Email or password is incorrect. You can also continue with Google." });
      return;
    }

    const expected = Buffer.from(account.password_hash, "hex");
    const actual = Buffer.from(hashPassword(password, account.password_salt), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    if (!account.email_verified_at) {
      if (!isAdminEmailConfigured()) {
        res.status(503).json({ error: "Email verification is unavailable. Please contact the campus administrator." });
        return;
      }
      const verification = await sendEmailVerificationCode(email);
      if (!verification.sent && !verification.retryAfterSeconds) {
        res.status(503).json({ error: "Could not send a verification email. Please try again." });
        return;
      }
      res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        error: "Please verify your email before signing in. Check your inbox for the 6-digit code.",
      });
      return;
    }

    const { error: updateError } = await supabase
      .from(COL)
      .update({ last_login_at: new Date().toISOString() })
      .eq("email", email);
    if (updateError) throw updateError;
    res.json(await authenticatedUser(account));
  } catch (err) {
    req.log.error({ err }, "Failed to sign in user with email and password");
    res.status(500).json({ error: "Could not sign in. Please try again." });
  }
});

router.post("/users/password/verify-email", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter a valid email address and 6-digit verification code." });
    return;
  }

  try {
    const { data: account, error: lookupError } = await supabase
      .from(COL)
      .select("email, username, name, picture, password_salt, email_verified_at, email_verification_code_hash, email_verification_expires_at, email_verification_attempts")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!account?.password_salt || account.email_verified_at || !account.email_verification_code_hash) {
      res.status(400).json({ error: "That verification code is invalid or expired. Request a new code and try again." });
      return;
    }

    const codeHash = hashResetCode(code);
    const expected = Buffer.from(account.email_verification_code_hash, "hex");
    const actual = Buffer.from(codeHash, "hex");
    const expired = !account.email_verification_expires_at ||
      new Date(account.email_verification_expires_at).getTime() < Date.now();
    if (expired || account.email_verification_attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      const { error: clearError } = await supabase
        .from(COL)
        .update({
          email_verification_code_hash: null,
          email_verification_expires_at: null,
          email_verification_attempts: 0,
        })
        .eq("email", email)
        .eq("email_verification_code_hash", account.email_verification_code_hash);
      if (clearError) throw clearError;
      res.status(400).json({ error: "That verification code has expired. Request a new code and try again." });
      return;
    }

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = account.email_verification_attempts + 1;
      const update = attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS
        ? {
            email_verification_code_hash: null,
            email_verification_expires_at: null,
            email_verification_attempts: 0,
          }
        : { email_verification_attempts: attempts };
      const { error: attemptError } = await supabase
        .from(COL)
        .update(update)
        .eq("email", email)
        .eq("email_verification_code_hash", account.email_verification_code_hash);
      if (attemptError) throw attemptError;
      res.status(400).json({
        error: attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS
          ? "Too many incorrect codes. Request a new verification code."
          : "That verification code is incorrect.",
      });
      return;
    }

    const { data: verifiedUser, error: verifyError } = await supabase
      .from(COL)
      .update({
        email_verified_at: new Date().toISOString(),
        email_verification_code_hash: null,
        email_verification_expires_at: null,
        email_verification_sent_at: null,
        email_verification_attempts: 0,
        last_login_at: new Date().toISOString(),
      })
      .eq("email", email)
      .eq("email_verification_code_hash", account.email_verification_code_hash)
      .is("email_verified_at", null)
      .select("email, username, name, picture")
      .maybeSingle();
    if (verifyError) throw verifyError;
    if (!verifiedUser) {
      res.status(400).json({ error: "That verification code is no longer valid. Request a new code." });
      return;
    }

    res.json(await authenticatedUser(verifiedUser));
  } catch (err) {
    req.log.error({ err }, "Failed to verify user email");
    res.status(500).json({ error: "Could not verify your email. Please try again." });
  }
});

router.post("/users/password/resend-verification", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!validEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (!isAdminEmailConfigured()) {
    res.status(503).json({ error: "Email verification is unavailable. Please contact the campus administrator." });
    return;
  }

  try {
    const verification = await sendEmailVerificationCode(email);
    if (!verification.sent && verification.retryAfterSeconds) {
      res.status(429).json({ error: `Please wait ${verification.retryAfterSeconds} seconds before requesting another code.` });
      return;
    }
    if (!verification.sent) {
      res.status(503).json({ error: "Could not send a verification email. Please try again." });
      return;
    }
    res.json({ message: "If the account needs verification, a code has been sent to its email address." });
  } catch (err) {
    req.log.error({ err }, "Failed to resend user email verification code");
    res.status(500).json({ error: "Could not send a verification code. Please try again." });
  }
});

router.post("/users/password/forgot", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!validEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (!isAdminEmailConfigured()) {
    res.status(503).json({ error: "Password reset email is unavailable. Please contact the campus administrator." });
    return;
  }

  try {
    const { data: account, error: lookupError } = await supabase
      .from(COL)
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (account) {
      const code = String(randomInt(100000, 1000000));
      const codeHash = hashResetCode(code);
      const { error: updateError } = await supabase
        .from(COL)
        .update({
          password_reset_code_hash: codeHash,
          password_reset_expires_at: new Date(Date.now() + RESET_CODE_TTL_MS).toISOString(),
        })
        .eq("email", email);
      if (updateError) throw updateError;
      const sent = await sendUserPasswordResetCode(email, code);
      if (!sent) req.log.error({ email }, "Password reset code delivery failed");
    }
    res.json({ message: "If an account exists for that email, a reset code has been sent." });
  } catch (err) {
    req.log.error({ err }, "Failed to request user password reset");
    res.status(500).json({ error: "Could not request a reset code. Please try again." });
  }
});

router.post("/users/password/reset", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!validEmail(email) || !/^\d{6}$/.test(code) || !validPassword(password)) {
    res.status(400).json({ error: "Enter the valid 6-digit code and a password of at least 8 characters." });
    return;
  }

  try {
    const { data: account, error } = await supabase
      .from(COL)
      .select("email, password_reset_code_hash, password_reset_expires_at")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    const codeHash = hashResetCode(code);
    const expected = account?.password_reset_code_hash ? Buffer.from(account.password_reset_code_hash, "hex") : Buffer.alloc(0);
    const actual = Buffer.from(codeHash, "hex");
    if (
      !account?.password_reset_expires_at ||
      new Date(account.password_reset_expires_at).getTime() < Date.now() ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      res.status(400).json({ error: "That reset code is invalid or expired." });
      return;
    }

    const salt = randomBytes(16).toString("hex");
    const { error: updateError } = await supabase
      .from(COL)
      .update({
        password_hash: hashPassword(password, salt),
        password_salt: salt,
        password_reset_code_hash: null,
        password_reset_expires_at: null,
      })
      .eq("email", email)
      .eq("password_reset_code_hash", codeHash);
    if (updateError) throw updateError;
    res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    req.log.error({ err }, "Failed to reset user password");
    res.status(500).json({ error: "Could not reset your password. Please try again." });
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const profile = await getVerifiedGoogleProfile(req.body?.accessToken);
    if (!profile) {
      res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
      return;
    }

    const { data: existing, error: lookupError } = await supabase
      .from(COL)
      .select("email, username, name, picture")
      .eq("email", profile.email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      res.status(404).json({ error: "This Gmail is not registered yet." });
      return;
    }

    const { data, error } = await supabase
      .from(COL)
      .update({
        name: profile.name || existing.name,
        picture: profile.picture ?? existing.picture,
        email_verified_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq("email", profile.email)
      .select("email, username, name, picture")
      .single();
    if (error) throw error;

    res.json({ ...publicUser(data), sessionToken: await createUserSession(data.email) });
  } catch (err) {
    req.log.error({ err }, "Failed to sign in user");
    res.status(500).json({ error: "Could not sign in with this Gmail." });
  }
});

router.post("/users", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";

  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    res.status(400).json({ error: "A valid username is required." });
    return;
  }

  try {
    const profile = await getVerifiedGoogleProfile(req.body?.accessToken);
    if (!profile) {
      res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .upsert({
        email: profile.email,
        username,
        name: profile.name || username,
        picture: profile.picture ?? null,
        email_verified_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      }, { onConflict: "email" })
      .select("email, username, name, picture")
      .single();
    if (error?.code === "23505") {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
    if (error) throw error;
    res.status(201).json({ ...publicUser(data), sessionToken: await createUserSession(data.email) });
  } catch (err) {
    req.log.error({ err }, "Failed to save user");
    res.status(500).json({ error: "Failed to save user profile." });
  }
});

router.get("/users/me/places", requireUser, async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    res.status(401).json({ error: "Sign in to access saved places." });
    return;
  }

  try {
    const [saved, recent] = await Promise.all([
      supabase
        .from("user_saved_places")
        .select("building_slug")
        .eq("user_email", email)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_recent_searches")
        .select("building_slug")
        .eq("user_email", email)
        .order("last_visited_at", { ascending: false })
        .limit(RECENT_SEARCH_LIMIT),
    ]);
    if (saved.error) throw saved.error;
    if (recent.error) throw recent.error;
    res.json({
      savedPlaces: saved.data.map((place) => place.building_slug),
      recentSearches: recent.data.map((place) => place.building_slug),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load user places");
    res.status(500).json({ error: "Could not load your saved places." });
  }
});

router.post("/users/me/saved-places", requireUser, async (req, res) => {
  const email = req.userEmail;
  const buildingSlug = typeof req.body?.buildingSlug === "string" ? req.body.buildingSlug.trim() : "";
  if (!email) {
    res.status(401).json({ error: "Sign in to save places." });
    return;
  }
  if (!buildingSlug || buildingSlug.length > 120) {
    res.status(400).json({ error: "A valid building is required." });
    return;
  }

  try {
    const { error } = await supabase.from("user_saved_places").insert({
      user_email: email,
      building_slug: buildingSlug,
    });
    if (error?.code === "23505") {
      res.status(204).end();
      return;
    }
    if (error?.code === "23503") {
      res.status(404).json({ error: "That building could not be found." });
      return;
    }
    if (error) throw error;
    res.status(201).end();
  } catch (err) {
    req.log.error({ err }, "Failed to save user place");
    res.status(500).json({ error: "Could not save this place." });
  }
});

router.delete("/users/me/saved-places/:buildingSlug", requireUser, async (req, res) => {
  const email = req.userEmail;
  const buildingSlug = typeof req.params.buildingSlug === "string" ? req.params.buildingSlug : "";
  if (!email) {
    res.status(401).json({ error: "Sign in to save places." });
    return;
  }

  try {
    const { error } = await supabase
      .from("user_saved_places")
      .delete()
      .eq("user_email", email)
      .eq("building_slug", buildingSlug);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to remove saved user place");
    res.status(500).json({ error: "Could not remove this saved place." });
  }
});

router.post("/users/me/recent-searches", requireUser, async (req, res) => {
  const email = req.userEmail;
  const buildingSlug = typeof req.body?.buildingSlug === "string" ? req.body.buildingSlug.trim() : "";
  if (!email) {
    res.status(401).json({ error: "Sign in to save recent searches." });
    return;
  }
  if (!buildingSlug || buildingSlug.length > 120) {
    res.status(400).json({ error: "A valid building is required." });
    return;
  }

  try {
    const { error: saveError } = await supabase
      .from("user_recent_searches")
      .upsert({
        user_email: email,
        building_slug: buildingSlug,
        last_visited_at: new Date().toISOString(),
      }, { onConflict: "user_email,building_slug" });
    if (saveError?.code === "23503") {
      res.status(404).json({ error: "That building could not be found." });
      return;
    }
    if (saveError) throw saveError;

    const { data: oldSearches, error: listError } = await supabase
      .from("user_recent_searches")
      .select("building_slug")
      .eq("user_email", email)
      .order("last_visited_at", { ascending: false })
      .range(RECENT_SEARCH_LIMIT, 999);
    if (listError) throw listError;
    if (oldSearches.length) {
      const { error: deleteError } = await supabase
        .from("user_recent_searches")
        .delete()
        .eq("user_email", email)
        .in("building_slug", oldSearches.map((item) => item.building_slug));
      if (deleteError) throw deleteError;
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to save recent user search");
    res.status(500).json({ error: "Could not save this recent destination." });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("email, username, name, picture, last_login_at")
      .order("last_login_at", { ascending: false });
    if (error) throw error;
    res.json(data.map((user) => ({
      id: user.email,
      email: user.email,
      username: user.username,
      name: user.name,
      picture: user.picture ?? undefined,
      lastLoginAt: user.last_login_at,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

router.delete("/users/:email", requireSuperAdmin, async (req, res) => {
  const email = typeof req.params.email === "string" ? req.params.email.trim().toLowerCase() : "";
  if (!validEmail(email)) {
    res.status(400).json({ error: "Invalid user email." });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .delete()
      .eq("email", email)
      .select("email")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Failed to delete user." });
  }
});

export default router;
