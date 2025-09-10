// src/lib/imageToSvg.ts
import potrace from 'potrace';

export const imageToSvg = (image: Buffer) => {
  return new Promise((resolve, reject) => {
    potrace.trace(image, {}, (err, svg) => {
      if (err) reject(err);
      resolve(svg);
    });
  });
};
