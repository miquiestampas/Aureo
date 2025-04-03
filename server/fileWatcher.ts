import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';
import { processExcelFile, processPdfFile } from './fileProcessors';
import { fileExists, deleteFileIfExists, moveToProcessed } from './fileUtils';
import { Server } from 'socket.io';

let excelWatcher: any | null = null;
let pdfWatcher: any | null = null;
let io: Server | null = null;

// Conjunto para mantener el seguimiento de archivos ya procesados
// y evitar procesamiento duplicado
// Usamos el nombre completo del archivo incluyendo la ruta para evitar duplicados
const processedFiles = new Set<string>();

// Función para cargar archivos ya procesados al iniciar
async function loadProcessedFiles() {
  try {
    console.log('[FileWatcher] Cargando registro de archivos procesados anteriormente...');
    // Buscar archivos en directorios de procesados
    const pdfDirConfig = await storage.getConfig('PDF_WATCH_DIR');
    const excelDirConfig = await storage.getConfig('EXCEL_WATCH_DIR');
    
    if (pdfDirConfig) {
      const pdfProcessedDir = path.join(pdfDirConfig.value, 'procesados');
      if (fileExists(pdfProcessedDir)) {
        const pdfFiles = fs.readdirSync(pdfProcessedDir);
        console.log(`[FileWatcher] Encontrados ${pdfFiles.length} PDFs previamente procesados.`);
        for (const file of pdfFiles) {
          // Guardar la ruta completa y el nombre del archivo
          const fullPath = path.join(pdfProcessedDir, file);
          processedFiles.add(fullPath);
          processedFiles.add(file);
          console.log(`[FileWatcher] Registrado PDF procesado: ${file}`);
        }
      } else {
        console.log(`[FileWatcher] El directorio de PDFs procesados no existe. Se creará cuando sea necesario.`);
      }
    }
    
    if (excelDirConfig) {
      const excelProcessedDir = path.join(excelDirConfig.value, 'procesados');
      if (fileExists(excelProcessedDir)) {
        const excelFiles = fs.readdirSync(excelProcessedDir);
        console.log(`[FileWatcher] Encontrados ${excelFiles.length} Excel previamente procesados.`);
        for (const file of excelFiles) {
          // Guardar la ruta completa y el nombre del archivo
          const fullPath = path.join(excelProcessedDir, file);
          processedFiles.add(fullPath);
          processedFiles.add(file);
          console.log(`[FileWatcher] Registrado Excel procesado: ${file}`);
        }
      } else {
        console.log(`[FileWatcher] El directorio de Excel procesados no existe. Se creará cuando sea necesario.`);
      }
    }
    
    // También añadir archivos que ya tienen actividades en la base de datos
    const activities = await storage.getFileActivities();
    for (const activity of activities) {
      // Solo considerar archivos ya procesados o en procesamiento
      if (activity.status === 'Processed' || activity.status === 'Processing') {
        processedFiles.add(activity.filename);
      }
    }
    
    console.log(`Cargados ${processedFiles.size} archivos en el registro de archivos procesados`);
  } catch (error) {
    console.error('Error al cargar archivos procesados:', error);
  }
}

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
    
    // Cargar archivos ya procesados para evitar reprocesamiento
    await loadProcessedFiles();
    
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
    
    // Initialize new watchers
    excelWatcher = chokidar.watch(excelDir, {
      ignored: [
        /(^|[\/\\])\.\./, // ignore dotfiles
        /procesados/, // ignore 'procesados' subfolder
        path.join(excelDir, 'procesados', '**') // Explícitamente ignorar cualquier archivo en la carpeta procesados
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    pdfWatcher = chokidar.watch(pdfDir, {
      ignored: [
        /(^|[\/\\])\.\./, // ignore dotfiles
        /procesados/, // ignore 'procesados' subfolder
        path.join(pdfDir, 'procesados', '**') // Explícitamente ignorar cualquier archivo en la carpeta procesados
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    // Set up event handlers
    excelWatcher.on('add', (filePath: string) => handleNewExcelFile(filePath));
    pdfWatcher.on('add', (filePath: string) => handleNewPdfFile(filePath));
    
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
    
    // Limpiar el conjunto de archivos procesados cuando se detienen los observadores
    processedFiles.clear();
    
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
    
    // Verificar si la carpeta procesados contiene este archivo
    const excelDirConfig = await storage.getConfig('EXCEL_WATCH_DIR');
    if (excelDirConfig) {
      const procesadosDir = path.join(excelDirConfig.value, 'procesados');
      const posibleProcessedPath = path.join(procesadosDir, filename);
      
      if (fileExists(posibleProcessedPath)) {
        console.log(`El archivo Excel ${filename} ya existe en la carpeta de procesados. Eliminando archivo duplicado.`);
        try {
          // Eliminar el archivo duplicado usando la función de utilidades
          await deleteFileIfExists(filePath);
          console.log(`Archivo duplicado eliminado: ${filePath}`);
        } catch (unlinkError) {
          console.error(`Error al eliminar archivo duplicado: ${unlinkError}`);
        }
        return;
      }
    }
    
    // Verificar si el archivo ya ha sido procesado según nuestro registro
    if (processedFiles.has(filePath) || processedFiles.has(filename)) {
      console.log(`El archivo Excel ${filename} ya fue procesado anteriormente según el registro. Omitiendo.`);
      
      // Mover a procesados directamente para evitar reprocesamiento
      try {
        // Usar nuestra utilidad moveToProcessed
        const movedPath = await moveToProcessed(filePath, 'Excel');
        if (movedPath) {
          console.log(`Archivo Excel ${filename} movido directamente a procesados sin reprocesar: ${movedPath}`);
        } else {
          console.error(`No se pudo mover el archivo Excel ${filename} a procesados`);
        }
      } catch (moveError) {
        console.error(`Error al mover archivo ya procesado: ${moveError}`);
      }
      
      return;
    }
    
    // Comprobar si el archivo ya tiene actividad en la base de datos
    const activities = await storage.getFileActivities();
    const existingActivity = activities.find(a => a.filename === filename && (a.status === 'Processed' || a.status === 'Processing'));
    
    if (existingActivity) {
      console.log(`El archivo Excel ${filename} ya tiene una actividad registrada (ID: ${existingActivity.id}). Moviendo a procesados.`);
      
      // Mover a procesados directamente para evitar reprocesamiento
      try {
        // Usar nuestra utilidad moveToProcessed
        const movedPath = await moveToProcessed(filePath, 'Excel');
        if (movedPath) {
          console.log(`Archivo Excel ${filename} con actividad existente movido a procesados: ${movedPath}`);
        } else {
          console.error(`No se pudo mover el archivo Excel ${filename} a procesados`);
        }
      } catch (moveError) {
        console.error(`Error al mover archivo con actividad existente: ${moveError}`);
      }
      
      return;
    }
    
    // Agregar el archivo al conjunto de archivos procesados (tanto por ruta como por nombre)
    processedFiles.add(filePath);
    processedFiles.add(filename);
    
    // Buscar todas las tiendas y usar la primera que coincida con el nombre del archivo
    const allStores = await storage.getStores();
    let foundStore = null;
    
    // Solo permitir coincidencia exacta de código (NO coincidencias parciales)
    for (const store of allStores) {
      // Usamos === para solo aceptar coincidencias exactas
      if (filename === store.code || filename.startsWith(store.code + '_') || filename.startsWith(store.code + '.')) {
        foundStore = store;
        console.log(`Excel matched with store by exact code: ${store.code}`);
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
    
    // Verificar si la carpeta procesados contiene este archivo
    const pdfDirConfig = await storage.getConfig('PDF_WATCH_DIR');
    if (pdfDirConfig) {
      const procesadosDir = path.join(pdfDirConfig.value, 'procesados');
      const posibleProcessedPath = path.join(procesadosDir, filename);
      
      if (fileExists(posibleProcessedPath)) {
        console.log(`El archivo PDF ${filename} ya existe en la carpeta de procesados. Eliminando archivo duplicado.`);
        try {
          // Eliminar el archivo duplicado usando la función de utilidades
          await deleteFileIfExists(filePath);
          console.log(`Archivo duplicado eliminado: ${filePath}`);
        } catch (unlinkError) {
          console.error(`Error al eliminar archivo duplicado: ${unlinkError}`);
        }
        return;
      }
    }
    
    // Verificar si el archivo ya ha sido procesado según nuestro registro
    if (processedFiles.has(filePath) || processedFiles.has(filename)) {
      console.log(`El archivo PDF ${filename} ya fue procesado anteriormente según el registro. Omitiendo.`);
      
      // Mover a procesados directamente para evitar reprocesamiento
      try {
        // Usar nuestra utilidad moveToProcessed
        const movedPath = await moveToProcessed(filePath, 'PDF');
        if (movedPath) {
          console.log(`Archivo PDF ${filename} movido directamente a procesados sin reprocesar: ${movedPath}`);
        } else {
          console.error(`No se pudo mover el archivo PDF ${filename} a procesados`);
        }
      } catch (moveError) {
        console.error(`Error al mover archivo ya procesado: ${moveError}`);
      }
      
      return;
    }
    
    // Comprobar si el archivo ya tiene actividad en la base de datos
    const activities = await storage.getFileActivities();
    const existingActivity = activities.find(a => a.filename === filename && (a.status === 'Processed' || a.status === 'Processing'));
    
    if (existingActivity) {
      console.log(`El archivo PDF ${filename} ya tiene una actividad registrada (ID: ${existingActivity.id}). Moviendo a procesados.`);
      
      // Mover a procesados directamente para evitar reprocesamiento
      try {
        // Usar nuestra utilidad moveToProcessed
        const movedPath = await moveToProcessed(filePath, 'PDF');
        if (movedPath) {
          console.log(`Archivo PDF ${filename} con actividad existente movido a procesados: ${movedPath}`);
        } else {
          console.error(`No se pudo mover el archivo PDF ${filename} a procesados`);
        }
      } catch (moveError) {
        console.error(`Error al mover archivo con actividad existente: ${moveError}`);
      }
      
      return;
    }
    
    // Agregar el archivo al conjunto de archivos procesados (tanto por ruta como por nombre)
    processedFiles.add(filePath);
    processedFiles.add(filename);
    
    // Buscar todas las tiendas y usar la primera que coincida con el nombre del archivo
    const allStores = await storage.getStores();
    let foundStore = null;
    
    // Solo permitir coincidencia exacta de código (NO coincidencias parciales)
    for (const store of allStores) {
      // Usamos === para solo aceptar coincidencias exactas
      if (filename === store.code || filename.startsWith(store.code + '_') || filename.startsWith(store.code + '.')) {
        foundStore = store;
        console.log(`PDF matched with store by exact code: ${store.code}`);
        break;
      }
    }
    
    // Si no se encontró coincidencia, intentar con expresiones regulares
    if (!foundStore) {
      // Estrategias para extraer el código de tienda del nombre del archivo
      let storeCode = '';
      
      // 1. Buscar por patrón J12345ABCDE (formato común que comienza con J seguido de números y letras)
      const j_pattern = /\b(J\d{5}[A-Z0-9]{4,5})\b/i;
      const j_match = filename.match(j_pattern);
      
      if (j_match && j_match[1]) {
        storeCode = j_match[1];
      }
      // 2. Intentar formato general de códigos: LETRA+NÚMEROS o NÚMEROS+LETRA
      else {
        const general_pattern = /\b([A-Z]\d{1,6}|J\d{2,6}[a-z]{1,3})\b/i;
        const general_match = filename.match(general_pattern);
        
        if (general_match && general_match[1]) {
          storeCode = general_match[1];
        }
        // 3. Intentar el formato STORECODE_*.pdf
        else {
          const formatMatch = filename.match(/^([^_\.]+)_/);
          if (formatMatch && formatMatch[1]) {
            storeCode = formatMatch[1];
          } 
          // 4. Intentar el formato STORECODE.*.pdf
          else {
            const dotMatch = filename.match(/^([^\.]+)\./);
            if (dotMatch && dotMatch[1]) {
              storeCode = dotMatch[1];
            }
            // 5. Si no se encontró ningún patrón, usar el nombre completo sin extensión como código
            else {
              const nameWithoutExtension = path.parse(filename).name;
              storeCode = nameWithoutExtension;
            }
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
    
    const storeCode = foundStore.code;
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
