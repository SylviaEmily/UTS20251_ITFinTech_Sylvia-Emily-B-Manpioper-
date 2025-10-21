// models/User.ts
import mongoose, { Schema, models, model } from "mongoose";

export type TUserRole = "admin" | "user";

export interface IUser {
  name: string;
  email: string;
  phone: string; // simpan dalam format internasional, ex: 62812xxxx
  password: string; // hashed
  role: TUserRole;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
  },
  { timestamps: true }
);

// Pastikan unique index terset
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

export default models.User || model<IUser>("User", userSchema);
