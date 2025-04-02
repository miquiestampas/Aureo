/**
 * Este script actualiza la API para que incluya los campos "interesado" y "notas"
 * en las respuestas de coincidencias de todos los endpoints
 */
import { db } from './server/db';
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import sqlite3 from 'better-sqlite3';
import fs from 'fs';

async function updateCoincidenciasAPI() {
  console.log("Iniciando actualización de API de coincidencias...");

  try {
    // Leer el archivo de rutas
    const routesPath = './server/routes.ts';
    let routesContent = fs.readFileSync(routesPath, 'utf8');

    // Localiza los bloques específicos para evitar duplicados
    const blocks = [
      {
        // Coincidencias API - Endpoint 1
        search: /\/\/ Obtener datos de señalamientos si corresponde\s+let nombrePersona = undefined;\s+let descripcionObjeto = undefined;\s+\s+if \(coincidencia.tipoCoincidencia === "Persona" && coincidencia.idSenalPersona\) {([\s\S]*?)return {\s+\.\.\.coincidencia,\s+nombrePersona,\s+descripcionObjeto,/g,
        replace: function(match) {
          // Solo si no contiene ya interesado y notas
          if (!match.includes('let interesado = undefined;')) {
            return match
              .replace(
                '// Obtener datos de señalamientos si corresponde\n            let nombrePersona = undefined;\n            let descripcionObjeto = undefined;',
                '// Obtener datos de señalamientos si corresponde\n            let nombrePersona = undefined;\n            let descripcionObjeto = undefined;\n            let interesado = undefined;\n            let notas = undefined;'
              )
              .replace(
                'if (persona) {\n                nombrePersona = persona.nombre;\n              }',
                'if (persona) {\n                nombrePersona = persona.nombre;\n                interesado = persona.interesado;\n                notas = persona.notas;\n              }'
              )
              .replace(
                'if (objeto) {\n                descripcionObjeto = objeto.descripcion;\n              }',
                'if (objeto) {\n                descripcionObjeto = objeto.descripcion;\n                interesado = objeto.interesado;\n                notas = objeto.notas;\n              }'
              )
              .replace(
                'return {\n              ...coincidencia,\n              nombrePersona,\n              descripcionObjeto,',
                'return {\n              ...coincidencia,\n              nombrePersona,\n              descripcionObjeto,\n              interesado,\n              notas,'
              );
          }
          return match;
        }
      }
    ];

    let updatedContent = routesContent;
    
    // Aplicar cada bloque de reemplazo
    for (const block of blocks) {
      updatedContent = updatedContent.replace(block.search, block.replace);
    }

    // Guardar los cambios solo si hubo modificaciones
    if (updatedContent !== routesContent) {
      fs.writeFileSync(routesPath, updatedContent, 'utf8');
      console.log("Se han actualizado las rutas de coincidencias");
    } else {
      console.log("No fue necesario realizar cambios en las rutas");
    }

    console.log("Actualización de API completada con éxito.");
    
    return { success: true, message: "API actualizada correctamente" };
  } catch (error) {
    console.error("Error durante la actualización de la API:", error);
    return { success: false, error };
  }
}

// Ejecutar la función principal
updateCoincidenciasAPI()
  .then(result => {
    console.log("Resultado:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });