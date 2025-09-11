// pages/api/trace.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { trace } from 'potrace';
import formidable from 'formidable';
import fs from 'fs';

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
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const form = formidable();
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const path = file.filepath;
    const buffer = fs.readFileSync(path);

    // Validate color parameter
    const colorParam = Array.isArray(fields.color) ? fields.color[0] : fields.color;
    const color = colorParam ? colorParam.toString() : '#000000';

    const params = {
      color: color,
    };

    console.log(`Tracing image with color: ${color}`);

    // Promisify the trace function
    const svg = await new Promise<string>((resolve, reject) => {
      trace(buffer, params, (traceErr, svg) => {
        if (traceErr) {
          console.error('Trace error:', traceErr);
          reject(new Error('Error tracing image'));
        } else if (svg) {
          resolve(svg);
        } else {
          reject(new Error('No SVG generated from trace'));
        }
      });
    });

    console.log('Trace completed successfully');
    res.status(200).json({ svg });

  } catch (error) {
    console.error('Trace API error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error processing trace request' 
    });
  }
}
