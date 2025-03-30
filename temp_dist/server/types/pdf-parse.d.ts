declare module 'pdf-parse' {
  interface PdfData {
    text?: string;
    version?: string;
    numpages?: number;
    info?: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
      [key: string]: any;
    };
    metadata?: any;
  }

  function parse(dataBuffer: Buffer): Promise<PdfData>;
  export = parse;
}