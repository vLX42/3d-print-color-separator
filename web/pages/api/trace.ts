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
  if (req.method === 'POST') {
    const form = formidable();
    form.parse(req, (err, fields, files) => {
      if (err) {
        res.status(500).json({ error: 'Error parsing form data' });
        return;
      }

      const file = Array.isArray(files.image) ? files.image[0] : files.image;
      if (!file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const path = file.filepath;
      const buffer = fs.readFileSync(path);

      const color = fields.color ? fields.color.toString() : '#000000';

      const params = {
        color: color,
      };

      trace(buffer, params, (traceErr, svg) => {
        if (traceErr) {
          res.status(500).json({ error: 'Error tracing image' });
          return;
        }
        res.status(200).json({ svg });
      });
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
