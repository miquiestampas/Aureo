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
    
    // Initialize new watchers
    excelWatcher = chokidar.watch(excelDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    pdfWatcher = chokidar.watch(pdfDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
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
    
    // Estrategias mejoradas para extraer el código de tienda del nombre del archivo
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
    
    console.log(`New Excel file detected: ${filename} (Store: ${storeCode})`);
    
    // Verificar si la tienda existe
    const storeExists = await storage.getStoreByCode(storeCode);
    if (!storeExists) {
      console.warn(`Store with code ${storeCode} does not exist. Marking file activity as failed.`);
      
      // Crear actividad de archivo con error
      const activity = await storage.createFileActivity({
        filename,
        storeCode,
        fileType: 'Excel',
        status: 'Failed',
        processingDate: new Date(),
        processedBy: 'System',
        errorMessage: `La tienda con código ${storeCode} no existe en el sistema.`,
        metadata: null
      });
      
      // Emitir eventos de detección y fallo
      emitFileDetected({
        id: activity.id,
        filename,
        storeCode,
        fileType: 'Excel',
        status: 'Failed'
      });
      
      emitFileProcessingStatus(activity.id, 'Failed', `La tienda con código ${storeCode} no existe en el sistema.`);
      return;
    }
    
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
    
    // Estrategias mejoradas para extraer el código de tienda del nombre del archivo
    let storeCode = '';
    
    // 1. Intentar el formato STORECODE_*.pdf
    const formatMatch = filename.match(/^([^_\.]+)_/);
    if (formatMatch && formatMatch[1]) {
      storeCode = formatMatch[1];
    } 
    // 2. Intentar el formato STORECODE.*.pdf
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
    
    console.log(`New PDF file detected: ${filename} (Store: ${storeCode})`);
    
    // Check if the store exists
    const storeExists = await storage.getStoreByCode(storeCode);
    if (!storeExists) {
      console.warn(`Store with code ${storeCode} does not exist. Marking file activity as failed.`);
      
      // Create file activity entry with error
      const activity = await storage.createFileActivity({
        filename,
        storeCode,
        fileType: 'PDF',
        status: 'Failed',
        processingDate: new Date(),
        processedBy: 'System',
        errorMessage: `La tienda con código ${storeCode} no existe en el sistema.`,
        metadata: null
      });
      
      // Emit file detection and failure events
      emitFileDetected({
        id: activity.id,
        filename,
        storeCode,
        fileType: 'PDF',
        status: 'Failed'
      });
      
      emitFileProcessingStatus(activity.id, 'Failed', `La tienda con código ${storeCode} no existe en el sistema.`);
      return;
    }
    
    // Create file activity entry
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
