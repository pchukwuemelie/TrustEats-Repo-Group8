import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// import crypto from "crypto";
import User from "../users/user.model";
import Manufacturer from "../manufacturers/manufacturer.model";
import {
  issueTokens,
  setTokenCookies,
  clearTokenCookies,
} from "../../utils/token";
import { sendEmail } from "../../utils/sendEmail";
import { otpEmailTemplate } from "../../utils/emailTemplates";
import { AuthenticatedRequest } from "../../types";

// Helpers

const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Register

export const register = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, password, confirmPassword, role } = req.body;

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof fullName !== "string"
  ) {
    res.status(400).json({ success: false, error: "Invalid input" });
    return;
  }

  if (!fullName.trim() || !email.trim() || !password) {
    res.status(400).json({
      success: false,
      error: "Full name, email and password are required",
    });
    return;
  }

  if (password.length < 8 || password.length > 72) {
    res.status(400).json({
      success: false,
      error: "Password must be 8–72 characters",
    });
    return;
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    res.status(400).json({ success: false, error: "Passwords do not match" });
    return;
  }

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];

  const allowedRoles = ["consumer", "manufacturer"];
  const assignedRole = allowedRoles.includes(role) ? role : "consumer";

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    res.status(409).json({
      success: false,
      error: "An account with this email already exists",
    });
    return;
  }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  const user = await User.create({
    email: email.toLowerCase().trim(),
    passwordHash: password,
    firstName,
    lastName,
    role: assignedRole,
    emailVerified: false,
    emailVerificationOtp: otp,
    emailVerificationOtpExpiresAt: otpExpiresAt,
  });

  // Send verification OTP email
  // Log OTP to console for demo purposes ONLY!
  console.log(`[DEMO OTP] Email: ${user.email} | OTP: ${otp}`);
  try {
    await sendEmail({
      to: user.email,
      subject: "Verify your TrustEats account",
      html: otpEmailTemplate(otp, "verify"),
    });
  } catch (emailErr) {
    // Don't fail registration if email fails  log and continue
    console.error("[Register] Failed to send verification email:", emailErr);
  }

  res.status(201).json({
    success: true,
    message:
      "Account created. Check your email for a 6-digit verification code.",
    data: {
      userId: user._id,
      role: user.role,
      // DEMO ONLY, include otp in response for local testing
      otp: process.env.NODE_ENV !== "production" ? otp : undefined,
    },
  });
};

// Verify Email OTP

export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res
      .status(400)
      .json({ success: false, error: "Email and OTP are required" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+emailVerificationOtp +emailVerificationOtpExpiresAt",
  );

  if (!user) {
    res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ success: false, error: "Email already verified" });
    return;
  }

  if (
    !user.emailVerificationOtp ||
    !user.emailVerificationOtpExpiresAt ||
    user.emailVerificationOtp !== String(otp).trim() ||
    user.emailVerificationOtpExpiresAt < new Date()
  ) {
    res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    return;
  }

  user.emailVerified = true;
  (user as unknown as Record<string, unknown>).emailVerificationOtp = undefined;
  (user as unknown as Record<string, unknown>).emailVerificationOtpExpiresAt =
    undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Email verified successfully. You can now log in.",
  });
};

// Resend Verification OTP

export const resendVerificationOtp = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ success: false, error: "Email is required" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Generic message that's safe to return in all cases
  const genericMessage =
    "If an unverified account exists, a new OTP has been sent.";

  if (!user || user.emailVerified) {
    // Do not reveal account existence  return generic success
    res.status(200).json({ success: true, message: genericMessage });
    return;
  }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await User.findByIdAndUpdate(user._id, {
    emailVerificationOtp: otp,
    emailVerificationOtpExpiresAt: otpExpiresAt,
  });

  // DEMO ONLY: log OTP to console so frontend tests can prefill it when running locally
  console.log(`[DEMO OTP] Email: ${user.email} | New OTP: ${otp}`);

  try {
    await sendEmail({
      to: user.email,
      subject: "Your new TrustEats verification code",
      html: otpEmailTemplate(otp, "verify"),
    });
  } catch (emailErr) {
    console.error("[ResendOTP] Email failed:", emailErr);
  }

  type GenericResponse = {
    success: boolean;
    message: string;
    data?: { otp?: string } | null;
  };

  const responseBody: GenericResponse =
    process.env.NODE_ENV !== "production"
      ? { success: true, message: genericMessage, data: { otp } }
      : { success: true, message: genericMessage };

  res.status(200).json(responseBody);
};

// Forgot Password

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ success: false, error: "Email is required" });
    return;
  }

  const genericMessage =
    "If an account with that email exists, a reset OTP has been sent.";

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(200).json({ success: true, message: genericMessage });
    return;
  }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await User.findByIdAndUpdate(user._id, {
    passwordResetOtp: otp,
    passwordResetOtpExpiresAt: otpExpiresAt,
  });

  // DEMO ONLY: log OTP so dev testers can pick it up
  console.log(`[DEMO OTP] Email: ${user.email} | Reset OTP: ${otp}`);

  try {
    await sendEmail({
      to: user.email,
      subject: "Your TrustEats password reset code",
      html: otpEmailTemplate(otp, "reset"),
    });
  } catch (emailErr) {
    console.error("[ForgotPassword] Email failed:", emailErr);
  }

  type GenericResponse = {
    success: boolean;
    message: string;
    data?: { otp?: string } | null;
  };

  const responseBody: GenericResponse =
    process.env.NODE_ENV !== "production"
      ? { success: true, message: genericMessage, data: { otp } }
      : { success: true, message: genericMessage };

  res.status(200).json(responseBody);
};

// Reset Password

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({
      success: false,
      error: "Email, OTP and newPassword are required",
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ success: false, error: "Passwords do not match" });
    return;
  }

  if (newPassword.length < 8 || newPassword.length > 72) {
    res.status(400).json({
      success: false,
      error: "Password must be 8–72 characters",
    });
    return;
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+passwordHash +passwordResetOtp +passwordResetOtpExpiresAt");

  if (
    !user ||
    !user.passwordResetOtp ||
    !user.passwordResetOtpExpiresAt ||
    user.passwordResetOtp !== otp ||
    user.passwordResetOtpExpiresAt < new Date()
  ) {
    res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    return;
  }

  user.passwordHash = newPassword; // pre-save hook hashes this
  (user as unknown as Record<string, unknown>).passwordResetOtp = undefined;
  (user as unknown as Record<string, unknown>).passwordResetOtpExpiresAt =
    undefined;
  user.refreshTokenHash = undefined; // invalidate all sessions
  await user.save();

  clearTokenCookies(res);

  res.status(200).json({
    success: true,
    message: "Password reset successfully. Please log in again.",
  });
};

// The remainder of the file (login, logout, refresh, getMe, etc.) remains unchanged below

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ success: false, error: "Invalid input" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+passwordHash +refreshTokenHash",
  );

  if (!user || !user.isActive) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  // Block login if email not verified
  if (!user.emailVerified) {
    res.status(403).json({
      success: false,
      error:
        "Please verify your email before logging in. Check your inbox for the OTP.",
    });
    return;
  }

  let manufacturerId: string | undefined;
  if (user.role === "manufacturer") {
    const manufacturer = await Manufacturer.findOne({ userId: user._id });
    manufacturerId = manufacturer?._id?.toString();
  }

  const { accessToken, refreshToken } = issueTokens({
    userId: user._id.toString(),
    role: user.role,
    manufacturerId,
  });

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();

  setTokenCookies(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    },
  });
};

export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  await User.findByIdAndUpdate(req.user!.userId, { refreshTokenHash: null });
  clearTokenCookies(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    res.status(401).json({ success: false, error: "No refresh token" });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string,
    ) as { userId: string };

    const user = await User.findById(decoded.userId).select(
      "+refreshTokenHash",
    );

    if (!user || !user.refreshTokenHash) {
      res.status(401).json({ success: false, error: "Invalid refresh token" });
      return;
    }

    const isValid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: "Invalid refresh token" });
      return;
    }

    let manufacturerId: string | undefined;
    if (user.role === "manufacturer") {
      const manufacturer = await Manufacturer.findOne({ userId: user._id });
      manufacturerId = manufacturer?._id?.toString();
    }

    const { accessToken, refreshToken: newRefreshToken } = issueTokens({
      userId: user._id.toString(),
      role: user.role,
      manufacturerId,
    });

    user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await user.save();

    setTokenCookies(res, accessToken, newRefreshToken);
    res.status(200).json({ success: true, message: "Token refreshed" });
  } catch {
    res.status(401).json({
      success: false,
      error: "Invalid or expired refresh token",
    });
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const user = await User.findById(req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.status(200).json({ success: true, data: { user } });
};
