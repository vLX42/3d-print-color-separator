// pages/api/quantize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { quantize } from "@/lib/quantize";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const form = formidable({});
  const [fields, files] = await form.parse(req);

  const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
  if (!imageFile) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const imagePath = imageFile.filepath;
  const imageBuffer = fs.readFileSync(imagePath);

  try {
    const palette = await quantize(imageBuffer, fields.colorCount as any);
    res.status(200).json({ palette });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error quantizing image" });
  }
}
