import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  verifyEmail,
  resendVerificationOtp,
  forgotPassword,
  resetPassword,
} from "./auth.controller";
import { requireAuth } from "../../middleware/requireAuth";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    // error: "Too many attempts — try again in 15 minutes",
    error: "Too many attempts — try again in 15 minutes", // for demo purposes, change back to 15 minutes after demo
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,

  max: 5,
  message: {
    success: false,
    // error: "Too many OTP requests — try again in 1 hour",
    error: "Too many OTP requests — try again in 1 hour", // for demo purposes, change back to 1 hour after demo
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", requireAuth, logout);
router.post("/refresh", refresh);
router.get("/me", requireAuth, getMe);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-verification", otpLimiter, resendVerificationOtp);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);

export default router;
