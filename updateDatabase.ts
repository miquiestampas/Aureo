import { db, sqlite } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function updateDatabase() {
  console.log("Iniciando actualización de la base de datos...");
  
  try {
    // Comprobar la estructura actual de las tablas
    console.log("Comprobando estructura actual de las tablas...");
    
    // Actualizar tabla senal_personas si es necesario
    try {
      const personasTableInfo = sqlite.prepare("PRAGMA table_info(senal_personas)").all() as any[];
      const hasInteresado = personasTableInfo.some(col => col.name === 'interesado');
      
      if (!hasInteresado) {
        console.log("Añadiendo columna 'interesado' a tabla senal_personas...");
        db.run(sql`ALTER TABLE senal_personas ADD COLUMN interesado TEXT;`);
        console.log("Columna añadida con éxito.");
      } else {
        console.log("La tabla senal_personas ya tiene la columna 'interesado'.");
      }
    } catch (error) {
      console.error("Error al verificar/actualizar senal_personas:", error);
    }
    
    // Actualizar tabla senal_objetos si es necesario
    try {
      const objetosTableInfo = sqlite.prepare("PRAGMA table_info(senal_objetos)").all() as any[];
      const hasInteresado = objetosTableInfo.some(col => col.name === 'interesado');
      
      if (!hasInteresado) {
        console.log("Añadiendo columna 'interesado' a tabla senal_objetos...");
        db.run(sql`ALTER TABLE senal_objetos ADD COLUMN interesado TEXT;`);
        console.log("Columna añadida con éxito.");
      } else {
        console.log("La tabla senal_objetos ya tiene la columna 'interesado'.");
      }
    } catch (error) {
      console.error("Error al verificar/actualizar senal_objetos:", error);
    }
    
    // Actualizar tabla excel_data si es necesario
    try {
      const excelDataTableInfo = sqlite.prepare("PRAGMA table_info(excel_data)").all() as any[];
      const columnCheck = {
        customer_address: excelDataTableInfo.some(col => col.name === 'customer_address'),
        customer_location: excelDataTableInfo.some(col => col.name === 'customer_location'),
        item_weight: excelDataTableInfo.some(col => col.name === 'item_weight')
      };
      
      if (!columnCheck.customer_address) {
        console.log("Añadiendo columna 'customer_address' a tabla excel_data...");
        db.run(sql`ALTER TABLE excel_data ADD COLUMN customer_address TEXT;`);
        console.log("Columna añadida con éxito.");
      }
      
      if (!columnCheck.customer_location) {
        console.log("Añadiendo columna 'customer_location' a tabla excel_data...");
        db.run(sql`ALTER TABLE excel_data ADD COLUMN customer_location TEXT;`);
        console.log("Columna añadida con éxito.");
      }
      
      if (!columnCheck.item_weight) {
        console.log("Añadiendo columna 'item_weight' a tabla excel_data...");
        db.run(sql`ALTER TABLE excel_data ADD COLUMN item_weight TEXT;`);
        console.log("Columna añadida con éxito.");
      }
      
      if (columnCheck.customer_address && columnCheck.customer_location && columnCheck.item_weight) {
        console.log("La tabla excel_data ya tiene todas las columnas necesarias.");
      }
    } catch (error) {
      console.error("Error al verificar/actualizar excel_data:", error);
    }
    
    console.log("Actualización de la base de datos completada con éxito.");
    
  } catch (error) {
    console.error("Error durante la actualización de la base de datos:", error);
    process.exit(1);
  }
}

// Hacer una copia de seguridad antes de actualizar
const DB_PATH = './aureo_app';
const DB_FILE = 'datos.sqlite';
const BACKUP_FILE = `datos_backup_${new Date().toISOString().replace(/[:.]/g, '_')}.sqlite`;

console.log(`Creando copia de seguridad en ${path.join(DB_PATH, BACKUP_FILE)}...`);

try {
  if (fs.existsSync(path.join(DB_PATH, DB_FILE))) {
    fs.copyFileSync(
      path.join(DB_PATH, DB_FILE),
      path.join(DB_PATH, BACKUP_FILE)
    );
    console.log("Copia de seguridad creada correctamente.");
    
    // Ejecutar la actualización
    updateDatabase().then(() => {
      console.log("Proceso de actualización finalizado correctamente.");
      process.exit(0);
    });
  } else {
    console.error("No se encontró el archivo de base de datos original.");
    process.exit(1);
  }
} catch (error) {
  console.error("Error al crear la copia de seguridad:", error);
  process.exit(1);
}