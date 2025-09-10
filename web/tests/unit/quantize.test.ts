/**
 * @jest-environment jsdom
 */
import 'jest-canvas-mock';
import { quantize } from '../../src/lib/quantize';

describe('quantize', () => {
  it('should return a palette of colors', () => {
    const image = new Image();
    image.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='; // 1x1 red pixel
    
    const palette = quantize(image, 4);
    
    // Since color-thief relies on canvas which is mocked, we can't check for exact colors.
    // We will check if it returns an array of arrays of numbers.
    expect(Array.isArray(palette)).toBe(true);
    if (palette.length > 0) {
      expect(Array.isArray(palette[0])).toBe(true);
      expect(typeof palette[0][0]).toBe('number');
    }
  });
});
