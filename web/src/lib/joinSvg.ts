// src/lib/joinSvg.ts
export const joinSvg = (svgs: string[]): string => {
  const combinedSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${svgs
    .map((svg) => {
      const content = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      return content ? content[1] : '';
    })
    .join('')}</svg>`;
  return combinedSvg;
};
