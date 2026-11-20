declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
    variationAxes?: Record<string, number | { min?: number; max?: number; default?: number }>;
    keepFeatures?: string[];
  }
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
