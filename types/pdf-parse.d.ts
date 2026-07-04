declare module "pdf-parse" {
  export interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  export interface PDFParseOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  }

  export default function pdf(
    dataBuffer: Buffer | Uint8Array | ArrayBuffer,
    options?: PDFParseOptions
  ): Promise<PDFParseResult>;
}
