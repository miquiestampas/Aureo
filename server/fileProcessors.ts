import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert, ExcelData } from '@shared/schema';
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
// Mapeo de columnas:
// A=código tienda, B=número de orden, C=fecha, D=nombre cliente, E=DNI/pasaporte, 
// F=dirección, G=provincia/país, H=objeto, I=peso, J=clase de metal, 
// K=grabaciones/nº serie, L=piedras/kilates, M=precio, N=empeño, O=fecha venta
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData {
  console.log(`Procesando valores para Excel: ${JSON.stringify(values)}`);
  
  // Columna A: Código de tienda
  const excelStoreCode = values[0]?.toString() || '';
  const finalStoreCode = excelStoreCode || storeCode;
  
  if (excelStoreCode) {
    console.log(`Excel file has store code ${excelStoreCode} in cell A2`);
  }
  
  // Columna B: Número de orden
  const orderNumber = values[1]?.toString() || '';
  
  // Columna C: Fecha de orden
  const orderDate = validateDate(values[2]);
  
  // Columna D: Nombre del cliente
  const customerName = values[3]?.toString() || '';
  
  // Columna E: Contacto del cliente (DNI/Pasaporte)
  const customerContact = values[4]?.toString() || '';
  
  // Columna F y G: Dirección y Provincia (guardamos información combinada en un campo)
  const addressInfo = [
    values[5]?.toString() || '', // Dirección
    values[6]?.toString() || ''  // Provincia/país
  ].filter(Boolean).join(', ');
  
  // Columna H: Objeto (Detalles del artículo)
  const itemDetails = values[7]?.toString() || '';
  
  // Columna I: Peso
  const weight = values[8]?.toString() || '';
  
  // Columna J: Clase de metal
  const metals = values[9]?.toString() || '';
  
  // Columna K: Grabaciones/Número de serie
  const engravings = values[10]?.toString() || '';
  
  // Columna L: Piedras/Kilates
  const stones = values[11]?.toString() || '';
  
  // Quilates, extraemos del mismo campo que piedras o procesamos si está separado
  const carats = stones.match(/(\d+(\.\d+)?)\s*[kK]/) ? 
                stones.match(/(\d+(\.\d+)?)\s*[kK]/)![1] : 
                '';
  
  // Columna M: Precio
  const price = values[12]?.toString() || '';
  
  // Columna N: Empeño (Boleta)
  const pawnTicket = values[13]?.toString() || '';
  
  // Columna O: Fecha de venta
  let saleDate: Date | null = null;
  if (values[14]) {
    try {
      const date = validateDate(values[14]);
      if (date) {
        saleDate = date;
      }
    } catch (error) {
      console.warn(`Error al procesar fecha de venta: ${values[14]}, usando null`, error);
    }
  }
  
  return {
    storeCode: finalStoreCode,
    orderNumber: orderNumber,
    orderDate: orderDate,
    customerName: customerName,
    customerContact: customerContact,
    itemDetails: itemDetails,
    metals: metals,
    engravings: engravings,
    stones: stones,
    carats: carats,
    price: price,
    pawnTicket: pawnTicket,
    saleDate: saleDate,
    fileActivityId: activityId
  };
}

// Process Excel file (xls, xlsx, csv)
export async function processExcelFile(filePath: string, activityId: number, storeCode: string) {
  try {
    // Update file activity to Processing status
    await storage.updateFileActivityStatus(activityId, 'Processing');
    emitFileProcessingStatus(activityId, 'Processing');
    
    // Verificar si la tienda por defecto existe
    let defaultStore = await storage.getStoreByCode(storeCode);
    
    // Si la tienda por defecto no existe, buscar alguna tienda Excel disponible
    if (!defaultStore) {
      console.log(`Default store with code ${storeCode} does not exist, trying to find an Excel store...`);
      const excelStores = await storage.getStoresByType('Excel');
      if (excelStores.length > 0) {
        defaultStore = excelStores[0];
        storeCode = defaultStore.code;
        console.log(`Using existing Excel store as default: ${storeCode}`);
      } else {
        throw new Error(`No Excel stores exist in the system. Please create at least one Excel store.`);
      }
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
        
        // Actualizar la actividad del archivo con el código correcto de tienda
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          try {
            // Actualiza la actividad con el nuevo código de tienda
            await storage.updateFileActivityStatus(activityId, 'Processing');
            
            // IMPORTANTE: También actualizamos la variable storeCode para que los datos se procesen con el código correcto
            storeCode = excelStore.code;
            
            console.log(`Updated file activity ${activityId} with correct store code: ${excelStore.code}`);
            
            // Actualizar el registro de actividad con el método apropiado
            await storage.updateFileActivity(activityId, { storeCode: excelStore.code });
            console.log(`Updated file activity in database with store code: ${excelStore.code}`);
          } catch (updateError) {
            console.error(`Error updating file activity with correct store code:`, updateError);
          }
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
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    
    // Extraer el nombre del archivo para la detección de tienda
    const filename = path.basename(filePath);
    
    // Intentar extraer código de tienda del nombre del archivo PDF
    let pdfStoreCode = '';
    
    // 1. Buscar por patrón J12345ABCDE (formato común que comienza con J seguido de números y letras)
    const j_pattern = /\b(J\d{5}[A-Z0-9]{4,5})\b/i;
    const j_match = filename.match(j_pattern);
      
    if (j_match && j_match[1]) {
      pdfStoreCode = j_match[1];
    }
    // 2. Intentar formato general de códigos: LETRA+NÚMEROS o NÚMEROS+LETRA
    else {
      const general_pattern = /\b([A-Z]\d{1,6}|J\d{2,6}[a-z]{1,3})\b/i;
      const general_match = filename.match(general_pattern);
        
      if (general_match && general_match[1]) {
        pdfStoreCode = general_match[1];
      }
      // 3. Intentar el formato común de tiendas en el sistema
      else {
        const known_stores = ['Montera', 'Central', 'Plaza', 'Norte', 'Sur'];
        for (const knownStore of known_stores) {
          if (filename.toLowerCase().includes(knownStore.toLowerCase())) {
            pdfStoreCode = knownStore;
            break;
          }
        }
      }
    }
    
    // Si hemos detectado un posible código de tienda, verificar que existe en la base de datos
    // y actualizar la actividad de archivo
    if (pdfStoreCode) {
      const pdfStore = await storage.getStoreByCode(pdfStoreCode);
      
      if (pdfStore) {
        console.log(`Found matching store in database for PDF: ${pdfStore.code}`);
        
        // Actualizar la actividad del archivo con el código correcto de tienda
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          try {
            // IMPORTANTE: También actualizamos la variable storeCode para que los datos se procesen con el código correcto
            storeCode = pdfStore.code;
            
            console.log(`Updated PDF file activity ${activityId} with correct store code: ${pdfStore.code}`);
            
            // Actualizar el registro de actividad con el método apropiado
            await storage.updateFileActivity(activityId, { storeCode: pdfStore.code });
            console.log(`Updated PDF activity in database with store code: ${pdfStore.code}`);
          } catch (updateError) {
            console.error(`Error updating PDF activity with correct store code:`, updateError);
          }
        }
      }
    }
    
    // Verificar si el código de tienda existe, si no existe usar un código por defecto
    const store = await storage.getStoreByCode(storeCode);
    if (!store) {
      // Si el código de tienda no existe, intentar usar cualquier tienda PDF existente
      const pdfStores = await storage.getStoresByType('PDF');
      if (pdfStores.length > 0) {
        storeCode = pdfStores[0].code;
        console.log(`Store with code ${storeCode} does not exist, using default PDF store: ${storeCode}`);
      } else {
        throw new Error(`No PDF stores exist in the system. Please create at least one PDF store.`);
      }
    }
    
    // Read file buffer
    const dataBuffer = await fs.promises.readFile(filePath);
    
    // Extract basic info
    const title = path.basename(filePath, '.pdf');
    const fileStats = await fs.promises.stat(filePath);
    const fileSize = fileStats.size;
    
    let documentType = 'PDF';  // Cambiamos el valor por defecto a PDF en lugar de Desconocido
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
