import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { db } from './db';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert, ExcelData, pdfDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';

// Función para mover archivos después del procesamiento
async function moveProcessedFile(filePath: string, status: 'Processed' | 'Failed', storeCode: string = 'UNKNOWN', fileActivityId?: number) {
  try {
    // Extraer información del archivo
    const originalFileName = path.basename(filePath);
    
    // Determinar si es un archivo Excel o PDF basado en la extensión
    const extension = path.extname(originalFileName).toLowerCase();
    const isExcel = ['.xlsx', '.xls', '.csv'].includes(extension);
    const fileType = isExcel ? 'excel' : 'pdf';
    const isPdf = !isExcel;
    
    // Carpetas de destino con rutas básicas
    const destFolder = status === 'Processed' ? 'procesados' : 'errores';
    
    // Construir la ruta final con rutas absolutas, empezando desde data/excel o data/pdf
    const rootDir = path.resolve('./data');
    const typeDir = path.join(rootDir, fileType);
    const targetDir = path.join(typeDir, destFolder);
    
    // Formato de la fecha: YYYYMMDD
    const today = new Date();
    const dateFormat = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    
    // Generar el nuevo nombre del archivo según las especificaciones
    // Formato: STORECODE-READDATE.pdf (con guión)
    const newFileName = `${storeCode}-${dateFormat}${extension}`;
    let targetPath = path.join(targetDir, newFileName);
    
    // Si ya existe un archivo con el mismo nombre, añadir un número secuencial
    let counter = 1;
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(targetDir, `${storeCode}-${dateFormat}-${counter}${extension}`);
      counter++;
    }
    
    // Asegurar que los directorios existan
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    
    // Verificar que el archivo origen exista
    if (!fs.existsSync(filePath)) {
      console.error(`No se puede mover ${filePath} porque no existe`);
      return null;
    }
    
    try {
      // Copiar el archivo a su destino final
      await fs.promises.copyFile(filePath, targetPath);
      
      // Eliminar el archivo original solo si la copia fue exitosa
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError) {
        console.error(`No se pudo eliminar el archivo original ${filePath}:`, unlinkError);
        // Continuar a pesar del error - al menos tenemos la copia
      }
      
      console.log(`✅ Archivo ${originalFileName} movido a ${targetPath}`);
      
      // Si es un archivo PDF, necesitamos actualizar la ruta en la base de datos
      if (isPdf && fileActivityId) {
        try {
          // Buscar el documento PDF asociado a esta actividad
          const [pdfDoc] = await db
            .select()
            .from(pdfDocuments)
            .where(eq(pdfDocuments.fileActivityId, fileActivityId));
          
          if (pdfDoc) {
            console.log(`Actualizando ruta del documento PDF ${pdfDoc.id} a ${targetPath}`);
            // Actualizar la ruta del documento
            await storage.updatePdfDocumentPath(pdfDoc.id, targetPath);
          }
        } catch (dbError) {
          console.error(`Error al actualizar ruta del documento PDF:`, dbError);
          // A pesar del error, continuamos con el proceso ya que al menos el archivo fue movido
        }
      }
      
      return targetPath;
    } catch (copyError) {
      console.error(`Error al mover archivo ${filePath}:`, copyError);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error general al mover archivo ${filePath}:`, error);
    return null;
  }
}

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
  
  // Columna H: Objeto (Detalles del artículo)
  const itemDetails = values[7]?.toString() || '';
  
  // Columna J: Clase de metal
  const metals = values[9]?.toString() || '';
  
  // Columna K: Grabaciones/Número de serie
  const engravings = values[10]?.toString() || '';
  
  // Columna L: Piedras/Kilates
  const stones = values[11]?.toString() || '';
  
  // Quilates, extraemos del mismo campo que piedras
  const carats = values[11]?.toString() || '';
  
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
    
    // Mover el archivo a la carpeta de procesados con el formato requerido
    const newPath = await moveProcessedFile(filePath, 'Processed', storeCode);
    
    // Actualizar la actividad con la nueva ruta del archivo si fue movido exitosamente
    if (newPath) {
      await storage.updateFileActivity(activityId, { metadata: { movedTo: newPath } });
    }
    
    console.log(`Archivo procesado correctamente: ${path.basename(filePath)} con ${processedRows.length} registros`);
    
  } catch (error) {
    console.error(`Error al procesar el archivo ${filePath}:`, error);
    
    // Actualizar la actividad del archivo a Failed
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido durante el procesamiento';
    await storage.updateFileActivityStatus(activityId, 'Failed', errorMessage);
    emitFileProcessingStatus(activityId, 'Failed', errorMessage);
    
    // Mover el archivo a la carpeta de errores usando el código de tienda
    const newPath = await moveProcessedFile(filePath, 'Failed', storeCode, activityId);
    
    // Actualizar la actividad con la nueva ruta del archivo si fue movido exitosamente
    if (newPath) {
      await storage.updateFileActivity(activityId, { metadata: { movedTo: newPath } });
    }
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
    
    // NOMBRE DEL ARCHIVO = CÓDIGO DE TIENDA
    // Extraer el nombre base del archivo sin la extensión
    const originalFilename = path.basename(filePath);
    const filenameWithoutExt = path.basename(originalFilename, path.extname(originalFilename));
    
    // Usar el nombre del archivo como código de tienda (sin incluir timestamp o números aleatorios)
    // Si hay guiones o underscores, usar solo la primera parte
    let pdfStoreCode = filenameWithoutExt.split(/[-_]/)[0];
    
    // Eliminar cualquier UNKNOWN_ prefijo si existe
    if (pdfStoreCode.startsWith('UNKNOWN_')) {
      pdfStoreCode = pdfStoreCode.substring(8);
    }
    
    console.log(`Usando nombre de archivo como código de tienda: ${pdfStoreCode}`);
    
    // Si el nombre original ya tiene números, usarlo directamente
    if (pdfStoreCode.match(/\d/)) {
      // Ya tenemos un código válido
    } 
    // Caso de fallback: buscar códigos específicos
    else {
      const known_stores = ['Montera', 'Central', 'Plaza', 'Norte', 'Sur'];
      for (const knownStore of known_stores) {
        if (originalFilename.toLowerCase().includes(knownStore.toLowerCase())) {
          pdfStoreCode = knownStore;
          break;
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
    let title = path.basename(filePath, '.pdf');
    // Eliminar cualquier prefijo UNKNOWN_ si existe
    if (title.startsWith('UNKNOWN_')) {
      title = title.substring(8);
    }
    
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
    
    // Mover el archivo a la carpeta de procesados usando el nuevo formato de nombre
    // Pasamos el activityId para que actualice la ruta del PDF en la base de datos
    const newPath = await moveProcessedFile(filePath, 'Processed', storeCode, activityId);
    
    // Actualizar la actividad con la nueva ruta del archivo si fue movido exitosamente
    if (newPath) {
      // Actualizar la actividad con la nueva ubicación del archivo
      await storage.updateFileActivity(activityId, { 
        metadata: { 
          movedTo: newPath,
          processedSuccessfully: true 
        } 
      });
      
      // Ya no necesitamos este código porque updatePdfDocumentPath se llama desde moveProcessedFile
      // pero lo dejamos comentado por si acaso hay que depurar algo
      /*
      try {
        // Buscar el documento PDF recién creado
        const pdfDocs = await storage.getPdfDocumentsByStore(storeCode);
        const recentDoc = pdfDocs.find(doc => doc.fileActivityId === activityId);
        
        if (recentDoc) {
          // Actualizar la ruta del documento para que apunte a la nueva ubicación
          console.log(`Actualizando ruta del documento PDF: ${recentDoc.id} a ${newPath}`);
          await db.update(pdfDocuments)
            .set({ path: newPath })
            .where(eq(pdfDocuments.id, recentDoc.id));
        }
      } catch (updateError) {
        console.error(`Error actualizando ruta de documento PDF:`, updateError);
        // No fallamos todo el proceso por esto, ya que el archivo ya se procesó correctamente
      }
      */
    }
    
    console.log(`Successfully processed PDF file ${path.basename(filePath)}`);
    
  } catch (error) {
    console.error(`Error processing PDF file ${filePath}:`, error);
    
    // Update file activity to Failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
    await storage.updateFileActivityStatus(activityId, 'Failed', errorMessage);
    emitFileProcessingStatus(activityId, 'Failed', errorMessage);
    
    // Mover el archivo a la carpeta de errores usando el código de tienda
    const newPath = await moveProcessedFile(filePath, 'Failed', storeCode, activityId);
    
    // Actualizar la actividad con la nueva ruta del archivo si fue movido exitosamente
    if (newPath) {
      await storage.updateFileActivity(activityId, { metadata: { movedTo: newPath } });
    }
  }
}
