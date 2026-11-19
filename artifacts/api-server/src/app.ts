import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import uploadsRouter from "./routes/uploads.js";
import { logger } from "./lib/logger.js";

const app = express();

const configuredOrigins = new Set(
  (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        const parsed = new URL(origin);
        if (
          parsed.origin !== origin ||
          (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        ) {
          throw new Error();
        }
        return parsed.origin;
      } catch {
        throw new Error("CORS_ORIGINS must contain exact HTTP or HTTPS origins.");
      }
    }),
);

function isAllowedOrigin(origin: string) {
  if (configuredOrigins.has(origin)) return true;
  if (process.env["NODE_ENV"] === "production") return false;

  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isSameOrigin(req: express.Request, origin: string) {
  const host = req.get("host");
  if (!host) return false;
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path === "/feedback" || req.path === "/api/feedback") return next();

  const origin = req.get("origin");
  if (origin && (isAllowedOrigin(origin) || isSameOrigin(req, origin))) return next();
  res.status(403).json({ error: "Request origin is not allowed." });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", uploadsRouter);
app.use("/api", router);

export default app;