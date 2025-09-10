declare module 'color-thief' {
  type Color = [number, number, number];
  export default class ColorThief {
    getColor: (
      img: HTMLImageElement | Buffer | null,
      quality?: number
    ) => Color;
    getPalette: (
      img: HTMLImageElement | Buffer | null,
      colorCount?: number,
      quality?: number
    ) => Color[];
  }
}
