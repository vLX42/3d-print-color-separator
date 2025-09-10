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
      const inPointContainer = utils.PointContainer.fromUint8Array(pixels.data, width, height);

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