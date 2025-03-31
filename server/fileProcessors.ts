import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert, ExcelData, FileActivity } from '@shared/schema';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import { read as readXLSX, utils as xlsxUtils } from 'xlsx';
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
// Función para normalizar texto eliminando caracteres especiales, espacios extras y convirtiendo a minúsculas
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD') // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos
    .replace(/[^a-z0-9\s]/g, '') // Elimina caracteres especiales y guiones
    .replace(/\s+/g, ' ') // Reemplaza múltiples espacios con uno solo
    .trim(); // Elimina espacios al inicio y final
}

// Función para calcular la similitud entre dos textos
function calculateSimilarity(text1: string, text2: string): { score: number, isExact: boolean } {
  // Normaliza ambos textos
  const normalizedText1 = normalizeText(text1);
  const normalizedText2 = normalizeText(text2);
  
  // Si alguno de los textos está vacío después de normalizar, retorna 0
  if (!normalizedText1 || !normalizedText2) {
    return { score: 0, isExact: false };
  }
  
  // Verificar si hay una coincidencia exacta después de normalizar
  if (normalizedText1 === normalizedText2) {
    return { score: 1, isExact: true };
  }
  
  // Verificar si uno está contenido en el otro
  if (normalizedText1.includes(normalizedText2) || normalizedText2.includes(normalizedText1)) {
    // La puntuación depende de la longitud relativa
    const longerText = normalizedText1.length > normalizedText2.length ? normalizedText1 : normalizedText2;
    const shorterText = normalizedText1.length <= normalizedText2.length ? normalizedText1 : normalizedText2;
    
    // Si el texto más corto es menos del 30% del más largo, reducir la puntuación
    const lengthRatio = shorterText.length / longerText.length;
    if (lengthRatio < 0.3) {
      return { 
        score: 0.7 + (0.25 * lengthRatio), // entre 0.7 y 0.95
        isExact: false 
      };
    }
    
    return { score: 0.95, isExact: false };
  }
  
  // Calcular similitud por palabras compartidas
  const words1 = normalizedText1.split(' ').filter(w => w.length > 2); // Ignorar palabras muy cortas
  const words2 = normalizedText2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return { score: 0, isExact: false };
  }
  
  // Contar palabras compartidas
  const sharedWords = words1.filter(word => words2.some(w2 => w2 === word || w2.includes(word) || word.includes(w2)));
  
  // Calcular puntuación basada en palabras compartidas
  const score = sharedWords.length / Math.max(words1.length, words2.length);
  
  return { 
    score: Math.min(0.9, score), // Máximo 0.9 para coincidencias parciales por palabras
    isExact: false 
  };
}

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
      if (excelData.customerName && person.fullName) {
        // Calcular similitud de nombre usando la nueva función
        const nameSimilarity = calculateSimilarity(excelData.customerName, person.fullName);
        
        // Crear alerta si la similitud es suficiente (mayor a 0.7 o 70%)
        if (nameSimilarity.score >= 0.7) {
          const confidence = nameSimilarity.score * 100;
          
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
          
          // Crear coincidencia en el sistema con información detallada
          const coincidencia = {
            tipoCoincidencia: "Persona",
            idSenalPersona: person.id,
            idSenalObjeto: null,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: nameSimilarity.isExact ? "Exacto" : "Parcial",
            campoCoincidente: "nombre",
            valorCoincidente: person.fullName
          };
          
          await storage.createCoincidencia(coincidencia);
          await storage.createAlert(alert);
          
          console.log(`🚨 Alerta creada: Coincidencia de persona "${person.fullName}" con confianza ${confidence.toFixed(2)}% (${nameSimilarity.isExact ? 'Exacta' : 'Parcial'})`);
        }
      }
      
      // También verificar por número de identificación si está disponible
      if (excelData.customerContact && person.identificationNumber) {
        // Calcular similitud para el número de identificación
        const idSimilarity = calculateSimilarity(excelData.customerContact, person.identificationNumber);
        
        if (idSimilarity.score >= 0.8) { // Mayor umbral para IDs
          const confidence = idSimilarity.score * 100;
          
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
          
          // Crear coincidencia en el sistema con información detallada
          const coincidencia = {
            tipoCoincidencia: "Persona",
            idSenalPersona: person.id,
            idSenalObjeto: null,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: idSimilarity.isExact ? "Exacto" : "Parcial",
            campoCoincidente: "documento",
            valorCoincidente: person.identificationNumber
          };
          
          await storage.createCoincidencia(coincidencia);
          await storage.createAlert(alert);
          
          console.log(`🚨 Alerta creada: Coincidencia de ID "${person.identificationNumber}" con confianza ${confidence.toFixed(2)}% (${idSimilarity.isExact ? 'Exacta' : 'Parcial'})`);
        }
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
      // Verificar similitud de la descripción del artículo
      if (excelData.itemDetails && item.description) {
        const descSimilarity = calculateSimilarity(excelData.itemDetails, item.description);
        
        if (descSimilarity.score >= 0.65) { // Umbral más bajo para artículos
          const confidence = descSimilarity.score * 100;
          
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
          
          // Crear coincidencia en el sistema con información detallada
          const coincidencia = {
            tipoCoincidencia: "Objeto",
            idSenalPersona: null,
            idSenalObjeto: item.id,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: descSimilarity.isExact ? "Exacto" : "Parcial",
            campoCoincidente: "descripcion",
            valorCoincidente: item.description
          };
          
          await storage.createCoincidencia(coincidencia);
          await storage.createAlert(alert);
          
          console.log(`🚨 Alerta creada: Coincidencia de artículo "${item.description}" con confianza ${confidence.toFixed(2)}% (${descSimilarity.isExact ? 'Exacta' : 'Parcial'})`);
        }
      }
      
      // También verificar por número de serie si está disponible
      if (excelData.itemDetails && item.serialNumber) {
        const serialSimilarity = calculateSimilarity(excelData.itemDetails, item.serialNumber);
        
        if (serialSimilarity.score >= 0.85) { // Mayor umbral para números de serie
          const confidence = serialSimilarity.score * 100;
          
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
          
          // Crear coincidencia en el sistema con información detallada
          const coincidencia = {
            tipoCoincidencia: "Objeto",
            idSenalPersona: null,
            idSenalObjeto: item.id,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: serialSimilarity.isExact ? "Exacto" : "Parcial",
            campoCoincidente: "serial",
            valorCoincidente: item.serialNumber
          };
          
          await storage.createCoincidencia(coincidencia);
          await storage.createAlert(alert);
          
          console.log(`🚨 Alerta creada: Coincidencia de número de serie "${item.serialNumber}" con confianza ${confidence.toFixed(2)}% (${serialSimilarity.isExact ? 'Exacta' : 'Parcial'})`);
        }
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
    // Excel puede entregar diferentes formatos de fecha
    let date;
    
    if (typeof dateValue === 'number') {
      // Si es un número, podría ser un serial de Excel 
      // (días desde 1/1/1900 para Windows, o 1/1/1904 para Mac)
      const excelEpoch = new Date(1899, 11, 30); // 30/12/1899
      date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    } else if (dateValue instanceof Date) {
      // Si ya es un objeto Date, usarlo directamente
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // Si es un string, convertirlo a Date
      date = new Date(dateValue);
    } else {
      // Para otros casos, intentar convertir a string y luego a Date
      date = new Date(String(dateValue));
    }
    
    // Verificar si la fecha es válida (no es NaN y está dentro de un rango razonable)
    if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
      console.warn(`Fecha inválida detectada: ${dateValue} (tipo: ${typeof dateValue}), usando fecha actual`);
      return new Date();
    }
    
    console.log(`Fecha procesada correctamente: ${dateValue} -> ${date.toISOString()}`);
    return date;
  } catch (error) {
    console.warn(`Error al procesar fecha: ${dateValue} (tipo: ${typeof dateValue}), usando fecha actual`, error);
    return new Date();
  }
}

// Función para procesar los valores de una fila y crear una entrada InsertExcelData
// Mapeo correcto de columnas (basado en la imagen enviada por el usuario):
// A=código tienda, B=número de orden, C=fecha, D=nombre cliente, E=DNI/pasaporte, 
// F=dirección, G=provincia/país, H=objeto, I=peso, J=clase de metal, 
// K=grabaciones/nº serie, L=piedras/kilates, M=precio, N=empeño, O=fecha venta
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData | null {
  console.log(`Procesando valores para Excel: ${JSON.stringify(values)}`);
  
  // Si los valores son null, undefined o un array vacío, retornar null
  if (!values || !Array.isArray(values)) {
    console.log("Ignorando fila con valores nulos o no es un array");
    return null;
  }
  
  // Crear una función de ayuda para acceder a valores de forma segura
  const safeGetValue = (index: number, defaultValue: string = ''): string => {
    // Si el índice está fuera de rango o el valor es null/undefined, devolver el valor por defecto
    if (index < 0 || index >= values.length || values[index] === null || values[index] === undefined) {
      return defaultValue;
    }
    
    // Convertir a string y eliminar espacios
    try {
      return values[index].toString().trim();
    } catch (error) {
      console.warn(`Error al convertir valor en índice ${index} a string:`, error);
      return defaultValue;
    }
  };
  
  // Verificar si estamos trabajando con valores desplazados
  // En un array estándar, values[0] generalmente es undefined o un valor interno
  // Por lo que empezamos desde values[1] por precaución
  
  // Ajuste para manejar arrays que comienzan con un offset
  const hasOffset = (values[0] === undefined || values[0] === null) && values.length > 1;
  const offset = hasOffset ? 1 : 0;
  
  console.log(`Usando offset: ${offset} para valores ${JSON.stringify(values.slice(0, 5))}`);
  
  // Columna A: Código de tienda
  const excelStoreCode = safeGetValue(offset);
  // Si no tenemos código de tienda en la celda ni como parámetro, no podemos procesar la fila
  const finalStoreCode = excelStoreCode || storeCode;
  if (!finalStoreCode) {
    console.log("Ignorando fila sin código de tienda");
    return null;
  }
  
  if (excelStoreCode) {
    console.log(`Excel file has store code ${excelStoreCode} in cell A`);
  }
  
  // Columna B: Número de orden (requerido)
  const orderNumber = safeGetValue(offset + 1);
  
  // Si no hay filas suficientes o faltan datos críticos, mostrar más información y salir
  if (values.length < 4 + offset) {
    console.log(`Fila con datos insuficientes. Longitud: ${values.length}, Offset: ${offset}, Valores disponibles: ${JSON.stringify(values)}`);
    return null;
  }
  
  if (!orderNumber) {
    console.log("Ignorando fila sin número de orden");
    return null;
  }
  
  // Columna C: Fecha de orden
  let orderDate;
  try {
    // Obtener valor original para diagnóstico
    const rawOrderDateValue = offset + 2 < values.length ? values[offset + 2] : null;
    console.log(`Valor de fecha original: ${rawOrderDateValue}`);
    
    orderDate = validateDate(rawOrderDateValue);
    if (!rawOrderDateValue || isNaN(orderDate.getTime())) {
      console.log(`Ignorando fila sin fecha de orden válida. Valor: ${rawOrderDateValue}`);
      return null;
    }
  } catch (error) {
    console.log("Ignorando fila con fecha de orden inválida");
    return null;
  }
  
  // Columna D: Nombre del cliente
  const customerName = safeGetValue(offset + 3);
  if (!customerName) {
    console.log("Ignorando fila sin nombre del cliente");
    return null;
  }
  
  // Columna E: Contacto del cliente (DNI/Pasaporte)
  const customerContact = safeGetValue(offset + 4);
  
  // Columna F: Dirección del cliente (campo separado)
  const customerAddress = safeGetValue(offset + 5);
  
  // Columna G: Provincia/País del cliente (campo separado)
  const customerLocation = safeGetValue(offset + 6);
  
  // Columna H: Objeto (Detalles del artículo)
  const itemDetails = safeGetValue(offset + 7);
  
  // Columna I: Peso
  const itemWeight = safeGetValue(offset + 8);
  
  // Columna J: Clase de metal
  const metals = safeGetValue(offset + 9);
  
  // Columna K: Grabaciones/Número de serie
  const engravings = safeGetValue(offset + 10);
  
  // Columna L: Piedras/Kilates
  const stones = safeGetValue(offset + 11);
  
  // Quilates, extraemos del mismo campo que piedras o procesamos si está separado
  let carats = '';
  if (stones) {
    const caratsMatch = stones.match(/(\d+(\.\d+)?)\s*[kK]/);
    if (caratsMatch && caratsMatch[1]) {
      carats = caratsMatch[1];
    }
  }
  
  // Columna M: Precio
  const price = safeGetValue(offset + 12);
  
  // Columna N: Empeño (Boleta)
  const pawnTicket = safeGetValue(offset + 13);
  
  // Columna O: Fecha de venta
  let saleDate: Date | null = null;
  if (offset + 14 < values.length && values[offset + 14]) {
    try {
      const date = validateDate(values[offset + 14]);
      if (date && !isNaN(date.getTime())) {
        saleDate = date;
      }
    } catch (error) {
      console.warn(`Error al procesar fecha de venta: ${safeGetValue(offset + 14)}, usando null`, error);
    }
  }
  
  // Logging para depuración
  console.log(`Datos extraídos: 
    Tienda: ${finalStoreCode}
    Orden: ${orderNumber}
    Fecha: ${orderDate}
    Cliente: ${customerName}
    Contacto: ${customerContact}
    Detalles: ${itemDetails}
    Metales: ${metals}
    Precio: ${price}
  `);
  
  // Verificación final: la fila debe tener al menos los campos obligatorios
  if (!finalStoreCode || !orderNumber || !orderDate || !customerName) {
    console.log("Ignorando fila sin datos obligatorios (código tienda, número de orden, fecha, nombre cliente)");
    return null;
  }
  
  // Convertir todas las fechas a formato ISO string para SQLite
  return {
    storeCode: finalStoreCode,
    orderNumber: orderNumber,
    orderDate: orderDate.toISOString(), // Convertimos Date a string para SQLite
    customerName: customerName,
    customerContact: customerContact,
    customerAddress: customerAddress, // Nuevo campo separado
    customerLocation: customerLocation, // Nuevo campo separado
    itemDetails: itemDetails,
    itemWeight: itemWeight, // Nuevo campo separado
    metals: metals,
    engravings: engravings,
    stones: stones,
    carats: carats,
    price: price,
    pawnTicket: pawnTicket,
    saleDate: saleDate ? saleDate.toISOString() : null, // Convertimos Date a string para SQLite si existe
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
      // Procesar archivo CSV para obtener código de tienda con soporte de caracteres especiales
      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        // Leer el contenido completo del archivo primero para determinar su estructura
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        
        // Log para depuración
        console.log(`Contenido del CSV (primeras 200 caracteres): ${fileContent.substring(0, 200)}...`);
        
        // Detectar el tipo de separador (puede ser que usen punto y coma en lugar de coma)
        const commaCount = (fileContent.match(/,/g) || []).length;
        const semicolonCount = (fileContent.match(/;/g) || []).length;
        const separator = semicolonCount > commaCount ? ';' : ',';
        
        console.log(`Usando separador: "${separator}" (comas: ${commaCount}, punto y coma: ${semicolonCount})`);
        
        // Analizar si el archivo tiene encabezados o no
        const firstLineBreak = fileContent.indexOf('\n');
        const firstLine = firstLineBreak > 0 ? fileContent.substring(0, firstLineBreak) : fileContent;
        const estimatedColumnCount = firstLine.split(separator).length;
        
        console.log(`Primera línea: "${firstLine}"`);
        console.log(`Número estimado de columnas: ${estimatedColumnCount}`);
        
        // Crear headers predeterminados si son necesarios
        const defaultHeaders = Array.from({ length: estimatedColumnCount }, (_, i) => `column${i}`);
        
        // Usar utf8 para asegurar que se leen correctamente los caracteres especiales
        fs.createReadStream(filePath, { encoding: 'utf8' })
          .pipe(csvParser({
            // Opciones para mejorar compatibilidad con caracteres especiales
            separator: separator,    // Usar el separador detectado
            escape: '"',             // Carácter de escape
            quote: '"',              // Carácter de comillas
            strict: false,           // Desactivar modo estricto para ser más tolerante
            skipComments: true,      // Saltar líneas de comentarios
            headers: defaultHeaders, // Usar headers predeterminados si son necesarios
            skipLines: 0             // No saltar líneas al inicio
          }))
          .on('data', (row) => {
            // Procesar los valores que llegan para asegurar que se manejan correctamente
            const processedRow: any = {};
            for (const key in row) {
              const value = row[key];
              // Convertir a string y preservar caracteres especiales
              processedRow[key] = value !== undefined && value !== null ? value.toString() : '';
            }
            rows.push(processedRow);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            console.error("Error al procesar CSV:", error);
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
        
        // Extraer valores de las columnas en orden, asegurando que los caracteres especiales se preserven
        const values = Object.values(row);
        
        // Convertir explícitamente cada valor a string para manejar caracteres especiales
        const processedValues = values.map(val => {
          if (val === null || val === undefined) return '';
          
          // Asegurar que el valor es una cadena y preservar caracteres especiales
          const strVal = val.toString();
          
          // Debug para detectar problemas con caracteres especiales
          if (strVal.includes('�')) {
            console.warn(`Detectado carácter de reemplazo en valor "${strVal}"`);
          }
          
          return strVal;
        });
        
        console.log("CSV row values (processed):", processedValues);
        
        const excelData = createExcelDataFromValues(processedValues, storeCode, activityId);
        if (excelData) {
          processedRows.push(excelData);
        }
      });
    } 
    else if (fileExt === '.xls') {
      // Procesar archivo XLS (formato antiguo) usando la biblioteca XLSX
      const workbook = readXLSX(filePath);
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new Error('El archivo Excel no contiene hojas');
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsxUtils.sheet_to_json(worksheet, { header: 1 });
      
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
          const excelData = createExcelDataFromValues(row, storeCode, activityId);
          if (excelData) {
            processedRows.push(excelData);
          }
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
        const excelData = createExcelDataFromValues(values, storeCode, activityId);
        if (excelData) {
          processedRows.push(excelData);
        }
      });
    }
    
    // Verificar si el código de tienda extraído existe
    if (excelStoreCode && excelStoreCode.trim() !== '') {
      // Normalizar código de tienda (eliminar espacios al inicio y final)
      const normalizedExcelStoreCode = excelStoreCode.trim();
      console.log(`Excel file has store code "${normalizedExcelStoreCode}" in cell A2 (original: "${excelStoreCode}")`);
      
      // Primero intentar búsqueda exacta
      let excelStore = await storage.getStoreByCode(normalizedExcelStoreCode);
      
      // Si no encontramos coincidencia exacta, intentar búsqueda flexible
      if (!excelStore) {
        console.log(`No se encontró tienda con código exacto "${normalizedExcelStoreCode}", intentando búsqueda flexible`);
        
        // Obtener todas las tiendas y buscar una coincidencia ignorando espacios
        const allStores = await storage.getStores();
        
        // Buscar tienda cuyo código sin espacios coincida con el código detectado sin espacios
        const storeMatch = allStores.find(store => {
          const storeCodeNoSpaces = store.code.replace(/\s+/g, '');
          const detectedCodeNoSpaces = normalizedExcelStoreCode.replace(/\s+/g, '');
          return storeCodeNoSpaces === detectedCodeNoSpaces;
        });
        
        if (storeMatch) {
          console.log(`Encontrada tienda con coincidencia flexible: "${storeMatch.code}"`);
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
    
    // Mover el archivo a la carpeta "procesados"
    try {
      // Obtener la configuración del directorio de Excel
      const excelDirConfig = await storage.getConfig('EXCEL_WATCH_DIR');
      if (excelDirConfig) {
        const excelDir = excelDirConfig.value;
        const procesadosDir = path.join(excelDir, 'procesados');
        
        // Asegurarse de que la carpeta existe
        if (!fs.existsSync(procesadosDir)) {
          await fs.promises.mkdir(procesadosDir, { recursive: true });
        }
        
        // Crear la ruta del nuevo archivo
        const fileName = path.basename(filePath);
        const destPath = path.join(procesadosDir, fileName);
        
        // Mover el archivo
        await fs.promises.rename(filePath, destPath);
        console.log(`Archivo movido a ${destPath}`);
      }
    } catch (moveError) {
      console.error(`Error al mover el archivo a la carpeta 'procesados':`, moveError);
      // No fallar el proceso completo si no se puede mover el archivo
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
    // La bandera 'i' al final de la expresión regular hace que la búsqueda sea insensible a mayúsculas/minúsculas
    const j_pattern = /\b(J\d{5}[A-Z0-9]{4,5})\b/i;
    const j_match = originalFilename.match(j_pattern);
      
    if (j_match && j_match[1]) {
      pdfStoreCode = j_match[1]; // Mantener el formato original encontrado para preservar mayúsculas/minúsculas
      console.log(`Pattern 1 matched (case insensitive): ${pdfStoreCode}`);
    }
    // 2. Intentar formato general de códigos: LETRA+NÚMEROS o NÚMEROS+LETRA
    // La bandera 'i' al final de la expresión regular hace que la búsqueda sea insensible a mayúsculas/minúsculas
    else {
      const general_pattern = /\b([A-Z]\d{1,6}|J\d{2,6}[a-z]{1,3})\b/i;
      const general_match = originalFilename.match(general_pattern);
        
      if (general_match && general_match[1]) {
        pdfStoreCode = general_match[1]; // Mantener el formato original encontrado para preservar mayúsculas/minúsculas
        console.log(`Pattern 2 matched (case insensitive): ${pdfStoreCode}`);
      }
      // 3. Intentar patrones específicos para las tiendas en el sistema
      else {
        // Obtener todos los códigos de tienda existentes
        const allStores = await storage.getStores();
        const storesCodes = allStores.map(store => store.code);
        
        // Buscar si algún código de tienda aparece en el nombre del archivo, ignorando diferencias entre mayúsculas y minúsculas
        const originalFilenameLower = originalFilename.toLowerCase();
        for (const code of storesCodes) {
          if (originalFilenameLower.includes(code.toLowerCase())) {
            pdfStoreCode = code; // Mantenemos el código original para preservar el formato de la base de datos
            console.log(`Found store code in filename (case insensitive): ${pdfStoreCode}`);
            break;
          }
        }
        
        // Si todavía no hemos encontrado, buscar por nombres comunes
        if (!pdfStoreCode) {
          const known_stores = ['Montera', 'Central', 'Plaza', 'Norte', 'Sur'];
          for (const knownStore of known_stores) {
            if (originalFilename.toLowerCase().includes(knownStore.toLowerCase())) {
              pdfStoreCode = knownStore;
              console.log(`Found known store name in filename: ${pdfStoreCode}`);
              break;
            }
          }
        }
      }
    }
    
    // Si hemos detectado un posible código de tienda, verificar que existe en la base de datos
    if (pdfStoreCode) {
      // Normalizar código de tienda (eliminar espacios al inicio y final)
      const normalizedPdfStoreCode = pdfStoreCode.trim();
      console.log(`PDF file has detected store code "${normalizedPdfStoreCode}" (original: "${pdfStoreCode}")`);
      
      // Primero intentar búsqueda exacta
      let pdfStore = await storage.getStoreByCode(normalizedPdfStoreCode);
      
      // Si no encontramos coincidencia exacta, intentar búsqueda flexible
      if (!pdfStore) {
        console.log(`No se encontró tienda con código exacto "${normalizedPdfStoreCode}", intentando búsqueda flexible`);
        
        // Obtener todas las tiendas y buscar una coincidencia ignorando espacios
        const allStores = await storage.getStores();
        
        // Buscar tienda cuyo código sin espacios coincida con el código detectado sin espacios,
        // ignorando diferencias entre mayúsculas y minúsculas
        const storeMatch = allStores.find(store => {
          const storeCodeNoSpaces = store.code.replace(/\s+/g, '').toLowerCase();
          const detectedCodeNoSpaces = normalizedPdfStoreCode.replace(/\s+/g, '').toLowerCase();
          return storeCodeNoSpaces === detectedCodeNoSpaces;
        });
        
        if (storeMatch) {
          console.log(`Encontrada tienda con coincidencia flexible: "${storeMatch.code}"`);
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
    
    // Mover el archivo a la carpeta "procesados", manteniendo su nombre original
    try {
      // Obtener la configuración del directorio de PDF
      const pdfDirConfig = await storage.getConfig('PDF_WATCH_DIR');
      if (pdfDirConfig) {
        const pdfDir = pdfDirConfig.value;
        const procesadosDir = path.join(pdfDir, 'procesados');
        
        // Asegurarse de que la carpeta existe
        if (!fs.existsSync(procesadosDir)) {
          await fs.promises.mkdir(procesadosDir, { recursive: true });
        }
        
        // Crear la ruta del nuevo archivo (conservando el nombre original)
        const fileName = path.basename(filePath);
        const destPath = path.join(procesadosDir, fileName);
        
        // Mover el archivo
        await fs.promises.rename(filePath, destPath);
        
        // Actualizar la ruta del documento en la base de datos
        await storage.updatePdfDocumentPath(pdfDocument.fileActivityId, destPath);
        
        console.log(`Archivo PDF movido a ${destPath}`);
      }
    } catch (moveError) {
      console.error(`Error al mover el archivo PDF a la carpeta 'procesados':`, moveError);
      // No fallar el proceso completo si no se puede mover el archivo
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
