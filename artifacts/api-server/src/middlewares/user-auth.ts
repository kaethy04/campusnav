import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

async function authenticateUser(req: Request, res: Response, next: NextFunction, optional: boolean) {
  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) {
    if (optional && !authorization) {
      next();
      return;
    }
    res.status(401).json({ error: "Sign in to access saved places." });
    return;
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: session, error } = await supabase
      .from("user_sessions")
      .select("user_email")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!session) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }

    req.userEmail = session.user_email;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to verify user session");
    res.status(500).json({ error: "Could not verify your account session." });
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  return authenticateUser(req, res, next, false);
}

export function optionalUser(req: Request, res: Response, next: NextFunction) {
  return authenticateUser(req, res, next, true);
}
