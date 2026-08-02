import { Router } from "express";
import {
  approveManufacturer,
  suspendManufacturer,
  getManufacturers,
  getManufacturerById,
  getPendingManufacturers,
  getPendingReports,
  reviewReport,
  recallBatch,
  deactivateCode,
  getAuditLogs,
} from "./admin.controller";
import { requireAuth, requireRole } from "../../middleware/requireAuth";

const router = Router();

// All admin routes require admin role
router.use(requireAuth, requireRole("admin"));

// Manufacturer management
router.get("/manufacturers", getManufacturers);
router.get("/manufacturers/pending", getPendingManufacturers);
router.get("/manufacturers/:manufacturerId", getManufacturerById);
router.patch("/manufacturers/:manufacturerId/approve", approveManufacturer);
router.patch("/manufacturers/:manufacturerId/suspend", suspendManufacturer);

// Report management
router.get("/reports/pending", getPendingReports);
router.patch("/reports/:reportId/review", reviewReport);

// Batch & code management
router.patch("/batches/:batchId/recall", recallBatch);
router.patch("/codes/:codeId/deactivate", deactivateCode);

// Audit logs — read only, no delete
router.get("/audit-logs", getAuditLogs);

export default router;