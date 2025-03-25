import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert } from '@shared/schema';
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

// Función para verificar si hay coincidencias con la lista de vigilancia
async function checkWatchlistMatches(excelData: ExcelData) {
  try {
    // 1. Verificar coincidencias de personas
    const watchlistPersons = await storage.getWatchlistPersons();
    
    // Verificar coincidencias por nombre
    for (const person of watchlistPersons) {
      // Si el nombre de la persona está en la lista de vigilancia
      if (excelData.customerName && 
          person.fullName && 
          excelData.customerName.toLowerCase().includes(person.fullName.toLowerCase())) {
        
        // Calcular nivel de confianza (simple, basado en la longitud del nombre)
        // Un valor más alto significa mayor confianza en la coincidencia
        const confidence = (person.fullName.length / excelData.customerName.length) * 100;
        
        // Crear alerta solo si la confianza es mayor al 50%
        if (confidence > 50) {
          const alert: InsertAlert = {
            excelDataId: excelData.id,
            watchlistPersonId: person.id,
            watchlistItemId: null,
            alertType: "Persona",
            status: "Nueva",
            matchConfidence: confidence,
            createdAt: new Date(),
            reviewedBy: null,
            reviewNotes: null,
            resolvedAt: null
          };
          
          await storage.createAlert(alert);
          console.log(`🚨 Alerta creada: Coincidencia de persona "${person.fullName}" con confianza ${confidence.toFixed(2)}%`);
        }
      }
      
      // También verificar por número de identificación si está disponible
      if (excelData.customerContact && 
          person.identificationNumber && 
          excelData.customerContact.includes(person.identificationNumber)) {
        
        const alert: InsertAlert = {
          excelDataId: excelData.id,
          watchlistPersonId: person.id,
          watchlistItemId: null,
          alertType: "Persona",
          status: "Nueva",
          matchConfidence: 95, // Alta confianza para coincidencias de ID
          createdAt: new Date(),
          reviewedBy: null,
          reviewNotes: null,
          resolvedAt: null
        };
        
        await storage.createAlert(alert);
        console.log(`🚨 Alerta creada: Coincidencia de ID "${person.identificationNumber}" con confianza 95%`);
      }
    }
    
    // 2. Verificar coincidencias de artículos
    const watchlistItems = await storage.getWatchlistItems();
    
    for (const item of watchlistItems) {
      // Verificar si la descripción del artículo está en los detalles del pedido
      if (excelData.itemDetails && 
          item.description && 
          excelData.itemDetails.toLowerCase().includes(item.description.toLowerCase())) {
        
        // Calcular nivel de confianza
        const confidence = (item.description.length / excelData.itemDetails.length) * 100;
        
        if (confidence > 40) {  // Umbral más bajo para artículos
          const alert: InsertAlert = {
            excelDataId: excelData.id,
            watchlistPersonId: null,
            watchlistItemId: item.id,
            alertType: "Objeto",
            status: "Nueva",
            matchConfidence: confidence,
            createdAt: new Date(),
            reviewedBy: null,
            reviewNotes: null,
            resolvedAt: null
          };
          
          await storage.createAlert(alert);
          console.log(`🚨 Alerta creada: Coincidencia de artículo "${item.description}" con confianza ${confidence.toFixed(2)}%`);
        }
      }
      
      // También verificar por número de serie si está disponible
      if (excelData.itemDetails && 
          item.serialNumber && 
          excelData.itemDetails.includes(item.serialNumber)) {
        
        const alert: InsertAlert = {
          excelDataId: excelData.id,
          watchlistPersonId: null,
          watchlistItemId: item.id,
          alertType: "Objeto",
          status: "Nueva",
          matchConfidence: 98, // Alta confianza para coincidencias de serie
          createdAt: new Date(),
          reviewedBy: null,
          reviewNotes: null,
          resolvedAt: null
        };
        
        await storage.createAlert(alert);
        console.log(`🚨 Alerta creada: Coincidencia de número de serie "${item.serialNumber}" con confianza 98%`);
      }
    }
    
  } catch (error) {
    console.error("Error al verificar coincidencias con lista de vigilancia:", error);
  }
}

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
    
    // Save all extracted data and check for watchlist matches
    for (const row of processedRows) {
      // Guardar los datos de Excel
      const savedData = await storage.createExcelData(row);
      
      // Verificar coincidencias con la lista de vigilancia
      await checkWatchlistMatches(savedData);
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
