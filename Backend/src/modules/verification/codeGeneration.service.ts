import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";
import VerificationCode from "./verificationCode.model";
import { generateQRCodeDataURL } from "../../utils/generateQRCode";

interface GenerateCodesOptions {
  productId: Types.ObjectId;
  batchId: Types.ObjectId;
  manufacturerId: Types.ObjectId;
  quantity: number;
}

interface GeneratedCode {
  code: string;
  qrCodeUrl: string;
}

export const generateCodesForBatch = async (
  options: GenerateCodesOptions,
): Promise<GeneratedCode[]> => {
  const { productId, batchId, manufacturerId, quantity } = options;

  if (quantity < 1 || quantity > 10000) {
    throw new Error("Quantity must be between 1 and 10,000 per batch");
  }

  const results: GeneratedCode[] = [];

  for (let i = 0; i < quantity; i++) {
    const code = uuidv4();
    const qrCodeUrl = await generateQRCodeDataURL(code);

    await VerificationCode.create({
      code,
      productId,
      batchId,
      manufacturerId,
      qrCodeUrl,
      qrCodePublicId: `local:${code}`,
    });

    results.push({ code, qrCodeUrl });
  }

  return results;
};