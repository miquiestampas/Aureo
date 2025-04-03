/**
 * Este script añade la columna "interesado" a la tabla de coincidencias
 */
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function addInteresadoColumn() {
  console.log("Iniciando adición de columna 'interesado' a la tabla coincidencias...");

  try {
    // Verificar si la columna ya existe
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'coincidencias' 
      AND column_name = 'interesado'
    `.execute(db);

    if (checkColumn.length > 0) {
      console.log("La columna 'interesado' ya existe en la tabla coincidencias.");
      return { success: true, message: "Columna ya existente" };
    }

    // Añadir la columna
    await sql`
      ALTER TABLE coincidencias
      ADD COLUMN interesado TEXT
    `.execute(db);

    console.log("Columna 'interesado' añadida exitosamente a la tabla coincidencias.");

    // Actualizar el esquema de Drizzle para incluir la nueva columna
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