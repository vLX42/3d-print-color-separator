// src/lib/imageUtils.ts

export function imageToPixels(image: HTMLImageElement): Uint8Array {
  // Create a canvas to extract pixel data
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }
  
  // Set canvas size to image size
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  
  // Draw the image onto the canvas
  ctx.drawImage(image, 0, 0);
  
  // Get the pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  return new Uint8Array(imageData.data);
}
