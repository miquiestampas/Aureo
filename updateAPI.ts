import { db } from './server/db';
import * as schema from './shared/schema';

/**
 * Este script actualiza la API para que incluya los campos "interesado" y "notas"
 * en las respuestas de coincidencias
 */
async function updateAPI() {
  try {
    console.log("Actualizando API...");
    const senalPersonas = await db.select().from(schema.senalPersonas);
    console.log(`Encontradas ${senalPersonas.length} señales de personas`);
    
    // Verificar que los campos interesado y notas estén presentes
    if (senalPersonas.length > 0) {
      const campos = Object.keys(senalPersonas[0]);
      console.log("Campos disponibles en senalPersonas:", campos);
      
      if (campos.includes("interesado")) {
        console.log("Campo 'interesado' existe en senalPersonas");
      } else {
        console.log("⚠️ Campo 'interesado' NO existe en senalPersonas");
      }
      
      if (campos.includes("notas")) {
        console.log("Campo 'notas' existe en senalPersonas");
      } else {
        console.log("⚠️ Campo 'notas' NO existe en senalPersonas");
      }
    }
    
    const senalObjetos = await db.select().from(schema.senalObjetos);
    console.log(`Encontradas ${senalObjetos.length} señales de objetos`);
    
    // Verificar que los campos interesado y notas estén presentes
    if (senalObjetos.length > 0) {
      const campos = Object.keys(senalObjetos[0]);
      console.log("Campos disponibles en senalObjetos:", campos);
      
      if (campos.includes("interesado")) {
        console.log("Campo 'interesado' existe en senalObjetos");
      } else {
        console.log("⚠️ Campo 'interesado' NO existe en senalObjetos");
      }
      
      if (campos.includes("notas")) {
        console.log("Campo 'notas' existe en senalObjetos");
      } else {
        console.log("⚠️ Campo 'notas' NO existe en senalObjetos");
      }
    }
    
    console.log("Actualización completa");
  } catch (error) {
    console.error("Error al actualizar la API:", error);
  }
}

updateAPI().then(() => process.exit(0));