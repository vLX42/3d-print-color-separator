// src/lib/separateColors.ts

// Helper function to calculate the Euclidean distance between two colors
const colorDistance = (color1: number[], color2: number[]): number => {
  const rDiff = color1[0] - color2[0];
  const gDiff = color1[1] - color2[1];
  const bDiff = color1[2] - color2[2];
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
};

export const separateColors = (
  image: HTMLImageElement,
  palette: number[][]
): string[] => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  // Create a canvas and context for each color in the palette
  const colorCanvases = palette.map(() => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    return newCanvas;
  });
  const colorContexts = colorCanvases.map(c => c.getContext('2d'));

  // Create ImageData for each context
  const colorImageDatas = colorContexts.map(c => c?.createImageData(canvas.width, canvas.height));

  // Iterate over each pixel of the original image
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent and semi-transparent pixels (alpha < 128 is considered transparent)
    if (a < 128) continue;

    const pixelColor = [r, g, b];

    // Find the closest color in the palette
    let closestColorIndex = 0;
    let minDistance = Infinity;

    palette.forEach((paletteColor, index) => {
      const distance = colorDistance(pixelColor, paletteColor);
      if (distance < minDistance) {
        minDistance = distance;
        closestColorIndex = index;
      }
    });

    // Get the data for the corresponding canvas
    const targetImageData = colorImageDatas[closestColorIndex];
    if (targetImageData) {
      const targetData = targetImageData.data;
      const paletteColor = palette[closestColorIndex];
      targetData[i] = paletteColor[0];
      targetData[i + 1] = paletteColor[1];
      targetData[i + 2] = paletteColor[2];
      targetData[i + 3] = a;
    }
  }

  // Put the image data onto each canvas and get the data URL
  const separatedImageUrls: string[] = [];
  colorContexts.forEach((ctx, index) => {
    const imageData = colorImageDatas[index];
    if (ctx && imageData) {
      ctx.putImageData(imageData, 0, 0);
      separatedImageUrls.push(colorCanvases[index].toDataURL('image/png'));
    }
  });

  return separatedImageUrls;
};
