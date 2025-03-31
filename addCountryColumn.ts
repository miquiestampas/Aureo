/**
 * Script para agregar la columna 'country' a la tabla 'excel_data' en la base de datos SQLite
 */

import Database from 'better-sqlite3';

// Inicializar la conexión a la base de datos
const sqlite = new Database('aureo_app/datos.sqlite');

async function addCountryColumn() {
  try {
    console.log("Verificando si la columna 'country' existe en la tabla 'excel_data'...");
    
    // Verificar si la columna ya existe
    const tableInfoResult = sqlite.prepare("PRAGMA table_info(excel_data)").all() as any[];
    const columnExists = tableInfoResult.some(column => column.name === 'country');
    
    if (columnExists) {
      console.log("La columna 'country' ya existe en la tabla 'excel_data'");
      return;
    }
    
    console.log("Agregando columna 'country' a la tabla 'excel_data'...");
    
    // Agregar la columna country usando better-sqlite3 directamente
    sqlite.prepare("ALTER TABLE excel_data ADD COLUMN country TEXT").run();
    
    console.log("La columna 'country' ha sido agregada con éxito a la tabla 'excel_data'");
  } catch (error) {
    console.error("Error al agregar la columna 'country':", error);
    throw error;
  } finally {
    // Cerrar la conexión a la base de datos
    sqlite.close();
  }
}

// Ejecutar la función principal
addCountryColumn()
  .then(() => {
    console.log("Migración completada con éxito");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en la migración:", error);
    process.exit(1);
  });