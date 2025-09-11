declare module 'nearest-color' {
  interface ColorResult {
    name: string;
    value: string;
    rgb: { r: number; g: number; b: number };
    distance: number;
  }

  interface NearestColorFunction {
    (color: string): ColorResult | null;
  }

  interface NearestColor {
    from(colors: Record<string, string>): NearestColorFunction;
  }

  const nearestColor: NearestColor;
  export default nearestColor;
}
