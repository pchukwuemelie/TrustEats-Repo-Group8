import { Response } from "express";
import { Types } from "mongoose";
import User from "../users/user.model";
import Manufacturer from "../manufacturers/manufacturer.model";
import Report from "../reports/report.model";
import Batch from "../batches/batch.model";
import VerificationCode from "../verification/verificationCode.model";
import AuditLog from "./auditLog.model";
import { AuthenticatedRequest } from "../../types";

import { sendEmail } from "../../utils/sendEmail";
import {
  manufacturerApprovalTemplate,
  // manufacturerSuspensionTemplate,
} from "../../utils/emailTemplates";

export const approveManufacturer = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await Manufacturer.findById(req.params.manufacturerId);
  if (!manufacturer) {
    res.status(404).json({ success: false, error: "Manufacturer not found" });
    return;
  }

  const prev = manufacturer.status;
  manufacturer.status = "approved";
  manufacturer.approvedBy = new Types.ObjectId(req.user!.userId);
  manufacturer.approvedAt = new Date();
  await manufacturer.save();

  // Send approval notification email
  try {
    const mfrUser = await User.findById(manufacturer.userId);
    if (mfrUser) {
      await sendEmail({
        to: mfrUser.email,
        subject: "Your TrustEats manufacturer account has been approved!",
        html: manufacturerApprovalTemplate(manufacturer.companyName),
      });
    }
  } catch (emailErr) {
    console.error("[Approve] Email failed:", emailErr);
  }

  await User.findByIdAndUpdate(manufacturer.userId, { role: "manufacturer" });

  await AuditLog.create({
    action: "manufacturer.approved",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: "admin",
    targetId: manufacturer._id,
    targetModel: "Manufacturer",
    previousValue: { status: prev },
    newValue: { status: "approved" },
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: "Manufacturer approved",
    data: { manufacturer },
  });
};

export const suspendManufacturer = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { reason } = req.body;
  if (!reason) {
    res
      .status(400)
      .json({ success: false, error: "Suspension reason is required" });
    return;
  }

  const manufacturer = await Manufacturer.findById(req.params.manufacturerId);
  if (!manufacturer) {
    res.status(404).json({ success: false, error: "Manufacturer not found" });
    return;
  }

  const prev = manufacturer.status;
  manufacturer.status = "suspended";
  manufacturer.suspendedReason = reason.trim();
  await manufacturer.save();

  // Send suspension notification email
  // DEMO MODE: email notifications disabled
  // try {
  //   const mfrUser = await User.findById(manufacturer.userId);
  //   if (mfrUser) {
  //     await sendEmail({
  //       to: mfrUser.email,
  //       subject: 'Your TrustEats manufacturer account has been approved',
  //       html: manufacturerApprovalTemplate(manufacturer.companyName),
  //     });
  //   }
  // } catch (emailErr) {
  //   console.error('[Approve] Email failed:', emailErr);
  // }
  console.log(`[DEMO] Manufacturer approved: ${manufacturer.companyName}`);

  await AuditLog.create({
    action: "manufacturer.suspended",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: "admin",
    targetId: manufacturer._id,
    targetModel: "Manufacturer",
    previousValue: { status: prev },
    newValue: { status: "suspended", reason },
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, message: "Manufacturer suspended" });
};

export const getPendingManufacturers = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturers = await Manufacturer.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .populate("userId", "email firstName lastName");

  res.status(200).json({ success: true, data: { manufacturers } });
};

export const getPendingReports = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const reports = await Report.find({
    status: { $in: ["pending", "under_review"] },
  })
    .sort({ reportedAt: -1 })
    .select("-imagePublicIds")
    .populate("productId", "name brand")
    .populate("reportedBy", "email");

  res.status(200).json({ success: true, data: { reports } });
};

export const reviewReport = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { status, reviewNotes } = req.body;
  const validStatuses = ["under_review", "resolved", "dismissed"];

  if (!validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: `Status must be one of: ${validStatuses.join(", ")}`,
    });
    return;
  }

  const report = await Report.findById(req.params.reportId);
  if (!report) {
    res.status(404).json({ success: false, error: "Report not found" });
    return;
  }

  const prev = report.status;
  report.status = status;
  report.reviewedBy = new Types.ObjectId(req.user!.userId);
  report.reviewedAt = new Date();
  report.reviewNotes = reviewNotes?.trim();
  await report.save();

  await AuditLog.create({
    action: "report.reviewed",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: "admin",
    targetId: report._id,
    targetModel: "Report",
    previousValue: { status: prev },
    newValue: { status, reviewNotes },
    ipAddress: req.ip,
  });

  res
    .status(200)
    .json({ success: true, message: "Report updated", data: { report } });
};

export const recallBatch = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { reason } = req.body;
  if (!reason) {
    res
      .status(400)
      .json({ success: false, error: "Recall reason is required" });
    return;
  }

  const batch = await Batch.findById(req.params.batchId);
  if (!batch) {
    res.status(404).json({ success: false, error: "Batch not found" });
    return;
  }

  const prev = batch.status;
  batch.status = "recalled";
  batch.recallReason = reason.trim();
  batch.flaggedBy = new Types.ObjectId(req.user!.userId);
  batch.flaggedAt = new Date();
  await batch.save();

  await AuditLog.create({
    action: "batch.recalled",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: "admin",
    targetId: batch._id,
    targetModel: "Batch",
    previousValue: { status: prev },
    newValue: { status: "recalled", reason },
    ipAddress: req.ip,
  });

  res.status(200).json({
    success: true,
    message: "Batch recalled — all codes will now return Fake",
  });
};

export const deactivateCode = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const code = await VerificationCode.findById(req.params.codeId);
  if (!code) {
    res
      .status(404)
      .json({ success: false, error: "Verification code not found" });
    return;
  }

  code.isActive = false;
  await code.save();

  await AuditLog.create({
    action: "verification_code.deactivated",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: "admin",
    targetId: code._id,
    targetModel: "VerificationCode",
    newValue: { isActive: false },
    ipAddress: req.ip,
  });

  res
    .status(200)
    .json({ success: true, message: "Verification code deactivated" });
};

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.targetId) filter.targetId = req.query.targetId;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("performedBy", "email firstName lastName"),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: { logs, total, page, pages: Math.ceil(total / limit) },
  });
};
