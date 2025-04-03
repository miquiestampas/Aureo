import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert, ExcelData, FileActivity } from '@shared/schema';
import { moveToProcessed, deleteFileIfExists, fileExists, getFileSize } from './fileUtils';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import { read as readXLSX, utils as xlsxUtils } from 'xlsx';
import csvParser from 'csv-parser';

// Funciones de utilidad para el cálculo de similitud entre strings
// Función para calcular distancia de Levenshtein (distancia de edición)
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  // Inicializar matriz
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }
  
  // Rellenar matriz
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitución
          Math.min(
            matrix[i][j - 1] + 1,   // inserción
            matrix[i - 1][j] + 1    // eliminación
          )
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Función para calcular porcentaje de similitud
function calculateSimilarityPercentage(a: string, b: string): number {
  if (a === b) return 100; // Coincidencia exacta
  
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 100; // Ambos strings vacíos
  
  const distance = levenshteinDistance(a, b);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return similarity;
}

// Función para normalizar texto (eliminar acentos, convertir a minúsculas)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^\w\s]/g, '');        // Eliminar símbolos
}

// Función para calcular la similitud entre dos textos
function calculateSimilarity(text1: string, text2: string): { score: number, isExact: boolean } {
  // Normalizar textos
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  // Verificar coincidencia exacta después de normalizar
  if (normalized1 === normalized2) {
    return {
      score: 100,
      isExact: true
    };
  }
  
  // Calcular similitud por distancia de Levenshtein
  const score = calculateSimilarityPercentage(normalized1, normalized2);
  
  return {
    score,
    isExact: false
  };
}

// Función para verificar coincidencias en la watchlist
async function checkWatchlistMatches(excelData: ExcelData) {
  console.log(`Verificando coincidencias en watchlist para ${excelData.documentNumber}`);
  
  // Buscar en señalamientos de personas
  const personWatchlist = await storage.getSenalamientosPersonas();
  
  // Optimización: solo procesar si hay datos en la watchlist
  if (personWatchlist.length > 0) {
    console.log(`Verificando ${personWatchlist.length} señalamientos de personas`);
    
    // Buscar por número de documento
    if (excelData.documentNumber) {
      // Primero buscar coincidencia exacta de documento
      const exactDocumentMatch = personWatchlist.find(item => 
        item.numeroDocumento && 
        item.numeroDocumento.trim().toLowerCase() === excelData.documentNumber.trim().toLowerCase()
      );
      
      if (exactDocumentMatch) {
        console.log(`¡Coincidencia EXACTA por número de documento! ${excelData.documentNumber}`);
        
        const alert: InsertAlert = {
          excelDataId: excelData.id,
          senalamientoId: exactDocumentMatch.id,
          tipo: 'Persona',
          confidence: 100,
          matchField: 'Número de documento',
          status: 'Pendiente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await storage.createAlert(alert);
        console.log(`Alerta creada: coincidencia exacta de documento`);
        
        // No buscar más coincidencias por nombre si ya tenemos una coincidencia exacta de documento
        return;
      }
      
      // Si no hay coincidencia exacta, buscar similitud en documentos
      for (const watchItem of personWatchlist) {
        if (watchItem.numeroDocumento) {
          const similarity = calculateSimilarity(excelData.documentNumber, watchItem.numeroDocumento);
          
          if (similarity.score >= 80) {
            console.log(`Coincidencia similar de documento: ${excelData.documentNumber} ~ ${watchItem.numeroDocumento} (${similarity.score.toFixed(2)}%)`);
            
            const alert: InsertAlert = {
              excelDataId: excelData.id,
              senalamientoId: watchItem.id,
              tipo: 'Persona',
              confidence: similarity.score,
              matchField: 'Número de documento',
              status: 'Pendiente',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await storage.createAlert(alert);
            console.log(`Alerta creada: coincidencia similar de documento`);
          }
        }
      }
    }
    
    // Buscar coincidencias por nombre
    if (excelData.name) {
      // Primero buscar coincidencia exacta por nombre
      const exactNameMatch = personWatchlist.find(item => 
        item.nombre && 
        normalizeText(item.nombre) === normalizeText(excelData.name)
      );
      
      if (exactNameMatch) {
        console.log(`¡Coincidencia EXACTA por nombre! ${excelData.name}`);
        
        const alert: InsertAlert = {
          excelDataId: excelData.id,
          senalamientoId: exactNameMatch.id,
          tipo: 'Persona',
          confidence: 100,
          matchField: 'Nombre',
          status: 'Pendiente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await storage.createAlert(alert);
        console.log(`Alerta creada: coincidencia exacta de nombre`);
      } else {
        // Si no hay coincidencia exacta, buscar similitud en nombres
        for (const watchItem of personWatchlist) {
          if (watchItem.nombre) {
            const similarity = calculateSimilarity(excelData.name, watchItem.nombre);
            
            if (similarity.score >= 70) {
              console.log(`Coincidencia similar de nombre: ${excelData.name} ~ ${watchItem.nombre} (${similarity.score.toFixed(2)}%)`);
              
              const alert: InsertAlert = {
                excelDataId: excelData.id,
                senalamientoId: watchItem.id,
                tipo: 'Persona',
                confidence: similarity.score,
                matchField: 'Nombre',
                status: 'Pendiente',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              await storage.createAlert(alert);
              console.log(`Alerta creada: coincidencia similar de nombre`);
            }
          }
        }
      }
    }
  }
  
  // Buscar en señalamientos de objetos (coincidencias por país y ciudad)
  const objectWatchlist = await storage.getSenalamientosObjetos();
  
  if (objectWatchlist.length > 0 && (excelData.city || excelData.country)) {
    console.log(`Verificando ${objectWatchlist.length} señalamientos de objetos/ubicaciones`);
    
    for (const watchItem of objectWatchlist) {
      let hasMatch = false;
      let matchField = '';
      let confidence = 0;
      
      // Verificar coincidencia por ciudad
      if (excelData.city && watchItem.ubicacion) {
        const citySimilarity = calculateSimilarity(excelData.city, watchItem.ubicacion);
        
        if (citySimilarity.score >= 80) {
          hasMatch = true;
          matchField = 'Ciudad';
          confidence = citySimilarity.score;
          console.log(`Coincidencia de ciudad: ${excelData.city} ~ ${watchItem.ubicacion} (${citySimilarity.score.toFixed(2)}%)`);
        }
      }
      
      // Verificar coincidencia por país
      if (!hasMatch && excelData.country && watchItem.ubicacion) {
        const countrySimilarity = calculateSimilarity(excelData.country, watchItem.ubicacion);
        
        if (countrySimilarity.score >= 85) {
          hasMatch = true;
          matchField = 'País';
          confidence = countrySimilarity.score;
          console.log(`Coincidencia de país: ${excelData.country} ~ ${watchItem.ubicacion} (${countrySimilarity.score.toFixed(2)}%)`);
        }
      }
      
      // Si encontramos coincidencia, crear alerta
      if (hasMatch) {
        const alert: InsertAlert = {
          excelDataId: excelData.id,
          senalamientoId: watchItem.id,
          tipo: 'Objeto',
          confidence: confidence,
          matchField: matchField,
          status: 'Pendiente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await storage.createAlert(alert);
        console.log(`Alerta creada: coincidencia de ${matchField.toLowerCase()}`);
      }
    }
  }
}

// Función para validar/convertir fechas de Excel
function validateDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  let date: Date;
  
  // Si ya es una fecha, usarla directamente
  if (dateValue instanceof Date) {
    date = dateValue;
  }
  // Si es un número, asumir que es un número de Excel (días desde 1900)
  else if (typeof dateValue === 'number') {
    // Convertir fecha de Excel (días desde 1900) a JavaScript Date
    // Excel usa un sistema donde 1 = 1/1/1900
    const excelEpoch = new Date(1899, 11, 30); // 30/12/1899
    date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
  }
  // Si es string, intentar parsearlo
  else if (typeof dateValue === 'string') {
    // Intentar convertir string a fecha
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    } else {
      // Si falla, usar fecha actual
      date = new Date();
    }
  }
  // Por defecto usar fecha actual
  else {
    date = new Date();
  }
  
  return date;
}

// Función para crear un objeto de datos de Excel a partir de valores de fila
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData | null {
  try {
    if (!values || values.length < 5) {
      console.log(`Ignorando fila con datos insuficientes: ${JSON.stringify(values)}`);
      return null; // Ignorar filas sin suficientes columnas
    }
    
    // Estructura aproximada:
    // [fechaCompra, hora, name, documentNumber, importe, ubicación, productos]
    
    // Extraer los valores de las columnas
    const dateValue = values[0];
    const timeValue = values[1];
    const name = values[2];
    const documentNumber = values[3];
    let amount = values[4];
    
    // Validaciones básicas
    if (!name || !documentNumber) {
      console.log(`Ignorando fila sin nombre o documento: ${JSON.stringify(values)}`);
      return null; // Ignorar filas sin datos críticos
    }
    
    // Convertir fecha al formato ISO
    const purchaseDate = validateDate(dateValue);
    const isoDate = purchaseDate.toISOString();
    
    // Convertir importe a número
    if (typeof amount === 'string') {
      // Eliminar símbolos de moneda y separadores de miles
      amount = amount.replace(/[^\d.,]/g, '');
      // Reemplazar coma por punto para decimales
      amount = amount.replace(',', '.');
      amount = parseFloat(amount);
    }
    
    // Si no es un número válido, establecer en 0
    if (isNaN(amount)) {
      amount = 0;
    }
    
    // Extraer ubicación (puede ser "Madrid, España" o similar)
    let location = values[5] || '';
    let city = '';
    let country = '';
    
    if (typeof location === 'string') {
      // Intentar separar ciudad y país
      const parts = location.split(/,\s*/);
      if (parts.length >= 2) {
        city = parts[0].trim();
        country = parts[1].trim();
      } else {
        // Si no hay coma, asumir que es el país
        country = location.trim();
      }
    }
    
    // Extraer productos/conceptos (puede ser un string o un array)
    let products = values[6] || '';
    if (Array.isArray(products)) {
      products = products.join(', ');
    }
    
    // Crear y retornar objeto de datos
    return {
      fileActivityId: activityId,
      storeCode: storeCode,
      orderNumber: documentNumber.toString(), // Usar documentNumber como orderNumber (campo requerido)
      orderDate: isoDate,
      customerName: name.toString(),
      customerContact: documentNumber.toString(),
      customerAddress: city, 
      customerLocation: country,
      itemDetails: products.toString(),
      price: amount,
      // Campos obligatorios según el esquema
      itemWeight: "",
      metals: "",
      engravings: "",
      stones: "",
      carats: "",
      pawnTicket: "",
      saleDate: null
    };
  } catch (error) {
    console.error(`Error al crear objeto de datos de Excel:`, error);
    return null;
  }
}

// Función dinámica para cargar el parser de PDF solo cuando se necesita
async function getPdfParser() {
  try {
    // Importar dinámicamente la librería pdf-parse
    const pdfParse = await import('pdf-parse');
    return pdfParse.default;
  } catch (error) {
    console.error('Error al cargar el parser de PDF:', error);
    throw new Error('No se pudo cargar el parser de PDF');
  }
}

// Main function to process Excel files
export async function processExcelFile(filePath: string, activityId: number, storeCode: string) {
  try {
    // Update file activity to Processing status
    await storage.updateFileActivityStatus(activityId, 'Processing');
    emitFileProcessingStatus(activityId, 'Processing');
    
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }
    
    let processedRows: InsertExcelData[] = [];
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.xlsx' || ext === '.xls') {
      // Process Excel file with ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel file does not contain any worksheet');
      }
      
      // Find header row and extract data rows
      let headerRowIndex = 0;
      let foundHeader = false;
      
      // Buscar la fila de encabezado (máximo primeras 10 filas)
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 10 || foundHeader) return;
        
        const rowValues = row.values as any[];
        if (!rowValues) return;
        
        // Comprobar si esta fila parece un encabezado
        const potentialHeaderValues = Array.isArray(rowValues) ? rowValues.slice(1) : [];
        const headerText = potentialHeaderValues.join(' ').toLowerCase();
        
        if (
          headerText.includes('fecha') || 
          headerText.includes('nombre') || 
          headerText.includes('document') ||
          headerText.includes('id') ||
          headerText.includes('import')
        ) {
          headerRowIndex = rowNumber;
          foundHeader = true;
          console.log(`Found header row at index ${headerRowIndex}`);
        }
      });
      
      // Si no se encontró encabezado, asumir que la primera fila es el encabezado
      if (!foundHeader) {
        headerRowIndex = 1;
        console.log(`No header row found, assuming first row (${headerRowIndex}) is header`);
      }
      
      // Procesar filas de datos (las que están después del encabezado)
      let rowCount = 0;
      let maxRows = 1000; // Para evitar bucles infinitos en archivos grandes
      
      // Función para verificar si una fila está vacía
      const isEmptyRow = (rowValues: any[]) => {
        if (!rowValues || !Array.isArray(rowValues)) return true;
        return rowValues.slice(1).every(val => val === undefined || val === null || val === '');
      };
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRowIndex || rowCount >= maxRows) return;
        
        const rowValues = row.values as any[];
        if (isEmptyRow(rowValues)) return; // Saltar filas vacías
        
        const values = Array.isArray(rowValues) ? rowValues.slice(1) : [];
        
        // Crear objeto de datos
        const excelData = createExcelDataFromValues(values, storeCode, activityId);
        if (excelData) {
          processedRows.push(excelData);
          rowCount++;
        }
      });
      
      console.log(`Processed ${rowCount} data rows from Excel file`);
      
    } else if (ext === '.csv') {
      // Process CSV file
      console.log(`Processing CSV file: ${path.basename(filePath)}`);
      
      // Primero intentar extraer el código de tienda del nombre del archivo
      let extractedStoreCodeFromFilename = '';
      const originalFilename = path.basename(filePath);
      
      // Buscar patrones comunes en nombres de archivo CSV
      // 1. Buscar patrón "J" seguido de números y letras (formato común)
      const jPattern = /\b(J\d{5}[A-Z0-9]{4,5})\b/i;
      const jMatch = originalFilename.match(jPattern);
      
      if (jMatch && jMatch[1]) {
        extractedStoreCodeFromFilename = jMatch[1].toUpperCase();
        console.log(`Extracted store code from CSV filename (format J+5digits+4-5chars): ${extractedStoreCodeFromFilename}`);
      } 
      // 2. Buscar formato de tipo JNNNNAANNN o JNNNNLAAAA
      else {
        const jExtendedPattern = /\b(J\d{4,5}[A-Z]{2}\d{1,5})\b/i;
        const jExtendedMatch = originalFilename.match(jExtendedPattern);
        
        if (jExtendedMatch && jExtendedMatch[1]) {
          extractedStoreCodeFromFilename = jExtendedMatch[1].toUpperCase();
          console.log(`Extracted store code from CSV filename (format JNNNNAA): ${extractedStoreCodeFromFilename}`);
        }
      }
      
      // 3. Si no se encontró con los patrones anteriores, verificar códigos existentes en el nombre del archivo
      if (!extractedStoreCodeFromFilename) {
        // Obtener todos los códigos de tienda existentes
        const allStores = await storage.getStores();
        
        // Verificar si algún código de tienda existente está en el nombre del archivo
        for (const store of allStores) {
          if (originalFilename.toUpperCase().includes(store.code.toUpperCase())) {
            extractedStoreCodeFromFilename = store.code;
            console.log(`Found existing store code in CSV filename: ${extractedStoreCodeFromFilename}`);
            break;
          }
        }
      }
      
      // Leer el archivo CSV
      const rows: any[] = [];
      
      try {
        const csvStream = fs.createReadStream(filePath)
          .pipe(csvParser({
            skipLines: 0,
            headers: false
          }));
        
        // Recolectar todas las filas
        for await (const row of csvStream) {
          rows.push(Object.values(row));
        }
        
        console.log(`CSV file has ${rows.length} rows total`);
      } catch (csvError) {
        console.error(`Error reading CSV file: ${csvError}`);
        throw new Error(`Error al leer archivo CSV: ${csvError.message}`);
      }
      
      // Encontrar fila de cabecera (máximo primeras 15 filas)
      let headerRowIndex = 0;
      let foundHeader = false;
      
      // Palabras clave más comunes en cabeceras de archivos
      const headerKeywords = [
        'fecha', 'date', 'nombre', 'name', 'cliente', 'document', 'documentacion',
        'identificacion', 'id', 'importe', 'import', 'valor', 'value', 'precio', 'price',
        'número', 'nro', 'no.', 'código', 'code', 'concepto', 'articulo', 'item'
      ];
      
      // Buscar fila con máximas coincidencias de palabras clave
      let maxKeywordMatches = 0;
      
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        if (!rows[i] || rows[i].length === 0) continue;
        
        const headerText = rows[i].join(' ').toLowerCase();
        let keywordMatches = 0;
        
        for (const keyword of headerKeywords) {
          if (headerText.includes(keyword)) {
            keywordMatches++;
          }
        }
        
        if (keywordMatches > maxKeywordMatches) {
          maxKeywordMatches = keywordMatches;
          headerRowIndex = i;
          foundHeader = true;
        }
      }
      
      if (foundHeader) {
        console.log(`Found header row at index ${headerRowIndex} with ${maxKeywordMatches} keyword matches`);
        console.log(`Header content: ${rows[headerRowIndex].join(' | ')}`);
      } else if (rows.length > 0) {
        // Si no se encontró cabecera, asumir la primera fila
        headerRowIndex = 0;
        console.log(`No header row found, assuming first row (${headerRowIndex}) is header`);
        console.log(`Assumed header content: ${rows[0].join(' | ')}`);
      }
      
      // Si encontramos código de tienda en el nombre del archivo, usar ese en lugar del proporcionado
      const storeCodeToUse = extractedStoreCodeFromFilename || storeCode;
      console.log(`Using store code for CSV processing: ${storeCodeToUse}`);
      
      // Saltear fila de cabecera y procesar filas de datos
      let validRowsProcessed = 0;
      
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        // Saltear filas vacías
        if (!rows[i] || rows[i].length === 0 || rows[i].every((val: any) => val === undefined || val === null || val === '')) {
          continue;
        }
        
        // Crear objeto de datos
        const excelData = createExcelDataFromValues(rows[i], storeCodeToUse, activityId);
        if (excelData) {
          processedRows.push(excelData);
          validRowsProcessed++;
        }
      }
      
      console.log(`Processed ${validRowsProcessed} valid data rows from CSV file`);
      
      // Si encontramos código de tienda en el nombre del archivo pero es diferente del proporcionado,
      // actualizar la actividad con el código detectado
      if (extractedStoreCodeFromFilename && extractedStoreCodeFromFilename !== storeCode) {
        console.log(`Updating activity ${activityId} with detected store code: ${extractedStoreCodeFromFilename}`);
        try {
          // Comprobar si el código existe en la base de datos
          const storeExists = await storage.getStoreByCode(extractedStoreCodeFromFilename);
          
          if (storeExists) {
            await storage.updateFileActivity(activityId, {
              storeCode: extractedStoreCodeFromFilename
            });
            console.log(`Updated file activity with detected store code: ${extractedStoreCodeFromFilename}`);
          } else {
            console.log(`Detected store code ${extractedStoreCodeFromFilename} not found in database. Will be used as suggestion.`);
            await storage.updateFileActivity(activityId, {
              detectedStoreCode: extractedStoreCodeFromFilename
            });
          }
        } catch (updateError) {
          console.error(`Error updating file activity with detected store code:`, updateError);
        }
      }
      
      console.log(`Processed ${processedRows.length} data rows from CSV file`);
    }
    
    console.log(`Total rows processed from file: ${processedRows.length}`);
    
    // Analizar las primeras filas del Excel para detectar el código de tienda
    // (A menudo el código de tienda está en las primeras filas)
    let excelStoreCode = '';
    const maxRowsToCheck = 10;
    
    // Buscar celda con código de tienda (patrón común: "Tienda: XXX" o similar)
    for (let i = 0; i < Math.min(maxRowsToCheck, processedRows.length); i++) {
      const row = processedRows[i];
      
      // Buscar en diversos campos (nombre, documento, productos, etc.)
      const fieldsToCheck = [row.name, row.documentNumber, row.products, row.city, row.country];
      
      for (const field of fieldsToCheck) {
        if (!field) continue;
        
        // Patrones comunes para códigos de tienda en texto
        const storeCodePatterns = [
          /tienda\s*:\s*([A-Z0-9]+)/i,      // "Tienda: ABC123"
          /store\s*:\s*([A-Z0-9]+)/i,        // "Store: ABC123"
          /local\s*:\s*([A-Z0-9]+)/i,        // "Local: ABC123"
          /código\s*:\s*([A-Z0-9]+)/i,       // "Código: ABC123"
          /code\s*:\s*([A-Z0-9]+)/i          // "Code: ABC123"
        ];
        
        for (const pattern of storeCodePatterns) {
          const match = field.match(pattern);
          if (match && match[1]) {
            excelStoreCode = match[1];
            console.log(`Found store code in data row ${i}: ${excelStoreCode}`);
            break;
          }
        }
        
        if (excelStoreCode) break;
      }
      
      if (excelStoreCode) break;
    }
    
    // Verificar si el código de tienda extraído existe
    if (excelStoreCode && excelStoreCode.trim() !== '') {
      // Normalizar código de tienda (eliminar espacios al inicio y final)
      const normalizedExcelStoreCode = excelStoreCode.trim();
      console.log(`Excel file has store code "${normalizedExcelStoreCode}" in cell A2 (original: "${excelStoreCode}")`);
      
      // Primero intentar búsqueda exacta
      let excelStore = await storage.getStoreByCode(normalizedExcelStoreCode);
      
      // Eliminamos la búsqueda flexible para evitar asignaciones incorrectas
      // Solo permitiremos coincidencias exactas o asignaciones manuales
      if (!excelStore) {
        console.log(`No se encontró tienda con código exacto "${normalizedExcelStoreCode}". Se requerirá asignación manual.`);
        
        // Sólo permitimos coincidencia exacta (eliminando espacios)
        const allStores = await storage.getStores();
        
        // Intentamos sólo coincidencia exacta ignorando espacios
        const storeMatch = allStores.find(store => {
          const storeCodeNoSpaces = store.code.replace(/\s+/g, '').toLowerCase();
          const detectedCodeNoSpaces = normalizedExcelStoreCode.replace(/\s+/g, '').toLowerCase();
          return storeCodeNoSpaces === detectedCodeNoSpaces;
        });
        
        if (storeMatch) {
          console.log(`Encontrada tienda con coincidencia exacta (sin espacios): "${storeMatch.code}"`);
          excelStore = storeMatch;
        }
      }
      
      if (excelStore) {
        console.log(`Found matching store in database: ${excelStore.code}`);
        
        // Actualizar la actividad del archivo con el código correcto de tienda
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          try {
            // IMPORTANTE: También actualizamos la variable storeCode para que los datos se procesen con el código correcto
            storeCode = excelStore.code;
            
            console.log(`Updated file activity ${activityId} with correct store code: ${excelStore.code}`);
            
            // Actualizar el registro de actividad con el método apropiado
            await storage.updateFileActivity(activityId, { 
              storeCode: excelStore.code,
              status: 'Processing' 
            });
            
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
        // Si el código existe en el Excel pero no está en la base de datos,
        // marcar como pendiente de asignación para que el usuario pueda crear la tienda manualmente
        console.warn(`Store code ${excelStoreCode} from Excel file does not exist in database.`);
        console.log(`Marking file activity ${activityId} as PendingStoreAssignment with detected code: ${excelStoreCode}`);
        
        try {
          await storage.updateFileActivity(activityId, {
            status: 'PendingStoreAssignment',
            detectedStoreCode: excelStoreCode
          });
          // Notificar al frontend del cambio de estado
          emitFileProcessingStatus(activityId, 'PendingStoreAssignment');
          console.log(`El archivo ha sido marcado como pendiente de asignación con código sugerido: ${excelStoreCode}`);
          
          // En lugar de lanzar una excepción, retornamos temprano para evitar procesar el archivo
          return;
        } catch (updateError) {
          console.error(`Error updating file activity to PendingStoreAssignment:`, updateError);
        }
      }
    } else {
      console.log(`No store code found in Excel file, using default: ${storeCode}`);
      
      // Si el storeCode es PENDIENTE y no hay código en el Excel, marcar para asignación manual
      if (storeCode === 'PENDIENTE') {
        console.log(`Marking file activity ${activityId} as PendingStoreAssignment because no store code was found.`);
        
        try {
          await storage.updateFileActivity(activityId, {
            status: 'PendingStoreAssignment'
          });
        } catch (updateError) {
          console.error(`Error updating file activity to PendingStoreAssignment:`, updateError);
        }
        
        // Notificar al frontend del cambio de estado
        emitFileProcessingStatus(activityId, 'PendingStoreAssignment');
        console.log(`El archivo ha sido marcado como pendiente de asignación porque no se detectó código de tienda.`);
        
        // En lugar de lanzar error, retornamos temprano para evitar procesar el archivo
        return;
      }
    }
    
    // Guardar todos los datos extraídos
    for (const row of processedRows) {
      // Guardar los datos de Excel
      const savedData = await storage.createExcelData(row);
    }
    
    // Procesar todas las coincidencias usando el nuevo algoritmo mejorado
    console.log(`Procesando coincidencias para todos los registros del archivo con ID ${activityId}...`);
    const { totalCoincidencias } = await storage.detectarCoincidenciasExcelFile(activityId);
    console.log(`Se encontraron ${totalCoincidencias} coincidencias en total`);
    
    // Mover el archivo a la carpeta "procesados" utilizando la función de utilidades
    try {
      // Usar la función centralizada para mover el archivo a procesados
      const newPath = await moveToProcessed(filePath, 'Excel');
      
      if (newPath) {
        console.log(`Archivo Excel movido a ${newPath}`);
      } else {
        console.warn(`Advertencia: No se pudo mover el archivo Excel a la carpeta procesados`);
        
        // Como no se pudo mover, intentar eliminar para evitar reprocesamiento
        if (await deleteFileIfExists(filePath)) {
          console.log(`Archivo original eliminado: ${filePath}`);
        }
      }
    } catch (moveError) {
      console.error(`Error al mover el archivo a la carpeta 'procesados':`, moveError);
      // No fallar el proceso completo si no se puede mover el archivo
      
      // Intentar eliminar el archivo original para evitar reprocesamiento
      if (await deleteFileIfExists(filePath)) {
        console.log(`Archivo original eliminado: ${filePath}`);
      }
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
    const originalFilename = path.basename(filename, path.extname(filename));
    
    // Intentar extraer código de tienda del nombre del archivo PDF
    let pdfStoreCode = '';
    let foundInDatabase = false;
    
    console.log(`Attempting to extract store code from PDF filename: ${filename}`);
    
    // 1. Buscar por patrón J12345ABCDE (formato común que comienza con J seguido de números y letras)
    const j_pattern = /\b(J\d{5}[A-Z0-9]{4,5})\b/i;
    const j_match = originalFilename.match(j_pattern);
      
    if (j_match && j_match[1]) {
      pdfStoreCode = j_match[1];
      console.log(`Pattern 1 matched: ${pdfStoreCode}`);
    }
    // 2. Intentar formato general de códigos: LETRA+NÚMEROS o NÚMEROS+LETRA
    else {
      const general_pattern = /\b([A-Z]\d{1,6}|J\d{2,6}[a-z]{1,3})\b/i;
      const general_match = originalFilename.match(general_pattern);
        
      if (general_match && general_match[1]) {
        pdfStoreCode = general_match[1];
        console.log(`Pattern 2 matched: ${pdfStoreCode}`);
      }
      // 3. Intentar patrones específicos para las tiendas en el sistema
      else {
        // Obtener todos los códigos de tienda existentes
        const allStores = await storage.getStores();
        const storesCodes = allStores.map(store => store.code);
        
        // Buscar si algún código de tienda aparece en el nombre del archivo
        for (const code of storesCodes) {
          if (originalFilename.includes(code)) {
            pdfStoreCode = code;
            console.log(`Found exact store code in filename: ${pdfStoreCode}`);
            break;
          }
        }
        
        // Eliminamos la búsqueda por patrones de tiendas comunes
        // para evitar asignaciones incorrectas (por ejemplo, que Montera 7 se asigne a Montera)
        if (!pdfStoreCode) {
          console.log(`No se encontraron patrones de código de tienda en el nombre del archivo: ${originalFilename}`);
        }
      }
    }
    
    // Si hemos detectado un posible código de tienda, verificar que existe en la base de datos
    if (pdfStoreCode) {
      // Normalizar código de tienda (eliminar espacios al inicio y final)
      const normalizedPdfStoreCode = pdfStoreCode.trim();
      console.log(`PDF file has detected store code "${normalizedPdfStoreCode}" (original: "${pdfStoreCode}")`);
      
      // Primero intentar búsqueda exacta por código
      let pdfStore = await storage.getStoreByCode(normalizedPdfStoreCode);
      
      // Eliminamos la búsqueda flexible para evitar asignaciones incorrectas
      // Solo permitiremos coincidencias exactas o asignaciones manuales
      if (!pdfStore) {
        console.log(`No se encontró tienda con código exacto "${normalizedPdfStoreCode}". Se requerirá asignación manual.`);
        
        // Sólo permitimos coincidencia exacta (eliminando espacios)
        const allStores = await storage.getStores();
        
        // Intentamos sólo coincidencia exacta ignorando espacios
        const storeMatch = allStores.find(store => {
          const storeCodeNoSpaces = store.code.replace(/\s+/g, '').toLowerCase();
          const detectedCodeNoSpaces = normalizedPdfStoreCode.replace(/\s+/g, '').toLowerCase();
          return storeCodeNoSpaces === detectedCodeNoSpaces;
        });
        
        if (storeMatch) {
          console.log(`Encontrada tienda con coincidencia exacta (sin espacios): "${storeMatch.code}"`);
          pdfStore = storeMatch;
        }
      }
      
      if (pdfStore) {
        console.log(`Found matching store in database for PDF: ${pdfStore.code}`);
        foundInDatabase = true;
        
        // Actualizar la actividad del archivo con el código correcto de tienda
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          try {
            // IMPORTANTE: También actualizamos la variable storeCode para que los datos se procesen con el código correcto
            storeCode = pdfStore.code;
            
            console.log(`Updated PDF file activity ${activityId} with correct store code: ${pdfStore.code}`);
            
            // Actualizar el registro de actividad con el método apropiado
            await storage.updateFileActivity(activityId, { 
              storeCode: pdfStore.code, 
              status: 'Processing'
            });
            console.log(`Updated PDF activity in database with store code: ${pdfStore.code}`);
          } catch (updateError) {
            console.error(`Error updating PDF activity with correct store code:`, updateError);
          }
        }
      } else {
        console.log(`Extracted store code '${pdfStoreCode}' not found in database`);
      }
    } else {
      console.log(`No store code pattern matched in filename: ${filename}`);
    }
    
    // Verificar si tenemos un storeCode pasado como parámetro (asignación manual)
    // o si hemos encontrado una tienda válida en la base de datos
    if (storeCode && storeCode !== 'J28aa6') {
      // Tenemos un código de tienda pasado como parámetro que no es el valor por defecto
      console.log(`Using explicitly provided store code for PDF: ${storeCode}`);
      
      // Verificar que la tienda existe en la base de datos
      const store = await storage.getStoreByCode(storeCode);
      if (store) {
        foundInDatabase = true;
        console.log(`Found store in database with code ${storeCode}: ${store.name}`);
        
        // Crear registro de documento PDF
        try {
          // Continuar procesando con el código de tienda proporcionado
          console.log(`Processing PDF with explicitly assigned store: ${storeCode}`);
          
          // Asignar documento PDF
          const pdfDocument: InsertPdfDocument = {
            fileActivityId: activityId,
            storeCode: storeCode,
            path: filePath,
            title: path.basename(filePath, '.pdf'),
            uploadDate: new Date().toISOString(),
            fileSize: (await fs.promises.stat(filePath)).size,
            documentType: 'PDF'
          };
          
          // Guardar documento PDF
          await storage.createPdfDocument(pdfDocument);
          console.log(`Created PDF document record for file ${filename} with store ${storeCode}`);
          
          // Actualizar estado de la actividad a Processed
          await storage.updateFileActivity(activityId, {
            status: 'Processed'
          });
          
          // Notificar al frontend
          emitFileProcessingStatus(activityId, 'Processed');
          
          return;
        } catch (error) {
          console.error(`Error processing PDF with assigned store:`, error);
          throw error;
        }
      } else {
        console.error(`Explicitly provided store code ${storeCode} not found in database`);
      }
    }
    
    // Si no hemos encontrado una tienda válida, poner el archivo en estado de asignación pendiente
    if (!foundInDatabase) {
      console.log(`No matching store found for PDF file ${filename}. Setting to PendingStoreAssignment status.`);
      
      // Si se detectó un posible código pero no existe en la base de datos, lo guardamos
      // para poder sugerir la creación de una nueva tienda con ese código
      try {
        const updates: any = {
          status: 'PendingStoreAssignment',
        };
        
        // Si se detectó algún código, lo guardamos como sugerencia
        if (pdfStoreCode) {
          updates.detectedStoreCode = pdfStoreCode;
          console.log(`Saved detected store code '${pdfStoreCode}' as suggestion for new store`);
        }
        
        // Actualizar el registro de actividad
        await storage.updateFileActivity(activityId, updates);
        console.log(`Updated PDF activity status to PendingStoreAssignment`);
        
        // Notificar al frontend que el archivo necesita asignación de tienda
        emitFileProcessingStatus(activityId, 'PendingStoreAssignment');
        
        // Salir temprano sin procesar el PDF completo
        return;
      } catch (updateError) {
        console.error(`Error updating PDF activity status:`, updateError);
        throw updateError;
      }
      
      // Este código ya no se ejecuta, pero lo dejamos como referencia por si 
      // se quiere volver al comportamiento anterior
      /*
      const pdfStores = await storage.getStoresByType('PDF');
      if (pdfStores.length > 0) {
        storeCode = pdfStores[0].code;
        console.log(`Using default PDF store: ${storeCode}`);
        
        try {
          await storage.updateFileActivity(activityId, { storeCode: storeCode });
          console.log(`Updated PDF activity with default store code: ${storeCode}`);
        } catch (updateError) {
          console.error(`Error updating PDF activity with default store code:`, updateError);
        }
      } else {
        throw new Error(`No PDF stores exist in the system. Please create at least one PDF store.`);
      }
      */
      
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
    } catch (parseError: any) {
      console.warn(`Warning: Could not parse PDF content for type detection: ${parseError.message}`);
      // Continue with unknown document type, we don't want to fail the whole process just for text extraction
    }
    
    // Create PDF document record even if we couldn't parse the content
    // Aseguramos que la fecha se guarde como string para SQLite
    const now = new Date().toISOString();
    const pdfDocument: InsertPdfDocument = {
      storeCode,
      documentType,
      title,
      path: filePath,
      uploadDate: now,
      fileSize,
      fileActivityId: activityId
    };
    
    await storage.createPdfDocument(pdfDocument);
    
    // Mover el archivo a la carpeta "procesados" utilizando la función de utilidades
    try {
      // Usar la función centralizada para mover el archivo a procesados
      const newPath = await moveToProcessed(filePath, 'PDF');
      
      if (newPath) {
        // Actualizar la ruta del documento en la base de datos
        const pathUpdated = await storage.updatePdfDocumentPath(pdfDocument.fileActivityId, newPath);
        if (pathUpdated) {
          console.log(`Actualizada ruta de documento PDF en base de datos: ${newPath}`);
        } else {
          console.warn(`Advertencia: No se pudo actualizar la ruta del documento PDF en la base de datos`);
        }
        
        console.log(`Archivo PDF movido a ${newPath}`);
      } else {
        console.warn(`Advertencia: No se pudo mover el archivo PDF a la carpeta procesados`);
        
        // Como no se pudo mover, intentar eliminar para evitar reprocesamiento
        if (await deleteFileIfExists(filePath)) {
          console.log(`Archivo original eliminado: ${filePath}`);
        }
      }
    } catch (moveError) {
      console.error(`Error al mover el archivo PDF a la carpeta 'procesados':`, moveError);
      // No fallar el proceso completo si no se puede mover el archivo
      
      // Intentar eliminar el archivo original para evitar reprocesamiento
      if (await deleteFileIfExists(filePath)) {
        console.log(`Archivo original eliminado: ${filePath}`);
      }
    }
    
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