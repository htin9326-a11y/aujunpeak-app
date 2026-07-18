import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { adminRouter } from "./routes/admin";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve admin panel HTML at GET /admin (before sub-router so it doesn't get consumed)
app.get("/admin", (_req, res) => {
  // In dev: __dirname = src/, admin.html is at ../../admin.html (artifact root)
  // In prod (after build): __dirname = dist/, admin.html copied to dist/admin.html
  const adminHtmlPaths = [
    path.join(__dirname, "admin.html"),          // prod: dist/admin.html
    path.join(__dirname, "..", "admin.html"),    // dev: src/../admin.html = artifact root
  ];
  // Try first path; fallback via sendFile options
  res.sendFile(adminHtmlPaths[0], (err1) => {
    if (!err1) return;
    res.sendFile(adminHtmlPaths[1], (err2) => {
      if (!err2) return;
      res.status(404).send("Admin panel not found");
    });
  });
});

// Admin API routes
app.use("/admin", adminRouter);

// API routes
app.use("/api", router);

export default app;
