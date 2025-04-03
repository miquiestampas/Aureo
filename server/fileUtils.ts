import fs from 'fs';
import path from 'path';
import { storage } from './storage';

/**
 * Mueve un archivo a la carpeta "procesados" después del procesamiento
 * 
 * @param filePath Ruta completa al archivo
 * @param directoryType Tipo de directorio ('PDF' o 'Excel')
 * @returns Ruta del archivo en la carpeta procesados si se movió correctamente, o null si hubo un error
 */
export async function moveToProcessed(filePath: string, directoryType: 'PDF' | 'Excel'): Promise<string | null> {
  try {
    // Determinar qué directorio usar
    const configKey = directoryType === 'PDF' ? 'PDF_WATCH_DIR' : 'EXCEL_WATCH_DIR';
    const dirConfig = await storage.getConfig(configKey);
    
    if (!dirConfig) {
      console.error(`No se encontró configuración para ${configKey}`);
      return null;
    }
    
    // Obtener el directorio base y crear la carpeta procesados si no existe
    const baseDir = dirConfig.value;
    const procesadosDir = path.join(baseDir, 'procesados');
    
    // Usar nuestra utilidad para asegurar que el directorio existe
    const dirCreated = await ensureDirectoryExists(procesadosDir);
    if (!dirCreated) {
      console.error(`No se pudo crear o verificar el directorio procesados: ${procesadosDir}`);
      return null;
    }
    
    // Verificar si el archivo original existe usando nuestra función
    if (!fileExists(filePath)) {
      console.warn(`El archivo ${filePath} ya no existe, posiblemente ya fue movido`);
      return null;
    }
    
    // Crear la ruta de destino
    const filename = path.basename(filePath);
    const destPath = path.join(procesadosDir, filename);
    
    // Verificar si ya existe un archivo con el mismo nombre en destino
    if (fileExists(destPath)) {
      // Renombrar el archivo de destino agregando timestamp para evitar conflictos
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileNameWithoutExt = path.parse(filename).name;
      const fileExt = path.parse(filename).ext;
      const backupDestPath = path.join(procesadosDir, `${fileNameWithoutExt}_${timestamp}${fileExt}`);
      
      console.log(`El archivo ${filename} ya existe en la carpeta procesados, guardando como ${path.basename(backupDestPath)}`);
      await fs.promises.copyFile(filePath, backupDestPath);
      await fs.promises.unlink(filePath);
      return backupDestPath;
    } else {
      // Mover el archivo directamente (copia y eliminación)
      await fs.promises.copyFile(filePath, destPath);
      await fs.promises.unlink(filePath);
      console.log(`Archivo ${filename} movido a la carpeta procesados`);
      return destPath;
    }
  } catch (error) {
    console.error(`Error al mover el archivo a la carpeta procesados:`, error);
    return null;
  }
}

/**
 * Elimina un archivo si existe
 * 
 * @param filePath Ruta completa al archivo a eliminar
 * @returns true si se eliminó correctamente, false si hubo un error
 */
export async function deleteFileIfExists(filePath: string): Promise<boolean> {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`Archivo eliminado: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error al eliminar archivo ${filePath}:`, error);
    return false;
  }
}

/**
 * Verifica si un archivo existe
 * 
 * @param filePath Ruta completa al archivo a verificar
 * @returns true si el archivo existe, false si no
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Obtiene el tamaño de un archivo en bytes
 * 
 * @param filePath Ruta completa al archivo
 * @returns Tamaño del archivo en bytes, o -1 si hubo un error
 */
export function getFileSize(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) {
      return -1;
    }
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error al obtener tamaño del archivo ${filePath}:`, error);
    return -1;
  }
}

/**
 * Asegura que un directorio existe, creándolo si es necesario
 * 
 * @param dirPath Ruta completa al directorio
 * @returns true si el directorio existe o se creó correctamente, false si hubo un error
 */
export async function ensureDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`Directorio creado: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error(`Error al crear directorio ${dirPath}:`, error);
    return false;
  }
}