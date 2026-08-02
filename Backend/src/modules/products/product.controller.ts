import { Response } from "express";
import { Types } from "mongoose";
import Product from "./product.model";
import VerificationCode from "../verification/verificationCode.model";
import Manufacturer from "../manufacturers/manufacturer.model";
import AuditLog from "../admin/auditLog.model";
import { AuthenticatedRequest } from "../../types";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";

const resolveManufacturer = async (userId: string) => {
  const manufacturer = await Manufacturer.findOne({
    userId,
    status: "approved",
  });
  if (!manufacturer)
    throw Object.assign(
      new Error("Manufacturer profile is either not found or not approved"),
      { statusCode: 403 },
    );
  return manufacturer;
};

export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await resolveManufacturer(req.user!.userId);
  const {
    name,
    brand,
    description,
    ingredients,
    storageInfo,
    countryOfOrigin,
    category,
    nafdacNumber,
  } = req.body;

  if (!name || !brand || !description || !category) {
    res.status(400).json({
      success: false,
      error: "name, brand, description and category are required",
    });
    return;
  }

  let imageUrl: string | undefined;
  if (req.file) {
    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      "trusteats/products",
    );
    imageUrl = uploaded.url;
  }

  const product = await Product.create({
    manufacturerId: manufacturer._id,
    name,
    brand,
    description,
    ingredients,
    storageInfo,
    countryOfOrigin: countryOfOrigin || "Nigeria",
    nafdacNumber,
    category,
    imageUrl,
  });

  await AuditLog.create({
    action: "product.created",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: req.user!.role,
    targetId: product._id,
    targetModel: "Product",
    newValue: { name, brand, category },
    ipAddress: req.ip,
  });

  res
    .status(201)
    .json({ success: true, message: "Product created", data: { product } });
};

export const getMyProducts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await resolveManufacturer(req.user!.userId);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const productFilter = { manufacturerId: manufacturer._id, isActive: true };
  const [rawProducts, total] = await Promise.all([
    Product.find(productFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(productFilter),
  ]);

  const productIds = rawProducts.map((product) => product._id);
  const generatedProductIds = await VerificationCode.distinct("productId", {
    manufacturerId: manufacturer._id,
    productId: { $in: productIds },
  });
  const generatedProductIdSet = new Set(
    generatedProductIds.map((id) => id.toString()),
  );
  const products = rawProducts.map((product) => ({
    ...product,
    qrGenerated: generatedProductIdSet.has(product._id.toString()),
  }));

  res.status(200).json({
    success: true,
    data: { products, total, page, pages: Math.ceil(total / limit) },
  });
};

export const getProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await resolveManufacturer(req.user!.userId);
  const product = await Product.findOne({
    _id: req.params.productId,
    manufacturerId: manufacturer._id,
    isActive: true,
  });

  if (!product) {
    res.status(404).json({ success: false, error: "Product not found" });
    return;
  }

  res.status(200).json({ success: true, data: { product } });
};

export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const manufacturer = await resolveManufacturer(req.user!.userId);
  const product = await Product.findOne({
    _id: req.params.productId,
    manufacturerId: manufacturer._id,
  });

  if (!product) {
    res.status(404).json({ success: false, error: "Product not found" });
    return;
  }

  const allowedFields = ["description", "ingredients", "storageInfo"] as const;
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      prev[field] = product[field];
      (product as unknown as Record<string, unknown>)[field] = req.body[field];
      next[field] = req.body[field];
    }
  }

  if (req.file) {
    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      "trusteats/products",
    );
    prev.imageUrl = product.imageUrl;
    product.imageUrl = uploaded.url;
    next.imageUrl = uploaded.url;
  }

  await product.save();

  await AuditLog.create({
    action: "product.updated",
    performedBy: new Types.ObjectId(req.user!.userId),
    performedByRole: req.user!.role,
    targetId: product._id,
    targetModel: "Product",
    previousValue: prev,
    newValue: next,
    ipAddress: req.ip,
  });

  res
    .status(200)
    .json({ success: true, message: "Product updated", data: { product } });
};