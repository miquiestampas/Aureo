import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument } from '@shared/schema';
import { promisify } from 'util';
import * as ExcelJS from 'exceljs';

// Import pdf-parse dynamically to avoid initialization errors
// We'll only use it when we actually need to parse a PDF
let pdfParse: any = null;
const getPdfParser = async () => {
  if (!pdfParse) {
    pdfParse = await import('pdf-parse');
  }
  return pdfParse.default;
};

// Process Excel file
export async function processExcelFile(filePath: string, activityId: number, storeCode: string) {
  try {
    // Update file activity to Processing status
    await storage.updateFileActivityStatus(activityId, 'Processing');
    emitFileProcessingStatus(activityId, 'Processing');
    
    // Check if store exists
    const store = await storage.getStoreByCode(storeCode);
    if (!store) {
      throw new Error(`Store with code ${storeCode} does not exist`);
    }
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    
    // Parse Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // Assume first worksheet contains the data
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Excel file contains no worksheets');
    }
    
    // Process rows (skip header row)
    const processedRows: InsertExcelData[] = [];
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;
      
      const values = row.values as any[];
      
      // Extract values from specific columns (adjust indices as needed)
      const excelData: InsertExcelData = {
        storeCode: storeCode,
        orderNumber: values[1]?.toString() || '',
        orderDate: new Date(values[2] || new Date()),
        customerName: values[3]?.toString() || '',
        customerContact: values[4]?.toString() || '',
        itemDetails: values[5]?.toString() || '',
        metals: values[6]?.toString() || '',
        engravings: values[7]?.toString() || '',
        stones: values[8]?.toString() || '',
        carats: values[9]?.toString() || '',
        price: values[10]?.toString() || '',
        pawnTicket: values[11]?.toString() || '',
        saleDate: values[12] ? new Date(values[12]) : null,
        fileActivityId: activityId
      };
      
      processedRows.push(excelData);
    });
    
    // Save all extracted data
    for (const row of processedRows) {
      await storage.createExcelData(row);
    }
    
    // Update file activity to Processed
    await storage.updateFileActivityStatus(activityId, 'Processed');
    emitFileProcessingStatus(activityId, 'Processed');
    
    console.log(`Successfully processed Excel file ${path.basename(filePath)} with ${processedRows.length} records`);
    
  } catch (error) {
    console.error(`Error processing Excel file ${filePath}:`, error);
    
    // Update file activity to Failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
    await storage.updateFileActivityStatus(activityId, 'Failed', errorMessage);
    emitFileProcessingStatus(activityId, 'Failed', errorMessage);
  }
}

// Process PDF file
export async function processPdfFile(filePath: string, activityId: number, storeCode: string) {
  try {
    // Update file activity to Processing status
    await storage.updateFileActivityStatus(activityId, 'Processing');
    emitFileProcessingStatus(activityId, 'Processing');
    
    // Check if store exists
    const store = await storage.getStoreByCode(storeCode);
    if (!store) {
      throw new Error(`Store with code ${storeCode} does not exist`);
    }
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    
    // Read file buffer
    const dataBuffer = await fs.promises.readFile(filePath);
    
    // Get PDF parser dynamically and parse PDF
    const parser = await getPdfParser();
    const pdfData = await parser(dataBuffer);
    
    // Extract basic info
    const title = path.basename(filePath, '.pdf');
    const fileStats = await fs.promises.stat(filePath);
    const fileSize = fileStats.size;
    
    // Determine document type based on content (simple example)
    let documentType = 'Unknown';
    if (pdfData.text.includes('Invoice') || pdfData.text.includes('INVOICE')) {
      documentType = 'Invoice';
    } else if (pdfData.text.includes('Report') || pdfData.text.includes('REPORT')) {
      documentType = 'Report';
    } else if (pdfData.text.includes('Receipt') || pdfData.text.includes('RECEIPT')) {
      documentType = 'Receipt';
    }
    
    // Create PDF document record
    const pdfDocument: InsertPdfDocument = {
      storeCode,
      documentType,
      title,
      path: filePath,
      uploadDate: new Date(),
      fileSize,
      fileActivityId: activityId
    };
    
    await storage.createPdfDocument(pdfDocument);
    
    // Update file activity to Processed
    await storage.updateFileActivityStatus(activityId, 'Processed');
    emitFileProcessingStatus(activityId, 'Processed');
    
    console.log(`Successfully processed PDF file ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`Error processing PDF file ${filePath}:`, error);
    
    // Update file activity to Failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
    await storage.updateFileActivityStatus(activityId, 'Failed', errorMessage);
    emitFileProcessingStatus(activityId, 'Failed', errorMessage);
  }
}
