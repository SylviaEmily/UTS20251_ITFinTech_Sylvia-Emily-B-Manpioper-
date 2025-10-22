// models/Otp.ts
import mongoose, { Schema, models, model } from "mongoose";

const otpSchema = new Schema(
  {
    phone: { type: String, index: true, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true } // ⬅️ penting agar sort by createdAt bekerja
);

// Opsional: hapus otomatis setelah expired
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.Otp || model("Otp", otpSchema);
