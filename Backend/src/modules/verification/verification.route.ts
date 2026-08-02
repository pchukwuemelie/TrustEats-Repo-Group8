import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  verifyByCode,
  verifyProduct,
  getScanHistory,
} from "./verification.controller";
import { optionalAuth, requireAuth } from "../../middleware/requireAuth";
import { noCache } from "../../middleware/noCache";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: "Too many scan attempts — please wait" },
  standardHeaders: true,
  legacyHeaders: false,
});

// IMPORTANT NOTE HERE: /history must be defined BEFORE /:code
// otherwise Express matches "history" as a :code param
router.get("/history", requireAuth, noCache, getScanHistory);

// QR code URL-based scan. This is what the camera opens directly
router.get("/:code", verifyLimiter, optionalAuth, verifyByCode);

// App-based scan with optional geo context
router.post("/", verifyLimiter, optionalAuth, verifyProduct);

export default router;