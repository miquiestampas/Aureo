/**
 * Este script añade la columna "interesado" a la tabla coincidencias
 */
import { sqlite } from './server/db';

async function addInteresadoColumn() {
  console.log("Iniciando adición de columna 'interesado' a la tabla coincidencias...");

  try {
    // Verificar si la columna ya existe en SQLite
    const checkColumnQuery = sqlite.prepare(`
      SELECT name 
      FROM pragma_table_info('coincidencias')
      WHERE name = 'interesado'
    `);
    
    const columnExists = checkColumnQuery.get();

    if (columnExists) {
      console.log("La columna 'interesado' ya existe en la tabla coincidencias.");
      return { success: true, message: "Columna ya existente" };
    }

    // Añadir la columna usando SQLite
    const alterTableQuery = sqlite.prepare(`
      ALTER TABLE coincidencias
      ADD COLUMN interesado TEXT
    `);
    
    alterTableQuery.run();

    console.log("Columna 'interesado' añadida exitosamente a la tabla coincidencias.");
    console.log("✅ Schema actualizado correctamente");

    return { success: true, message: "Columna añadida correctamente" };
  } catch (error) {
    console.error("Error al añadir la columna 'interesado':", error);
    return { success: false, error };
  }
}

// Ejecutar la función principal
addInteresadoColumn()
  .then(result => {
    console.log("Resultado:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });