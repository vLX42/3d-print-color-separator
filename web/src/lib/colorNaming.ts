// @ts-ignore - nearestColor doesn't have proper TypeScript definitions
import nearestColor from 'nearest-color';

// Define a comprehensive set of color names for common colors
const colors = {
  // Basic colors
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  grey: '#808080',
  
  // Extended colors
  darkred: '#8B0000',
  lightred: '#FFB6C1',
  darkgreen: '#006400',
  lightgreen: '#90EE90',
  darkblue: '#00008B',
  lightblue: '#ADD8E6',
  darkyellow: '#DAA520',
  lightyellow: '#FFFFE0',
  darkorange: '#FF8C00',
  lightorange: '#FFE4B5',
  darkpurple: '#4B0082',
  lightpurple: '#DDA0DD',
  darkpink: '#C71585',
  lightpink: '#FFB6C1',
  darkbrown: '#654321',
  lightbrown: '#D2B48C',
  darkgray: '#A9A9A9',
  lightgray: '#D3D3D3',
  darkgrey: '#A9A9A9',
  lightgrey: '#D3D3D3',
  
  // Metallic colors
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  copper: '#B87333',
  
  // Nature colors
  forestgreen: '#228B22',
  lime: '#00FF00',
  olive: '#808000',
  navy: '#000080',
  teal: '#008080',
  aqua: '#00FFFF',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  maroon: '#800000',
  
  // Specific shades
  crimson: '#DC143C',
  coral: '#FF7F50',
  salmon: '#FA8072',
  khaki: '#F0E68C',
  beige: '#F5F5DC',
  ivory: '#FFFFF0',
  lavender: '#E6E6FA',
  plum: '#DDA0DD',
  turquoise: '#40E0D0',
  indigo: '#4B0082',
  violet: '#EE82EE',
  tan: '#D2B48C',
  wheat: '#F5DEB3',
  linen: '#FAF0E6',
  snow: '#FFFAFA'
};

// Create the nearest color function
const nearest = nearestColor.from(colors);

/**
 * Convert a hex color to a human-readable color name
 * @param hexColor - Hex color string (with or without #)
 * @returns Human-readable color name
 */
export function getColorName(hexColor: string): string {
  // Ensure the color has a # prefix
  const normalizedHex = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
  
  try {
    const result = nearest(normalizedHex);
    
    if (result) {
      // Capitalize first letter and return
      return result.name.charAt(0).toUpperCase() + result.name.slice(1);
    }
  } catch (error) {
    console.warn('Error finding color name for', normalizedHex, error);
  }
  
  // Fallback: return the hex code if we can't find a name
  return normalizedHex.replace('#', '').toUpperCase();
}

/**
 * Generate a clean filename from a color
 * @param hexColor - Hex color string
 * @returns Safe filename string
 */
export function getColorFilename(hexColor: string): string {
  const colorName = getColorName(hexColor);
  
  // Convert to lowercase and replace spaces/special chars with hyphens
  return colorName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
