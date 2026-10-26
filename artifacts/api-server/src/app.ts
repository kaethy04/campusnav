import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import uploadsRouter from "./routes/uploads.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

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

// Allow CORS for Vercel deployment & Localhost
const allowedOrigins = [
  "http://localhost:5173",
  "https://campusnav-qcjcaq7by-campus-nav2.vercel.app",
  /^https:\/\/campusnav-.*\.vercel\.app$/,
  /^https:\/\/.*\.vercel\.app$/
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin)
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all fallback or strictly true
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Explicitly handle CORS Preflight OPTIONS requests
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", uploadsRouter);
app.use("/api", router);

export default app;