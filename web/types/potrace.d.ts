declare module 'potrace' {
  export function trace(
    image: Buffer | string,
    options: object,
    callback: (err: Error | null, svg: string | null) => void
  ): void;
  export function posterize(
    image: Buffer | string,
    options: object,
    callback: (err: Error | null, svg: string | null) => void
  ): void;
}
