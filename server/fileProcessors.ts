import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert } from '@shared/schema';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';

// Import pdf-parse dynamically to avoid initialization errors
// We'll only use it when we actually need to parse a PDF
let pdfParse: any = null;
const getPdfParser = async () => {
  if (!pdfParse) {
    try {
      pdfParse = await import('pdf-parse');
    } catch (error) {
      console.error("Error importing pdf-parse:", error);
      throw new Error("Error al cargar la biblioteca para procesar PDF");
    }
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

// Función para procesar los valores de una fila y crear una entrada InsertExcelData
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData {
  return {
    storeCode: storeCode, // Usamos el código de tienda proporcionado, no el del Excel
    orderNumber: values[1]?.toString() || '', // Columna B
    orderDate: values[2] ? new Date(values[2]) : new Date(), // Columna C
    customerName: values[3]?.toString() || '', // Columna D
    customerContact: values[4]?.toString() || '', // Columna E
    itemDetails: values[5]?.toString() || '', // Columna F
    metals: values[6]?.toString() || '', // Columna G
    engravings: values[7]?.toString() || '', // Columna H
    stones: values[8]?.toString() || '', // Columna I
    carats: values[9]?.toString() || '', // Columna J
    price: values[10]?.toString() || '', // Columna K
    pawnTicket: values[11]?.toString() || '', // Columna L
    saleDate: values[12] ? new Date(values[12]) : null, // Columna M
    fileActivityId: activityId
  };
}

// Process Excel file (xls, xlsx, csv)
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
    
    // Get file extension
    const fileExt = path.extname(filePath).toLowerCase();
    let processedRows: InsertExcelData[] = [];
    
    // Procesar según el tipo de archivo
    if (fileExt === '.csv') {
      // Procesar archivo CSV
      const rows: any[] = [];
      
      // Leer el archivo CSV usando csvParser
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            rows.push(row);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
      
      // Saltar la primera fila (encabezado) e indexar los valores por posición
      rows.forEach((row, index) => {
        if (index === 0) return; // Saltar encabezado
        
        // Extraer valores de las columnas en orden
        const values = Object.values(row);
        processedRows.push(createExcelDataFromValues([null, ...values], storeCode, activityId));
      });
    } 
    else if (fileExt === '.xls') {
      // Procesar archivo XLS (formato antiguo) usando la biblioteca XLSX
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new Error('El archivo Excel no contiene hojas');
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Saltar la primera fila (encabezado)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.length > 0) {
          processedRows.push(createExcelDataFromValues([null, ...row], storeCode, activityId));
        }
      }
    } 
    else {
      // Procesar archivo XLSX usando ExcelJS (formato moderno)
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      // Asumir que la primera hoja contiene los datos
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('El archivo Excel no contiene hojas');
      }
      
      // Procesar filas (saltar fila de encabezado)
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Saltar fila de encabezado
        if (rowNumber === 1) return;
        
        const values = row.values as any[];
        processedRows.push(createExcelDataFromValues(values, storeCode, activityId));
      });
    }
    
    // Guardar todos los datos extraídos y verificar coincidencias con la lista de vigilancia
    for (const row of processedRows) {
      // Guardar los datos de Excel
      const savedData = await storage.createExcelData(row);
      
      // Verificar coincidencias con la lista de vigilancia
      await checkWatchlistMatches(savedData);
    }
    
    // Actualizar la actividad del archivo a Processed
    await storage.updateFileActivityStatus(activityId, 'Processed');
    emitFileProcessingStatus(activityId, 'Processed');
    
    console.log(`Archivo procesado correctamente: ${path.basename(filePath)} con ${processedRows.length} registros`);
    
  } catch (error) {
    console.error(`Error al procesar el archivo ${filePath}:`, error);
    
    // Actualizar la actividad del archivo a Failed
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido durante el procesamiento';
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
    
    // Extract basic info
    const title = path.basename(filePath, '.pdf');
    const fileStats = await fs.promises.stat(filePath);
    const fileSize = fileStats.size;
    
    let documentType = 'Desconocido';
    let pdfText = '';
    
    try {
      // Get PDF parser dynamically and parse PDF
      const parser = await getPdfParser();
      const pdfData = await parser(dataBuffer);
      
      // Extract text for document type determination
      pdfText = pdfData.text || '';
      
      // Determine document type based on content
      if (pdfText.toLowerCase().includes('factura') || pdfText.toLowerCase().includes('invoice')) {
        documentType = 'Factura';
      } else if (pdfText.toLowerCase().includes('informe') || pdfText.toLowerCase().includes('report')) {
        documentType = 'Informe';
      } else if (pdfText.toLowerCase().includes('recibo') || pdfText.toLowerCase().includes('receipt')) {
        documentType = 'Recibo';
      } else if (pdfText.toLowerCase().includes('contrato') || pdfText.toLowerCase().includes('contract')) {
        documentType = 'Contrato';
      }
    } catch (parseError) {
      console.warn(`Warning: Could not parse PDF content for type detection: ${parseError.message}`);
      // Continue with unknown document type, we don't want to fail the whole process just for text extraction
    }
    
    // Create PDF document record even if we couldn't parse the content
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
