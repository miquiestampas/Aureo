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
    const watchlistPersons = await storage.getWatchlistPersons() || [];
    
    // Verificar que watchlistPersons sea iterable
    if (!Array.isArray(watchlistPersons)) {
      console.warn("La lista de vigilancia de personas no es un array iterable. Saltando verificación de personas.");
      return;
    }
    
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
            reviewedBy: null,
            reviewNotes: null
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
          reviewedBy: null,
          reviewNotes: null
        };
        
        await storage.createAlert(alert);
        console.log(`🚨 Alerta creada: Coincidencia de ID "${person.identificationNumber}" con confianza 95%`);
      }
    }
    
    // 2. Verificar coincidencias de artículos
    const watchlistItems = await storage.getWatchlistItems() || [];
    
    // Verificar que watchlistItems sea iterable
    if (!Array.isArray(watchlistItems)) {
      console.warn("La lista de vigilancia de artículos no es un array iterable. Saltando verificación de artículos.");
      return;
    }
    
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
            reviewedBy: null,
            reviewNotes: null
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
          reviewedBy: null,
          reviewNotes: null
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
// Función para validar una fecha y devolver una fecha válida o la fecha actual
function validateDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  try {
    // Intentar crear una fecha válida
    const date = new Date(dateValue);
    
    // Verificar si la fecha es válida (no es NaN y está dentro de un rango razonable)
    if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
      console.warn(`Fecha inválida detectada: ${dateValue}, usando fecha actual`);
      return new Date();
    }
    
    return date;
  } catch (error) {
    console.warn(`Error al procesar fecha: ${dateValue}, usando fecha actual`, error);
    return new Date();
  }
}

// Función para procesar los valores de una fila y crear una entrada InsertExcelData
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData {
  // Procesar fecha de orden con validación
  const orderDate = validateDate(values[2]);
  
  // Procesar fecha de venta con validación
  let saleDate: Date | null = null;
  if (values[12]) {
    try {
      const date = new Date(values[12]);
      if (!isNaN(date.getTime())) {
        saleDate = date;
      }
    } catch (error) {
      console.warn(`Error al procesar fecha de venta: ${values[12]}, usando null`, error);
    }
  }
  
  // Usar el código de tienda de la celda A1 (values[0]) si está disponible
  const excelStoreCode = values[0]?.toString() || '';
  const finalStoreCode = excelStoreCode || storeCode;
  
  return {
    storeCode: finalStoreCode, // Usar el código de tienda de A1 o el proporcionado si A1 está vacío
    orderNumber: values[1]?.toString() || '', // Columna B
    orderDate: orderDate, // Columna C (validada)
    customerName: values[3]?.toString() || '', // Columna D
    customerContact: values[4]?.toString() || '', // Columna E
    itemDetails: values[5]?.toString() || '', // Columna F
    metals: values[6]?.toString() || '', // Columna G
    engravings: values[7]?.toString() || '', // Columna H
    stones: values[8]?.toString() || '', // Columna I
    carats: values[9]?.toString() || '', // Columna J
    price: values[10]?.toString() || '', // Columna K
    pawnTicket: values[11]?.toString() || '', // Columna L
    saleDate: saleDate, // Columna M (validada)
    fileActivityId: activityId
  };
}

// Process Excel file (xls, xlsx, csv)
export async function processExcelFile(filePath: string, activityId: number, storeCode: string) {
  try {
    // Update file activity to Processing status
    await storage.updateFileActivityStatus(activityId, 'Processing');
    emitFileProcessingStatus(activityId, 'Processing');
    
    // Check if the default store exists
    const defaultStore = await storage.getStoreByCode(storeCode);
    if (!defaultStore) {
      throw new Error(`Default store with code ${storeCode} does not exist`);
    }
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    
    // Get file extension
    const fileExt = path.extname(filePath).toLowerCase();
    let processedRows: InsertExcelData[] = [];
    
    // Extracting store code from the file
    let excelStoreCode = '';
    
    // First extract the store code from cell A2 based on the file type
    if (fileExt === '.csv') {
      // Procesar archivo CSV para obtener código de tienda
      const rows: any[] = [];
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
      
      if (rows.length > 1) {
        // Extraer código de tienda de la segunda fila (índice 1)
        const secondRow = rows[1];
        const values = Object.values(secondRow);
        if (values.length > 0) {
          excelStoreCode = values[0]?.toString() || '';
        }
      }
      
      // Continuar con el procesamiento normal
      // Saltar la primera fila (encabezado) e indexar los valores por posición
      rows.forEach((row, index) => {
        if (index === 0) return; // Saltar encabezado
        
        // Extraer valores de las columnas en orden
        const values = Object.values(row);
        console.log("CSV row values:", values);
        processedRows.push(createExcelDataFromValues(values, storeCode, activityId));
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
      
      // Extraer código de tienda si hay al menos una fila después del encabezado
      if (jsonData.length > 1) {
        const secondRow = jsonData[1] as any[];
        if (secondRow && secondRow.length > 0) {
          excelStoreCode = secondRow[0]?.toString() || '';
        }
      }
      
      // Saltar la primera fila (encabezado)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.length > 0) {
          console.log("XLS row values:", row);
          processedRows.push(createExcelDataFromValues(row, storeCode, activityId));
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
      
      // Intentar obtener el código de tienda de la celda A2
      const cellA2 = worksheet.getCell('A2');
      if (cellA2 && cellA2.value) {
        excelStoreCode = cellA2.value.toString();
      }
      
      // Procesar filas (saltar fila de encabezado)
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Saltar fila de encabezado
        if (rowNumber === 1) return;
        
        const values = row.values as any[];
        processedRows.push(createExcelDataFromValues(values, storeCode, activityId));
      });
    }
    
    // Verificar si el código de tienda extraído existe
    if (excelStoreCode && excelStoreCode.trim() !== '') {
      console.log(`Excel file has store code ${excelStoreCode} in cell A2`);
      const excelStore = await storage.getStoreByCode(excelStoreCode);
      
      if (excelStore) {
        console.log(`Found matching store in database: ${excelStore.code}`);
        
        // Actualizar la actividad del archivo con el código correcto
        // Actualizar el código de tienda en la actividad
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          await storage.updateFileActivityStatus(
            activityId, 
            'Processing'
          );
        }
        
        // Actualizar todos los registros para usar el código de tienda correcto
        for (const row of processedRows) {
          row.storeCode = excelStore.code;
        }
      } else {
        console.warn(`Store code ${excelStoreCode} from Excel file does not exist in database, using default: ${storeCode}`);
      }
    } else {
      console.log(`No store code found in Excel file, using default: ${storeCode}`);
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
