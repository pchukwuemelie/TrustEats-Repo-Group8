import { Response } from "express";
import { AuthenticatedRequest } from "../../types";
import Product from "../products/product.model";
import VerificationCode from "../verification/verificationCode.model";
import ScanEvent from "../verification/scanEvent.model";
import Manufacturer from "../manufacturers/manufacturer.model";

export const getAnalyticsSummary = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await Manufacturer.findOne({
    userId: req.user!.userId,
  });

  if (!manufacturer) {
    res.status(404).json({
      success: false,
      error: "Manufacturer profile not found",
    });
    return;
  }

  const mfrId = manufacturer._id;

  const [
    totalProducts,
    totalCodesIssued,
    totalScans,
    genuineScans,
    suspiciousScans,
    fakeScans,
    recentFlags,
    recentProducts,
  ] = await Promise.all([
    Product.countDocuments({ manufacturerId: mfrId, isActive: true }),
    VerificationCode.countDocuments({ manufacturerId: mfrId }),
    ScanEvent.countDocuments({ manufacturerId: mfrId }),
    ScanEvent.countDocuments({ manufacturerId: mfrId, result: "genuine" }),
    ScanEvent.countDocuments({ manufacturerId: mfrId, result: "suspicious" }),
    ScanEvent.countDocuments({ manufacturerId: mfrId, result: "fake" }),
    ScanEvent.find({
      manufacturerId: mfrId,
      result: { $in: ["suspicious", "fake"] },
    })
      .sort({ scannedAt: -1 })
      .limit(20)
      .populate("productId", "name brand imageUrl")
      .lean(),
    Product.find({ manufacturerId: mfrId, isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name brand imageUrl createdAt")
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      manufacturer: {
        id: manufacturer._id,
        companyName: manufacturer.companyName,
        status: manufacturer.status,
      },
      totalProducts,
      totalCodesIssued,
      totalScans,
      scansByResult: {
        genuine: genuineScans,
        suspicious: suspiciousScans,
        fake: fakeScans,
      },
      recentFlags: recentFlags.map((flag) => ({
        id: flag._id,
        scannedAt: flag.scannedAt,
        result: flag.result,
        location: flag.location,
        product: flag.productId || null,
        code: flag.code,
      })),
      recentProducts: recentProducts.map((product) => ({
        id: product._id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        createdAt: product.createdAt,
      })),
    },
  });
};