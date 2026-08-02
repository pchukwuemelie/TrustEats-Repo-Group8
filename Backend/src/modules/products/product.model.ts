import mongoose, { Schema, Document, Types } from "mongoose";
import sanitizeHtml from "sanitize-html";

export interface IProduct extends Document {
  manufacturerId: Types.ObjectId;
  name: string;
  brand: string;
  description: string;
  ingredients?: string;
  storageInfo?: string;
  countryOfOrigin: string;
  nafdacNumber?: string;
  imageUrl?: string;
  imagePublicId?: string;
  category: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const sanitise = (val: string) =>
  sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} });

const ProductSchema = new Schema<IProduct>(
  {
    manufacturerId: {
      type: Schema.Types.ObjectId,
      ref: "Manufacturer",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      set: sanitise,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      set: sanitise,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
      set: sanitise,
    },
    ingredients: { type: String, maxlength: 2000, set: sanitise },
    storageInfo: { type: String, maxlength: 500, set: sanitise },
    countryOfOrigin: {
      type: String,
      required: true,
      default: "Nigeria",
      set: sanitise,
    },
    nafdacNumber: {
      type: String,
      trim: true,
      maxlength: 50,
      set: sanitise,
    },
    imageUrl: { type: String },
    imagePublicId: { type: String, select: false },
    category: {
      type: String,
      required: true,
      enum: [
        "food",
        "beverage",
        "supplement",
        "baby_product",
        "alcohol",
        "cosmetic",
        "other",
      ],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ProductSchema.index({ manufacturerId: 1, isActive: 1 });
ProductSchema.index({ name: "text", brand: "text" });

export default mongoose.model<IProduct>("Product", ProductSchema);