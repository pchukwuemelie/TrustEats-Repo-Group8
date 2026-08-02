import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import connectDB from "./config/db";
import configureCloudinary from "./config/cloudinary";
import { sanitiseQuery } from "./middleware/sanitiseQuery";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./modules/auth/auth.routes";
import manufacturerRoutes from "./modules/manufacturers/manufacturer.route";
import productRoutes from "./modules/products/product.route";
import batchRoutes from "./modules/batches/batch.route";
import verificationRoutes from "./modules/verification/verification.route";
import reportRoutes from "./modules/reports/report.route";
import adminRoutes from "./modules/admin/admin.routes";
import analyticsRoutes from "./modules/analytics/analytics.route";

// Parse allowed origins from env (comma-separated). Provide sensible defaults for local dev.
const rawAllowed =
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:3000,https://trusteatsrepogroup8.vercel.app";
const allowedOrigins = rawAllowed
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "BASE_URL",
  // 'RESEND_API_KEY', // disabled for demo
  "EMAIL_FROM",
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`You are missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();

// Security middleware must come first
app.use(helmet());

// CORS configuration
const corsOptionsCommon = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Referer",
    "User-Agent",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

const corsOptions =
  process.env.NODE_ENV !== "production"
    ? { origin: true, ...corsOptionsCommon }
    : {
        origin: (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          // Allow non-browser clients (Postman, curl)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        ...corsOptionsCommon,
      };

// Apply CORS middleware and ensure OPTIONS preflight is handled with the same config
app.use(cors(corsOptions));
// app.options("*", cors(corsOptions));

// Trust reverse proxies so secure cookies / IPs are handled correctly
app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());
app.use(sanitiseQuery);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/manufacturers", manufacturerRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/verify", verificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TrustEats API",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler 94 must come last
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || "5000", 10);

const start = async () => {
  configureCloudinary();
  await connectDB();
  app.listen(PORT, () => {
    console.log(`TrustEats API is live on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(
      `   Manufacturer onboarding: http://localhost:${PORT}/api/v1/manufacturers/register-account`,
    );
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;