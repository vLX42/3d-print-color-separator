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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!imageFile) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Validate colorCount parameter
    const colorCountParam = Array.isArray(fields.colorCount) 
      ? fields.colorCount[0] 
      : fields.colorCount;
    
    const colorCount = parseInt(colorCountParam as string, 10);
    if (isNaN(colorCount) || colorCount < 1 || colorCount > 256) {
      return res.status(400).json({ error: "Invalid color count. Must be between 1 and 256." });
    }

    const imagePath = imageFile.filepath;
    const imageBuffer = fs.readFileSync(imagePath);

    console.log(`Processing image quantization with ${colorCount} colors...`);
    const palette = await quantize(imageBuffer, colorCount);
    console.log(`Quantization completed. Palette has ${palette.length} colors.`);
    
    res.status(200).json({ palette });
  } catch (error) {
    console.error('Quantize API error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Error quantizing image" 
    });
  }
}
