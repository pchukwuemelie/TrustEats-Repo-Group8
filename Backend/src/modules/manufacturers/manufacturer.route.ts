import { Router } from "express";
import { Response } from "express";
import bcrypt from "bcrypt";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import Manufacturer from "./manufacturer.model";
import User from "../users/user.model";
import { uploadMiddleware } from "../../middleware/upload";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import { AuthenticatedRequest } from "../../types";
import { sendEmail } from "../../utils/sendEmail";
import { otpEmailTemplate } from "../../utils/emailTemplates";

const router = Router();

router.post(
  "/register-account",
  uploadMiddleware.fields([
    { name: "logo", maxCount: 1 },
    { name: "certificateOfRecognition", maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      companyName,
      napamsEmail,
      cacNumber,
      contactPhone,
      address,
      country,
      nafdacCofRNumber,
      termsAccepted,
    } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({
        success: false,
        error: "Full name, email and password are required",
      });
      return;
    }

    if (password.length < 8 || password.length > 72) {
      res.status(400).json({
        success: false,
        error: "Password must be 8-72 characters",
      });
      return;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ success: false, error: "Passwords do not match" });
      return;
    }

    if (!companyName || !napamsEmail || !cacNumber) {
      res.status(400).json({
        success: false,
        error: "companyName, napamsEmail and cacNumber are required",
      });
      return;
    }

    if (termsAccepted !== "true" && termsAccepted !== true) {
      res.status(400).json({
        success: false,
        error: "You must accept the Terms & Conditions",
      });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.certificateOfRecognition?.[0]) {
      res.status(400).json({
        success: false,
        error: "Certificate of Recognition image is required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash +emailVerificationOtp +emailVerificationOtpExpiresAt",
    );

    if (existingUser && existingUser.role !== "manufacturer") {
      res.status(409).json({
        success: false,
        error: "An account with this email already exists",
      });
      return;
    }

    if (existingUser) {
      const passwordMatches = await bcrypt.compare(
        password,
        existingUser.passwordHash,
      );
      if (!passwordMatches) {
        res.status(409).json({
          success: false,
          error: "An account with this email already exists",
        });
        return;
      }
    }

    const existingCac = await Manufacturer.findOne({
      cacNumber: cacNumber.trim(),
      ...(existingUser ? { userId: { $ne: existingUser._id } } : {}),
    });
    if (existingCac) {
      res.status(409).json({
        success: false,
        error: "A manufacturer with this CAC number is already registered",
      });
      return;
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    const { firstName, lastName } = buildNameParts(fullName);

    const user =
      existingUser ??
      (await User.create({
        email: normalizedEmail,
        passwordHash: password,
        firstName,
        lastName,
        role: "manufacturer",
        emailVerified: false,
        emailVerificationOtp: otp,
        emailVerificationOtpExpiresAt: otpExpiresAt,
      }));

    if (existingUser && !existingUser.emailVerified) {
      existingUser.emailVerificationOtp = otp;
      existingUser.emailVerificationOtpExpiresAt = otpExpiresAt;
      await existingUser.save();
    }

    const existingProfile = await Manufacturer.findOne({ userId: user._id });
    if (existingProfile) {
      await sendVerificationOtp(user.email, otp);
      res.status(200).json({
        success: true,
        message:
          "Manufacturer account already has a company profile. Verification OTP sent.",
        data: {
          userId: user._id,
          role: user.role,
          manufacturerId: existingProfile._id,
          otp: process.env.NODE_ENV !== "production" ? otp : undefined,
        },
      });
      return;
    }

    const corFile = files.certificateOfRecognition[0];
    const { url: certificateUrl, publicId: certificatePublicId } =
      await uploadToCloudinary(corFile.buffer, "trusteats/certificates");

    let logoUrl: string | undefined;
    let logoPublicId: string | undefined;
    if (files?.logo?.[0]) {
      const uploaded = await uploadToCloudinary(
        files.logo[0].buffer,
        "trusteats/logos",
      );
      logoUrl = uploaded.url;
      logoPublicId = uploaded.publicId;
    }

    const manufacturer = await Manufacturer.create({
      userId: user._id,
      companyName: companyName.trim(),
      napamsEmail: napamsEmail.toLowerCase().trim(),
      cacNumber: cacNumber.trim(),
      nafdacCofRNumber: nafdacCofRNumber?.trim(),
      certificateOfRecognitionUrl: certificateUrl,
      certificateOfRecognitionPublicId: certificatePublicId,
      contactPhone: contactPhone?.trim() || "Not provided",
      contactEmail: normalizedEmail,
      address: address?.trim() || "Not provided",
      country: country?.trim() || "Nigeria",
      logoUrl,
      logoPublicId,
      termsAcceptedAt: new Date(),
      status: "pending",
    });

    await sendVerificationOtp(user.email, otp);

    res.status(201).json({
      success: true,
      message:
        "Manufacturer account created. Check your email for a 6-digit verification code.",
      data: {
        userId: user._id,
        role: user.role,
        manufacturerId: manufacturer._id,
        otp: process.env.NODE_ENV !== "production" ? otp : undefined,
      },
    });
  },
);

const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const buildNameParts = (fullName: string) => {
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];
  return { firstName, lastName };
};

const sendVerificationOtp = async (email: string, otp: string) => {
  console.log(`[DEMO OTP] Email: ${email} | OTP: ${otp}`);
  try {
    await sendEmail({
      to: email,
      subject: "Verify your TrustEats account",
      html: otpEmailTemplate(otp, "verify"),
    });
  } catch (emailErr) {
    console.error("[ManufacturerRegister] Failed to send OTP:", emailErr);
  }
};

// This route should accept multipart/form-data — two file fields: logo (optional), certificate (required)
router.post(
  "/register",
  requireAuth,
  uploadMiddleware.fields([
    { name: "logo", maxCount: 1 },
    { name: "certificateOfRecognition", maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      companyName,
      napamsEmail,
      cacNumber,
      // contactPhone,
      // address,
      country,
      nafdacCofRNumber,
      termsAccepted,
    } = req.body;

    // Required field validation
    if (!companyName || !napamsEmail || !cacNumber) {
      res.status(400).json({
        success: false,
        error: "companyName, napamsEmail and cacNumber are required",
      });
      return;
    }

    // Terms must be accepted
    if (termsAccepted !== "true" && termsAccepted !== true) {
      res.status(400).json({
        success: false,
        error: "You must accept the Terms & Conditions",
      });
      return;
    }

    // Certificate of Recognition is required
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.certificateOfRecognition?.[0]) {
      res.status(400).json({
        success: false,
        error: "Certificate of Recognition image is required",
      });
      return;
    }

    // Check not already registered
    const existing = await Manufacturer.findOne({ userId: req.user!.userId });
    if (existing) {
      res.status(409).json({
        success: false,
        error: "A manufacturer profile already exists for this account",
      });
      return;
    }

    // Check CAC number not already registered
    const existingCac = await Manufacturer.findOne({
      cacNumber: cacNumber.trim(),
    });
    if (existingCac) {
      res.status(409).json({
        success: false,
        error: "A manufacturer with this CAC number is already registered",
      });
      return;
    }

    // Upload Certificate of Recognition
    const corFile = files.certificateOfRecognition[0];
    const { url: certificateUrl, publicId: certificatePublicId } =
      await uploadToCloudinary(corFile.buffer, "trusteats/certificates");

    // Upload logo if provided
    let logoUrl: string | undefined;
    let logoPublicId: string | undefined;
    if (files?.logo?.[0]) {
      const uploaded = await uploadToCloudinary(
        files.logo[0].buffer,
        "trusteats/logos",
      );
      logoUrl = uploaded.url;
      logoPublicId = uploaded.publicId;
    }

    const manufacturer = await Manufacturer.create({
      userId: req.user!.userId,
      companyName: companyName.trim(),
      napamsEmail: napamsEmail.toLowerCase().trim(),
      cacNumber: cacNumber.trim(),
      nafdacCofRNumber: nafdacCofRNumber?.trim(),
      certificateOfRecognitionUrl: certificateUrl,
      certificateOfRecognitionPublicId: certificatePublicId,
      // contactPhone: contactPhone.trim(),
      // address: address.trim(),
      country: country?.trim() || "Nigeria",
      logoUrl,
      logoPublicId,
      termsAcceptedAt: new Date(),
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message:
        "Manufacturer profile submitted successfully for review. An admin will review and approve your account.",
      data: { manufacturer },
    });
  },
);

router.get(
  "/me",
  requireAuth,
  requireRole("manufacturer"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const manufacturer = await Manufacturer.findOne({
      userId: req.user!.userId,
    }).select("-certificateOfRecognitionPublicId -logoPublicId");

    if (!manufacturer) {
      res.status(404).json({
        success: false,
        error: "Manufacturer profile not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: { manufacturer } });
  },
);

export default router;