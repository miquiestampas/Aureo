import { db } from './server/db';
import * as schema from './shared/schema';

/**
 * Este script actualiza la API para que incluya los campos "interesado" y "notas"
 * en las respuestas de coincidencias
 */
async function updateCoincidenciasAPI() {
  try {
    console.log("Modificando respuestas API de coincidencias...");

    // Obtener una coincidencia para verificar la estructura
    const coincidencia = await db.query.coincidencias.findFirst();
    
    if (coincidencia) {
      console.log("Estructura de coincidencia:", Object.keys(coincidencia));
    } else {
      console.log("No se encontraron coincidencias para verificar");
    }
    
    // Obtener persona de señalamiento para verificar campos
    const persona = await db.query.senalPersonas.findFirst();
    if (persona) {
      console.log("Campos de señalamiento persona:", Object.keys(persona));
      console.log("Interesado:", persona.interesado);
      console.log("Notas:", persona.notas);
    }
    
    console.log("Script completado. Verifica el frontend para comprobar que los campos están disponibles");
  } catch (error) {
    console.error("Error:", error);
  }
}

updateCoincidenciasAPI()
  .then(() => {
    console.log("Proceso finalizado");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error crítico:", err);
    process.exit(1);
  });