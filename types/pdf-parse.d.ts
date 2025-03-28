declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  
  function PDFParse(dataBuffer: Buffer, options?: any): Promise<PdfData>;
  
  export default PDFParse;
}