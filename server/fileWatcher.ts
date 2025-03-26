import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';
import { processExcelFile, processPdfFile } from './fileProcessors';
import { Server } from 'socket.io';

let excelWatcher: chokidar.FSWatcher | null = null;
let pdfWatcher: chokidar.FSWatcher | null = null;
let io: Server | null = null;

// Set up the Socket.IO server
export function setupSocketIO(server: any) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  io.on('connection', (socket) => {
    console.log('Client connected to file watcher socket');
    
    socket.on('disconnect', () => {
      console.log('Client disconnected from file watcher socket');
    });
  });
  
  return io;
}

// Initialize file watchers based on system configuration
export async function initializeFileWatchers() {
  try {
    // Check if file processing is enabled
    const processingEnabledConfig = await storage.getConfig('FILE_PROCESSING_ENABLED');
    if (!processingEnabledConfig || processingEnabledConfig.value !== 'true') {
      console.log('File processing is disabled in system config');
      return;
    }
    
    // Get configured directory paths
    const excelDirConfig = await storage.getConfig('EXCEL_WATCH_DIR');
    const pdfDirConfig = await storage.getConfig('PDF_WATCH_DIR');
    
    if (!excelDirConfig || !pdfDirConfig) {
      console.error('Directory configuration missing. Please configure EXCEL_WATCH_DIR and PDF_WATCH_DIR');
      return;
    }
    
    const excelDir = excelDirConfig.value;
    const pdfDir = pdfDirConfig.value;
    
    // Ensure directories exist
    await ensureDirectoryExists(excelDir);
    await ensureDirectoryExists(pdfDir);
    
    // Close existing watchers if they exist
    if (excelWatcher) {
      await excelWatcher.close();
    }
    
    if (pdfWatcher) {
      await pdfWatcher.close();
    }
    
    // Solo vigilar los archivos en la raíz del directorio, no en las subcarpetas
    const excelRootDir = path.join(excelDir, '*');
    const pdfRootDir = path.join(pdfDir, '*');
    
    // Asegurarse de que no vigilamos las subcarpetas procesados y errores
    excelWatcher = chokidar.watch(excelRootDir, {
      ignored: [
        /(^|[\/\\])\.\./, // ignore dotfiles
        '**/procesados/**',  // ignore files in procesados folder
        '**/errores/**'      // ignore files in errores folder
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    pdfWatcher = chokidar.watch(pdfRootDir, {
      ignored: [
        /(^|[\/\\])\.\./, // ignore dotfiles
        '**/procesados/**',  // ignore files in procesados folder
        '**/errores/**'      // ignore files in errores folder
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    // Set up event handlers
    excelWatcher.on('add', (filePath) => handleNewExcelFile(filePath));
    pdfWatcher.on('add', (filePath) => handleNewPdfFile(filePath));
    
    console.log(`File watchers initialized. Monitoring Excel files at ${excelDir} and PDF files at ${pdfDir}`);
    
    // Emit status via socket.io
    emitWatcherStatus(true);
    
  } catch (error) {
    console.error('Error initializing file watchers:', error);
    emitWatcherStatus(false);
  }
}

// Stop file watchers
export async function stopFileWatchers() {
  try {
    if (excelWatcher) {
      await excelWatcher.close();
      excelWatcher = null;
    }
    
    if (pdfWatcher) {
      await pdfWatcher.close();
      pdfWatcher = null;
    }
    
    console.log('File watchers stopped');
    emitWatcherStatus(false);
    
  } catch (error) {
    console.error('Error stopping file watchers:', error);
  }
}

// Helper to ensure directory exists
async function ensureDirectoryExists(dir: string) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    throw error;
  }
}

// Handle new Excel file detection
async function handleNewExcelFile(filePath: string) {
  try {
    const filename = path.basename(filePath);
    
    // Buscar todas las tiendas y usar la primera que coincida con el nombre del archivo
    const allStores = await storage.getStores();
    let foundStore = null;
    
    // Primero intentar coincidencia exacta de código
    for (const store of allStores) {
      if (filename.includes(store.code)) {
        foundStore = store;
        console.log(`Excel matched with store by code: ${store.code}`);
        break;
      }
    }
    
    // Si no se encontró coincidencia, intentar con expresiones regulares
    if (!foundStore) {
      // Estrategias para extraer el código de tienda del nombre del archivo
      let storeCode = '';
      
      // 1. Intentar el formato STORECODE_*.xlsx
      const formatMatch = filename.match(/^([^_\.]+)_/);
      if (formatMatch && formatMatch[1]) {
        storeCode = formatMatch[1];
      } 
      // 2. Intentar el formato STORECODE.*.xlsx
      else {
        const dotMatch = filename.match(/^([^\.]+)\./);
        if (dotMatch && dotMatch[1]) {
          storeCode = dotMatch[1];
        }
        // 3. Si no se encontró ningún patrón, usar el nombre completo sin extensión como código
        else {
          const nameWithoutExtension = path.parse(filename).name;
          storeCode = nameWithoutExtension;
        }
      }
      
      // Intentar buscar la tienda con el código extraído
      foundStore = await storage.getStoreByCode(storeCode);
      
      // Si aún no hay coincidencia, usar la primera tienda Excel disponible
      if (!foundStore) {
        const excelStores = await storage.getStoresByType('Excel');
        if (excelStores.length > 0) {
          foundStore = excelStores[0];
          console.log(`No store match found for ${filename}, using default Excel store: ${foundStore.code}`);
        }
      }
    }
    
    if (!foundStore) {
      console.warn(`Warning: No suitable store found for ${filename}`);
      
      // Crear actividad de archivo con estado Failed
      const activity = await storage.createFileActivity({
        filename,
        storeCode: "UNKNOWN",
        fileType: 'Excel',
        status: 'Failed',
        processingDate: new Date(),
        processedBy: 'System',
        errorMessage: `No se encontró una tienda adecuada para este archivo.`,
        metadata: null
      });
      
      // Emit file detection and failure
      emitFileDetected({
        id: activity.id,
        filename,
        storeCode: "UNKNOWN",
        fileType: 'Excel',
        status: 'Failed'
      });
      
      emitFileProcessingStatus(activity.id, 'Failed', `No se encontró una tienda adecuada para este archivo.`);
      return;
    }
    
    const storeCode = foundStore.code;
    console.log(`Excel file ${filename} will be processed for store: ${storeCode}`);
    
    // Crear actividad de archivo
    const activity = await storage.createFileActivity({
      filename,
      storeCode,
      fileType: 'Excel',
      status: 'Pending',
      processingDate: new Date(),
      processedBy: 'System',
      errorMessage: null,
      metadata: null
    });
    
    // Emit file detection event
    emitFileDetected({
      id: activity.id,
      filename,
      storeCode,
      fileType: 'Excel',
      status: 'Pending'
    });
    
    // Process the file
    await processExcelFile(filePath, activity.id, storeCode);
    
  } catch (error) {
    console.error(`Error handling Excel file ${filePath}:`, error);
  }
}

// Handle new PDF file detection
async function handleNewPdfFile(filePath: string) {
  try {
    const filename = path.basename(filePath);
    const filenameWithoutExt = path.basename(filename, path.extname(filename));
    
    // NOMBRE DEL ARCHIVO = CÓDIGO DE TIENDA
    // Extraer el nombre base del archivo sin la extensión y usar como código de tienda
    
    // Si hay guiones o underscores, usar solo la primera parte
    let storeCode = filenameWithoutExt.split(/[-_]/)[0];
    
    // Eliminar cualquier UNKNOWN_ prefijo si existe
    if (storeCode.startsWith('UNKNOWN_')) {
      storeCode = storeCode.substring(8);
    }
    
    console.log(`Using filename as store code: ${storeCode}`);
    
    // Buscar la tienda por código exacto
    let foundStore = await storage.getStoreByCode(storeCode);
    
    // Si no se encuentra la tienda por código, buscar todas las tiendas y usar la primera que coincida
    if (!foundStore) {
      console.log(`Store with code ${storeCode} not found, looking for similar matches`);
      
      // Buscar todas las tiendas PDF
      const allStores = await storage.getStores();
      const pdfStores = allStores.filter(store => store.type === 'PDF');
      
      // Si el nombre tiene números, buscar coincidencia parcial basada en los dígitos
      const fileDigits = storeCode.match(/\d+/g) || [];
      
      if (fileDigits.length > 0) {
        console.log(`Extracted digits from filename ${filename}:`, fileDigits);
        
        // Ordenamos las tiendas por longitud de código (más largo primero)
        const sortedStores = pdfStores.sort((a, b) => b.code.length - a.code.length);
        
        for (const store of sortedStores) {
          // Extraer los dígitos del código de la tienda
          const storeDigits = store.code.match(/\d+/g) || [];
          
          // Comprobar si alguno de los grupos de dígitos del archivo contiene alguno de los grupos de dígitos de la tienda
          const matchFound = storeDigits.some(storeDigit => 
            fileDigits.some(fileDigit => fileDigit.includes(storeDigit) || storeDigit.includes(fileDigit))
          );
          
          if (matchFound) {
            foundStore = store;
            console.log(`PDF matched with store by digit comparison: ${store.code}`);
            break;
          }
        }
      }
      
      // Intentar buscar la tienda con el código extraído
      foundStore = await storage.getStoreByCode(storeCode);
      
      // Si aún no hay coincidencia, usar la primera tienda PDF disponible
      if (!foundStore) {
        const pdfStores = await storage.getStoresByType('PDF');
        if (pdfStores.length > 0) {
          foundStore = pdfStores[0];
          console.log(`No store match found for ${filename}, using default PDF store: ${foundStore.code}`);
        }
      }
    }
    
    if (!foundStore) {
      console.warn(`Warning: No suitable store found for ${filename}`);
      
      // Crear actividad de archivo con estado Failed
      const activity = await storage.createFileActivity({
        filename,
        storeCode: "UNKNOWN",
        fileType: 'PDF',
        status: 'Failed',
        processingDate: new Date(),
        processedBy: 'System',
        errorMessage: `No se encontró una tienda adecuada para este archivo.`,
        metadata: null
      });
      
      // Emit file detection and failure
      emitFileDetected({
        id: activity.id,
        filename,
        storeCode: "UNKNOWN",
        fileType: 'PDF',
        status: 'Failed'
      });
      
      emitFileProcessingStatus(activity.id, 'Failed', `No se encontró una tienda adecuada para este archivo.`);
      return;
    }
    
    // Actualizar el código de tienda con el código de la tienda encontrada
    storeCode = foundStore.code;
    console.log(`PDF file ${filename} will be processed for store: ${storeCode}`);
    
    // Crear actividad de archivo
    const activity = await storage.createFileActivity({
      filename,
      storeCode,
      fileType: 'PDF',
      status: 'Pending',
      processingDate: new Date(),
      processedBy: 'System',
      errorMessage: null,
      metadata: null
    });
    
    // Emit file detection event
    emitFileDetected({
      id: activity.id,
      filename,
      storeCode,
      fileType: 'PDF',
      status: 'Pending'
    });
    
    // Process the file
    await processPdfFile(filePath, activity.id, storeCode);
    
  } catch (error) {
    console.error(`Error handling PDF file ${filePath}:`, error);
  }
}

// Socket.IO event emitters
function emitWatcherStatus(active: boolean) {
  if (io) {
    io.emit('watcherStatus', { active });
  }
}

function emitFileDetected(fileInfo: any) {
  if (io) {
    io.emit('fileDetected', fileInfo);
  }
}

export function emitFileProcessingStatus(fileId: number, status: string, errorMessage?: string) {
  if (io) {
    io.emit('fileProcessingStatus', { fileId, status, errorMessage });
  }
}
