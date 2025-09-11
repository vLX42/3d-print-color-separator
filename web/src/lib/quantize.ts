// src/lib/quantize.ts
import getPixels from 'get-pixels';
import { applyPalette, buildPalette, utils } from 'image-q';

export const quantize = (image: Buffer, colorCount: number): Promise<number[][]> => {
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!image || image.length === 0) {
      return reject(new Error('Invalid image buffer'));
    }
    
    if (!colorCount || colorCount < 1 || colorCount > 256) {
      return reject(new Error('Color count must be between 1 and 256'));
    }

    getPixels(image, 'image/png', (err, pixels) => {
      if (err) {
        console.error('getPixels error:', err);
        return reject(new Error('Bad image data'));
      }

      if (!pixels || !pixels.data || pixels.data.length === 0) {
        return reject(new Error('No pixel data found in image'));
      }

      try {
        const width = pixels.shape[0];
        const height = pixels.shape[1];
        
        console.log(`Processing image: ${width}x${height}, ${pixels.data.length} bytes`);
        
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
        
        if (filteredPixels.length === 0) {
          return reject(new Error('No non-transparent pixels found in image'));
        }
        
        console.log(`Filtered to ${filteredPixels.length / 4} non-transparent pixels`);
        
        // Create a new point container with only non-transparent pixels
        const filteredWidth = Math.ceil(Math.sqrt(filteredPixels.length / 4));
        const filteredHeight = Math.ceil(filteredPixels.length / 4 / filteredWidth);
        
        // Ensure we have valid dimensions
        const validWidth = Math.max(1, filteredWidth);
        const validHeight = Math.max(1, filteredHeight);
        
        // Pad the array to match the expected size
        const expectedSize = validWidth * validHeight * 4;
        while (filteredPixels.length < expectedSize) {
          // Add transparent black pixels to pad
          filteredPixels.push(0, 0, 0, 0);
        }
        
        console.log(`Creating point container: ${validWidth}x${validHeight}`);
        
        const inPointContainer = utils.PointContainer.fromUint8Array(
          new Uint8Array(filteredPixels), 
          validWidth, 
          validHeight
        );

        console.log('Building palette...');
        
        // Use Promise.resolve to handle the palette building properly
        Promise.resolve(buildPalette([inPointContainer], {
          colors: Math.min(colorCount, Math.floor(filteredPixels.length / 4)), // Don't exceed available colors
          colorDistanceFormula: 'euclidean', // Specify a color distance formula
        })).then(palette => {
          console.log('Applying palette...');
          const outPointContainer = applyPalette(inPointContainer, palette);

          const paletteRgb = palette.getPointContainer().toUint8Array();
          const result: number[][] = [];
          
          for (let i = 0; i < paletteRgb.length; i += 4) {
            const r = paletteRgb[i];
            const g = paletteRgb[i + 1];
            const b = paletteRgb[i + 2];
            
            // Validate RGB values
            if (r !== undefined && g !== undefined && b !== undefined) {
              result.push([r, g, b]);
            }
          }
          
          if (result.length === 0) {
            return reject(new Error('No colors generated from palette'));
          }
          
          console.log(`Generated ${result.length} colors`);
          resolve(result);
          
        }).catch(paletteError => {
          console.error('Palette generation error:', paletteError);
          reject(new Error(`Palette generation failed: ${paletteError instanceof Error ? paletteError.message : 'Unknown error'}`));
        });
        
      } catch (processingError) {
        console.error('Image processing error:', processingError);
        reject(new Error(`Image processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`));
      }
    });
  });
};