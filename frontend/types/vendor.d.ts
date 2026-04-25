declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
  };

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
}
