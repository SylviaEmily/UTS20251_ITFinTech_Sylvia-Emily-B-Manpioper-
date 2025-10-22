import { sendWhatsApp } from "@/lib/whatsapp";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // misalnya panggil fungsi kirim WA
    const result = await sendWhatsApp({
      to: req.query.to as string,
      message: "Tes dari server",
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
