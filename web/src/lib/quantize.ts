// src/lib/quantize.ts
import getPixels from 'get-pixels';
import { applyPalette, buildPalette, utils } from 'image-q';

export const quantize = (image: Buffer, colorCount: number): Promise<number[][]> => {
  return new Promise((resolve, reject) => {
    getPixels(image, 'image/png', async (err, pixels) => {
      if (err) {
        return reject(new Error('Bad image data'));
      }

      const width = pixels.shape[0];
      const height = pixels.shape[1];
      
      // Filter out transparent pixels before quantization
      const filteredPixels: number[] = [];
      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        const a = pixels.data[i + 3];
        
        // Only include pixels that are not transparent (alpha > 0)
        if (a > 0) {
          filteredPixels.push(r, g, b, a);
        }
      }
      
      // Create a new point container with only non-transparent pixels
      const filteredWidth = Math.ceil(Math.sqrt(filteredPixels.length / 4));
      const filteredHeight = Math.ceil(filteredPixels.length / 4 / filteredWidth);
      const inPointContainer = utils.PointContainer.fromUint8Array(
        new Uint8Array(filteredPixels), 
        filteredWidth, 
        filteredHeight
      );

      const palette = await buildPalette([inPointContainer], {
        colors: colorCount,
      });

      const outPointContainer = applyPalette(inPointContainer, palette);

      const paletteRgb = palette.getPointContainer().toUint8Array();
      const result: number[][] = [];
      for (let i = 0; i < paletteRgb.length; i += 4) {
        result.push([paletteRgb[i], paletteRgb[i + 1], paletteRgb[i + 2]]);
      }
      
      resolve(result);
    });
  });
};