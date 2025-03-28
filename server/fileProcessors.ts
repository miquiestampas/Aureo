import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { emitFileProcessingStatus } from './fileWatcher';
import { InsertExcelData, InsertPdfDocument, InsertAlert, ExcelData, FileActivity } from '@shared/schema';
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
// Función para normalizar texto eliminando caracteres especiales, espacios extras y convirtiendo a minúsculas
function normalizeText(text: string, isStoreCode: boolean = false): string {
  if (!text) return '';
  
  // Convertir a minúsculas primero
  let normalized = text.toLowerCase();
  
  // Normalizaciones específicas para códigos de tienda
  if (isStoreCode) {
    // Eliminar todos los puntos y espacios para códigos de tienda
    normalized = normalized
      .replace(/\./g, '') // Eliminar todos los puntos
      .replace(/\s+/g, ''); // Eliminar todos los espacios
  }
  
  // Normalización general para cualquier texto
  normalized = normalized
    .normalize('NFD') // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos
    .replace(/[^a-z0-9\s]/g, ''); // Elimina caracteres especiales y guiones
    
  // Para textos que no son código de tienda, mantener formato de espacios
  if (!isStoreCode) {
    normalized = normalized
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios con uno solo
      .trim(); // Elimina espacios al inicio y final
  }
  
  return normalized;
}

// Función para calcular la similitud entre dos textos
function calculateSimilarity(text1: string, text2: string, fieldType: 'store_code' | 'name' | 'id' | 'description' | 'generic' = 'generic'): { score: number, isExact: boolean } {
  // Normaliza ambos textos según el tipo de campo
  const isStoreCode = fieldType === 'store_code';
  const normalizedText1 = normalizeText(text1, isStoreCode);
  const normalizedText2 = normalizeText(text2, isStoreCode);
  
  console.log(`Comparando: "${text1}" con "${text2}" | Normalizados: "${normalizedText1}" y "${normalizedText2}" (tipo: ${fieldType})`);
  
  // Si alguno de los textos está vacío después de normalizar, retorna 0
  if (!normalizedText1 || !normalizedText2) {
    return { score: 0, isExact: false };
  }
  
  // Verificar si hay una coincidencia exacta después de normalizar
  if (normalizedText1 === normalizedText2) {
    console.log(`¡Coincidencia EXACTA encontrada! "${text1}" ≡ "${text2}"`);
    return { score: 1, isExact: true };
  }
  
  // Verificar si uno está contenido en el otro (especialmente útil para códigos)
  if (normalizedText1.includes(normalizedText2) || normalizedText2.includes(normalizedText1)) {
    // La puntuación depende de la longitud relativa
    const longerText = normalizedText1.length > normalizedText2.length ? normalizedText1 : normalizedText2;
    const shorterText = normalizedText1.length <= normalizedText2.length ? normalizedText1 : normalizedText2;
    
    // Si el texto más corto es menos del 30% del más largo, reducir la puntuación
    const lengthRatio = shorterText.length / longerText.length;
    let score: number;
    
    if (isStoreCode) {
      // Para códigos de tienda, ser más permisivo
      score = Math.max(0.85, 0.85 + (0.15 * lengthRatio));
      console.log(`Coincidencia PARCIAL (código): "${text1}" y "${text2}" - Score: ${score.toFixed(2)}`);
    } else if (lengthRatio < 0.3) {
      score = 0.7 + (0.25 * lengthRatio); // entre 0.7 y 0.95
      console.log(`Coincidencia PARCIAL (inclusión con ratio bajo): "${text1}" y "${text2}" - Score: ${score.toFixed(2)}`);
    } else {
      score = 0.95;
      console.log(`Coincidencia PARCIAL (inclusión fuerte): "${text1}" y "${text2}" - Score: ${score.toFixed(2)}`);
    }
    
    return { score, isExact: false };
  }
  
  // Códigos de tienda: verificar si los números coinciden (ignorando letras)
  if (isStoreCode) {
    const numbers1 = normalizedText1.replace(/[^0-9]/g, '');
    const numbers2 = normalizedText2.replace(/[^0-9]/g, '');
    
    if (numbers1 && numbers2 && (numbers1.includes(numbers2) || numbers2.includes(numbers1))) {
      const score = 0.8; // Alta puntuación para coincidencia numérica en códigos
      console.log(`Coincidencia NUMÉRICA de códigos: "${text1}" y "${text2}" - Score: ${score.toFixed(2)}`);
      return { score, isExact: false };
    }
  }
  
  // Para IDs y números, ser más estricto
  if (fieldType === 'id') {
    // Si los textos tienen números, verificar si hay coincidencia parcial en los números
    const numbers1 = normalizedText1.replace(/[^0-9]/g, '');
    const numbers2 = normalizedText2.replace(/[^0-9]/g, '');
    
    if (numbers1.length > 4 && numbers2.length > 4) {
      // Verificar si al menos el 80% de los dígitos coinciden
      const minLength = Math.min(numbers1.length, numbers2.length);
      let matchingDigits = 0;
      
      for (let i = 0; i < minLength; i++) {
        if (numbers1.includes(numbers2.charAt(i))) matchingDigits++;
      }
      
      const digitMatchRatio = matchingDigits / minLength;
      if (digitMatchRatio > 0.8) {
        const score = 0.7 + (0.3 * digitMatchRatio); // entre 0.7 y 1.0
        console.log(`Coincidencia NUMÉRICA en ID: "${text1}" y "${text2}" - Score: ${score.toFixed(2)}`);
        return { score, isExact: false };
      }
    }
  }
  
  // Para descripciones y nombres, utilizar similitud por palabras compartidas
  if (fieldType === 'description' || fieldType === 'name' || fieldType === 'generic') {
    // Calcular similitud por palabras compartidas
    const words1 = normalizedText1.split(' ').filter(w => w.length > 2); // Ignorar palabras muy cortas
    const words2 = normalizedText2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) {
      return { score: 0, isExact: false };
    }
    
    // Contar palabras compartidas exactas
    const exactMatches = words1.filter(word => words2.includes(word)).length;
    
    // Contar palabras con coincidencia parcial (una contiene a la otra)
    const partialMatches = words1.filter(word => 
      !words2.includes(word) && // No contar las ya contadas como exactas
      words2.some(w2 => w2.includes(word) || word.includes(w2))
    ).length;
    
    // Dar más peso a las coincidencias exactas
    const wordScore = (exactMatches + (partialMatches * 0.5)) / Math.max(words1.length, words2.length);
    const score = Math.min(0.9, wordScore);
    
    console.log(`Coincidencia por PALABRAS: "${text1}" y "${text2}" - Exactas: ${exactMatches}, Parciales: ${partialMatches}, Score: ${score.toFixed(2)}`);
    
    return { score, isExact: false };
  }
  
  // Por defecto, baja similitud
  return { score: 0.2, isExact: false };
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
        // Calcular similitud de nombre usando la nueva función con tipo 'name'
        const nameSimilarity = calculateSimilarity(excelData.customerName, person.fullName, 'name');
        
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
            tipoCoincidencia: "Persona" as "Persona" | "Objeto",
            idSenalPersona: person.id,
            idSenalObjeto: null,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: nameSimilarity.isExact ? "Exacto" : "Parcial" as "Exacto" | "Parcial",
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
        const idSimilarity = calculateSimilarity(excelData.customerContact, person.identificationNumber, 'id');
        
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
            tipoCoincidencia: "Persona" as "Persona" | "Objeto",
            idSenalPersona: person.id,
            idSenalObjeto: null,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: idSimilarity.isExact ? "Exacto" : "Parcial" as "Exacto" | "Parcial",
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
        const descSimilarity = calculateSimilarity(excelData.itemDetails, item.description, 'description');
        
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
            tipoCoincidencia: "Objeto" as "Persona" | "Objeto",
            idSenalPersona: null,
            idSenalObjeto: item.id,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: descSimilarity.isExact ? "Exacto" : "Parcial" as "Exacto" | "Parcial",
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
        const serialSimilarity = calculateSimilarity(excelData.itemDetails, item.serialNumber, 'id');
        
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
            tipoCoincidencia: "Objeto" as "Persona" | "Objeto",
            idSenalPersona: null,
            idSenalObjeto: item.id,
            idExcelData: excelData.id,
            puntuacionCoincidencia: confidence,
            tipoMatch: serialSimilarity.isExact ? "Exacto" : "Parcial" as "Exacto" | "Parcial",
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
// Mapeo correcto de columnas (basado en la imagen enviada por el usuario):
// A=código tienda, B=número de orden, C=fecha, D=nombre cliente, E=DNI/pasaporte, 
// F=dirección, G=provincia/país, H=objeto, I=peso, J=clase de metal, 
// K=grabaciones/nº serie, L=piedras/kilates, M=precio, N=empeño, O=fecha venta
function createExcelDataFromValues(values: any[], storeCode: string, activityId: number): InsertExcelData | null {
  console.log(`Procesando valores para Excel: ${JSON.stringify(values)}`);
  
  // Si los valores son null, undefined o un array vacío, retornar null
  if (!values || !Array.isArray(values) || values.length < 4) {
    console.log("Ignorando fila con datos insuficientes");
    return null;
  }
  
  // Verificar si estamos trabajando con valores desplazados
  // En un array estándar, values[0] generalmente es undefined o un valor interno
  // Por lo que empezamos desde values[1] por precaución
  
  // Ajuste para manejar arrays que comienzan con un offset
  const hasOffset = (values[0] === undefined || values[0] === null) && values.length > 1;
  const offset = hasOffset ? 1 : 0;
  
  console.log(`Usando offset: ${offset} para valores ${JSON.stringify(values.slice(0, 5))}`);
  
  // Columna A: Código de tienda (si está presente en el archivo)
  let excelStoreCode = '';
  if (values[offset] !== undefined && values[offset] !== null) {
    if (typeof values[offset] === 'string') {
      excelStoreCode = values[offset].trim(); 
    } else if (typeof values[offset].toString === 'function') {
      excelStoreCode = values[offset].toString().trim();
    }
  }
  // Si no tenemos código de tienda en la celda ni como parámetro, no podemos procesar la fila
  const finalStoreCode = excelStoreCode || storeCode;
  if (!finalStoreCode) {
    console.log("Ignorando fila sin código de tienda");
    return null;
  }
  
  if (excelStoreCode) {
    console.log(`Excel file has store code ${excelStoreCode} in cell A`);
  }
  
  // Columna B: Número de orden
  const orderNumber = values[offset + 1]?.toString().trim() || '';
  if (!orderNumber) {
    console.log("Ignorando fila sin número de orden");
    return null;
  }
  
  // Columna C: Fecha de orden
  let orderDate;
  try {
    orderDate = validateDate(values[offset + 2]);
    if (!values[offset + 2] || isNaN(orderDate.getTime())) {
      console.log("Ignorando fila sin fecha de orden válida");
      return null;
    }
  } catch (error) {
    console.log("Ignorando fila con fecha de orden inválida");
    return null;
  }
  
  // Columna D: Nombre del cliente
  const customerName = values[offset + 3]?.toString().trim() || '';
  if (!customerName) {
    console.log("Ignorando fila sin nombre del cliente");
    return null;
  }
  
  // Columna E: Contacto del cliente (DNI/Pasaporte)
  const customerContact = values[offset + 4]?.toString().trim() || '';
  
  // Columna F y G: Dirección y Provincia (guardamos información combinada en un campo)
  const addressInfo = [
    values[offset + 5]?.toString().trim() || '', // Dirección
    values[offset + 6]?.toString().trim() || ''  // Provincia/país
  ].filter(Boolean).join(', ');
  
  // Columna H: Objeto (Detalles del artículo)
  const itemDetails = values[offset + 7]?.toString().trim() || '';
  
  // Columna I: Peso
  const weight = values[offset + 8]?.toString().trim() || '';
  
  // Columna J: Clase de metal
  const metals = values[offset + 9]?.toString().trim() || '';
  
  // Columna K: Grabaciones/Número de serie
  const engravings = values[offset + 10]?.toString().trim() || '';
  
  // Columna L: Piedras/Kilates
  const stones = values[offset + 11]?.toString().trim() || '';
  
  // Quilates, extraemos del mismo campo que piedras o procesamos si está separado
  const carats = stones && stones.match(/(\d+(\.\d+)?)\s*[kK]/) ? 
                stones.match(/(\d+(\.\d+)?)\s*[kK]/)![1] : 
                '';
  
  // Columna M: Precio
  const price = values[offset + 12]?.toString().trim() || '';
  
  // Columna N: Empeño (Boleta)
  const pawnTicket = values[offset + 13]?.toString().trim() || '';
  
  // Columna O: Fecha de venta
  let saleDate: Date | null = null;
  if (values[offset + 14]) {
    try {
      const date = validateDate(values[offset + 14]);
      if (date && !isNaN(date.getTime())) {
        saleDate = date;
      }
    } catch (error) {
      console.warn(`Error al procesar fecha de venta: ${values[offset + 14]}, usando null`, error);
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
    
    // Almacenará todos los códigos de tienda únicos encontrados en el archivo
    const uniqueStoreCodes = new Set<string>();
    uniqueStoreCodes.add(storeCode); // Añadir el código de tienda proporcionado por defecto
    
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
      // Procesamos primero los códigos de tienda para recopilación sin esperar operaciones asíncronas
      for (let index = 1; index < rows.length; index++) {
        const row = rows[index];
        
        // Extraer valores de las columnas en orden
        const values = Object.values(row);
        console.log("CSV row values:", values);
        
        // Simplemente extraemos y guardamos los códigos para procesarlos después
        if (values.length > 0 && values[0]) {
          const rowStoreCode = values[0].toString().trim();
          if (rowStoreCode) {
            uniqueStoreCodes.add(rowStoreCode);
          }
        }
        
        // Procesamos los datos
        const excelData = createExcelDataFromValues(values, storeCode, activityId);
        if (excelData) {
          processedRows.push(excelData);
        }
      }
      
      // Ahora procesamos los códigos de tienda de forma asíncrona
      const storeCodesToCheck = Array.from(uniqueStoreCodes);
      uniqueStoreCodes.clear(); // Limpiamos y volveremos a llenar con los códigos validados
      uniqueStoreCodes.add(storeCode); // Añadir de nuevo el código por defecto
      
      for (const codeToCheck of storeCodesToCheck) {
        // 1. Verificar si el código de tienda existe en la base de datos
        const store = await storage.getStoreByCode(codeToCheck);
        if (store) {
          console.log(`Found valid store code: ${codeToCheck}`);
          uniqueStoreCodes.add(codeToCheck);
        } 
        else {
          // 2. Si no existe exactamente, buscar códigos similares
          const allStores = await storage.getStores();
          let foundMatchingStore = false;
          
          for (const store of allStores) {
            // Calcular similitud en códigos de tienda
            const similarity = calculateSimilarity(
              codeToCheck, 
              store.code,
              'store_code'
            );
            
            if (similarity.score >= 0.7) {
              console.log(`Found similar store code: ${store.code} (similarity: ${similarity.score.toFixed(2)})`);
              uniqueStoreCodes.add(store.code);
              foundMatchingStore = true;
              break;
            }
          }
          
          if (!foundMatchingStore) {
            console.log(`No matching store found for code: ${codeToCheck}`);
          }
        }
      }
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
          
          // Extraer código de tienda de la columna A (si existe)
          if (row.length > 0 && row[0]) {
            const rowStoreCode = row[0].toString().trim();
            if (rowStoreCode) {
              // 1. Verificar si el código de tienda existe en la base de datos
              const store = await storage.getStoreByCode(rowStoreCode);
              if (store) {
                console.log(`Found valid store code in row: ${rowStoreCode}`);
                uniqueStoreCodes.add(rowStoreCode);
              } 
              else {
                // 2. Si no existe exactamente, buscar códigos similares
                const allStores = await storage.getStores();
                let foundMatchingStore = false;
                
                for (const store of allStores) {
                  // Calcular similitud en códigos de tienda
                  const similarity = calculateSimilarity(
                    rowStoreCode, 
                    store.code,
                    'store_code'
                  );
                  
                  if (similarity.score >= 0.7) {
                    console.log(`Found similar store code: ${store.code} (similarity: ${similarity.score.toFixed(2)})`);
                    uniqueStoreCodes.add(store.code);
                    foundMatchingStore = true;
                    break;
                  }
                }
                
                if (!foundMatchingStore) {
                  console.log(`No matching store found for code: ${rowStoreCode}`);
                  uniqueStoreCodes.add(storeCode); // Usar código de tienda por defecto
                }
              }
            }
          }
          
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
      worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
        // Saltar fila de encabezado
        if (rowNumber === 1) return;
        
        const values = row.values as any[];
        
        // Extraer código de tienda de la columna A (si existe)
        if (values.length > 1 && values[1]) { // En ExcelJS los índices empiezan en 1, no en 0
          const rowStoreCode = values[1].toString().trim();
          if (rowStoreCode) {
            // 1. Verificar si el código de tienda existe en la base de datos
            const store = await storage.getStoreByCode(rowStoreCode);
            if (store) {
              console.log(`Found valid store code in row: ${rowStoreCode}`);
              uniqueStoreCodes.add(rowStoreCode);
            } 
            else {
              // 2. Si no existe exactamente, buscar códigos similares
              const allStores = await storage.getStores();
              let foundMatchingStore = false;
              
              for (const store of allStores) {
                // Calcular similitud en códigos de tienda
                const similarity = calculateSimilarity(
                  rowStoreCode, 
                  store.code,
                  'store_code'
                );
                
                if (similarity.score >= 0.7) {
                  console.log(`Found similar store code: ${store.code} (similarity: ${similarity.score.toFixed(2)})`);
                  uniqueStoreCodes.add(store.code);
                  foundMatchingStore = true;
                  break;
                }
              }
              
              if (!foundMatchingStore) {
                console.log(`No matching store found for code: ${rowStoreCode}`);
                uniqueStoreCodes.add(storeCode); // Usar código de tienda por defecto
              }
            }
          }
        }
        
        const excelData = createExcelDataFromValues(values, storeCode, activityId);
        if (excelData) {
          processedRows.push(excelData);
        }
      });
    }
    
    // Procesar todos los códigos de tienda únicos encontrados
    const storeCodesArray = Array.from(uniqueStoreCodes);
    console.log(`Códigos de tienda encontrados en el archivo: ${storeCodesArray.join(', ')}`);
    
    // Primero, verificar si el código principal de A2 existe
    if (excelStoreCode && excelStoreCode.trim() !== '') {
      console.log(`Excel file has main store code ${excelStoreCode} in cell A2`);
      const excelStore = await storage.getStoreByCode(excelStoreCode);
      
      if (excelStore) {
        console.log(`Found matching store in database: ${excelStore.code}`);
        uniqueStoreCodes.add(excelStore.code);
        
        // Actualizar la actividad del archivo con el código principal de tienda
        const activity = await storage.getFileActivity(activityId);
        if (activity) {
          try {
            // Actualiza la actividad con el nuevo código de tienda principal
            await storage.updateFileActivityStatus(activityId, 'Processing');
            
            // IMPORTANTE: También actualizamos la variable storeCode para que los datos se procesen con el código correcto
            storeCode = excelStore.code;
            
            console.log(`Updated file activity ${activityId} with main store code: ${excelStore.code}`);
            
            // Actualizar el registro de actividad con el método apropiado
            await storage.updateFileActivity(activityId, { storeCode: excelStore.code });
            console.log(`Updated file activity in database with store code: ${excelStore.code}`);
          } catch (updateError) {
            console.error(`Error updating file activity with main store code:`, updateError);
          }
        }
      } else {
        console.warn(`Main store code ${excelStoreCode} from Excel file does not exist in database.`);
      }
    } else {
      console.log(`No main store code found in cell A2, will use codes from individual rows.`);
    }
    
    // Crear una copia de las filas para procesarlas en cada tienda
    const originalRows = [...processedRows];
    let totalProcessedRows = 0;
    
    // Procesar cada código de tienda encontrado
    for (const currentStoreCode of Array.from(uniqueStoreCodes)) {
      // Verificar si la tienda existe en la base de datos
      const store = await storage.getStoreByCode(currentStoreCode);
      
      if (!store) {
        console.warn(`Store code ${currentStoreCode} does not exist in database, skipping.`);
        continue;
      }
      
      console.log(`Processing data for store: ${currentStoreCode}`);
      
      // Filtrar filas que corresponden a esta tienda o que no tienen un código específico
      const storeRows = originalRows.filter(row => {
        // Si la fila tiene el mismo código que estamos procesando
        if (row.storeCode === currentStoreCode) return true;
        
        // Si la fila no tiene un código específico y estamos en la tienda principal
        if (currentStoreCode === storeCode && (!row.storeCode || row.storeCode === storeCode)) return true;
        
        return false;
      });
      
      if (storeRows.length === 0) {
        console.log(`No rows to process for store ${currentStoreCode}`);
        continue;
      }
      
      console.log(`Processing ${storeRows.length} rows for store ${currentStoreCode}`);
      
      // Asignar código de tienda a todas las filas
      for (const row of storeRows) {
        row.storeCode = currentStoreCode;
        
        // Guardar los datos de Excel
        const savedData = await storage.createExcelData(row);
        
        // Verificar coincidencias con la lista de vigilancia
        await checkWatchlistMatches(savedData);
        
        totalProcessedRows++;
      }
    }
    
    console.log(`Total de registros procesados en todas las tiendas: ${totalProcessedRows}`);
    
    // Si no se procesó ninguna fila, usar el método original con la tienda por defecto
    if (totalProcessedRows === 0) {
      console.log(`No se pudo procesar con múltiples tiendas. Usando tienda por defecto: ${storeCode}`);
      
      // Guardar todos los datos extraídos y verificar coincidencias con la lista de vigilancia
      for (const row of originalRows) {
        row.storeCode = storeCode;
        
        // Guardar los datos de Excel
        const savedData = await storage.createExcelData(row);
        
        // Verificar coincidencias con la lista de vigilancia
        await checkWatchlistMatches(savedData);
      }
    }
    
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
      const pdfStore = await storage.getStoreByCode(pdfStoreCode);
      
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
            await storage.updateFileActivity(activityId, { storeCode: pdfStore.code });
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
        const updates: Partial<FileActivity> = {
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
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      console.warn(`Warning: Could not parse PDF content for type detection: ${errorMessage}`);
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
