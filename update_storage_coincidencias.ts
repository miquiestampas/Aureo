/**
 * Este script actualiza las funciones en server/storage.ts para que incluyan 
 * el campo "interesado" en las respuestas de coincidencias
 */
import fs from 'fs';

async function updateStorageFunctions() {
  console.log("Iniciando actualización de las funciones de coincidencias en storage.ts...");

  try {
    // Leer el archivo de storage
    const storagePath = './server/storage.ts';
    let storageContent = fs.readFileSync(storagePath, 'utf8');

    // Función para getCoincidencias()
    let updatedContent = storageContent.replace(
      /async getCoincidencias\(estado\?: "NoLeido" \| "Leido" \| "Descartado", limit: number = 50\): Promise<Coincidencia\[\]> {[\s\S]*?if \(rows && Array.isArray\(rows\)\) {[\s\S]*?return rows\.map\(row => {[\s\S]*?return {[\s\S]*?id: row\.id,[\s\S]*?estado: row\.estado,[\s\S]*?creadoEn: row\.creado_en,[\s\S]*?tipoCoincidencia: row\.tipo_coincidencia,[\s\S]*?idSenalPersona: row\.id_senal_persona,[\s\S]*?idSenalObjeto: row\.id_senal_objeto,[\s\S]*?idExcelData: row\.id_excel_data,[\s\S]*?puntuacionCoincidencia: row\.puntuacion_coincidencia,[\s\S]*?tipoMatch: row\.tipo_match,[\s\S]*?campoCoincidente: row\.campo_coincidente,[\s\S]*?valorCoincidente: row\.valor_coincidente,[\s\S]*?revisadoPor: row\.revisado_por,[\s\S]*?revisadoEn: row\.revisado_en,[\s\S]*?notasRevision: row\.notas_revision\s*}/g,
      (match) => {
        // Verificar si ya incluye el campo interesado
        if (match.includes('interesado: row.interesado')) {
          return match;
        }
        // Agregar el campo interesado
        return match.replace(
          'notasRevision: row.notas_revision',
          'notasRevision: row.notas_revision,\n            interesado: row.interesado'
        );
      }
    );

    // Función para getCoincidencia()
    updatedContent = updatedContent.replace(
      /async getCoincidencia\(id: number\): Promise<Coincidencia \| undefined> {[\s\S]*?if \(row\) {[\s\S]*?return {[\s\S]*?id: row\.id,[\s\S]*?estado: row\.estado,[\s\S]*?creadoEn: row\.creado_en,[\s\S]*?tipoCoincidencia: row\.tipo_coincidencia,[\s\S]*?idSenalPersona: row\.id_senal_persona,[\s\S]*?idSenalObjeto: row\.id_senal_objeto,[\s\S]*?idExcelData: row\.id_excel_data,[\s\S]*?puntuacionCoincidencia: row\.puntuacion_coincidencia,[\s\S]*?tipoMatch: row\.tipo_match,[\s\S]*?campoCoincidente: row\.campo_coincidente,[\s\S]*?valorCoincidente: row\.valor_coincidente,[\s\S]*?revisadoPor: row\.revisado_por,[\s\S]*?revisadoEn: row\.revisado_en,[\s\S]*?notasRevision: row\.notas_revision\s*}/g,
      (match) => {
        // Verificar si ya incluye el campo interesado
        if (match.includes('interesado: row.interesado')) {
          return match;
        }
        // Agregar el campo interesado
        return match.replace(
          'notasRevision: row.notas_revision',
          'notasRevision: row.notas_revision,\n          interesado: row.interesado'
        );
      }
    );

    // Función para getCoincidenciasByExcelDataId()
    updatedContent = updatedContent.replace(
      /async getCoincidenciasByExcelDataId\(excelDataId: number\): Promise<Coincidencia\[\]> {[\s\S]*?if \(rows && Array.isArray\(rows\)\) {[\s\S]*?return rows\.map\(row => {[\s\S]*?return {[\s\S]*?id: row\.id,[\s\S]*?estado: row\.estado,[\s\S]*?creadoEn: row\.creado_en,[\s\S]*?tipoCoincidencia: row\.tipo_coincidencia,[\s\S]*?idSenalPersona: row\.id_senal_persona,[\s\S]*?idSenalObjeto: row\.id_senal_objeto,[\s\S]*?idExcelData: row\.id_excel_data,[\s\S]*?puntuacionCoincidencia: row\.puntuacion_coincidencia,[\s\S]*?tipoMatch: row\.tipo_match,[\s\S]*?campoCoincidente: row\.campo_coincidente,[\s\S]*?valorCoincidente: row\.valor_coincidente,[\s\S]*?revisadoPor: row\.revisado_por,[\s\S]*?revisadoEn: row\.revisado_en,[\s\S]*?notasRevision: row\.notas_revision\s*}/g,
      (match) => {
        // Verificar si ya incluye el campo interesado
        if (match.includes('interesado: row.interesado')) {
          return match;
        }
        // Agregar el campo interesado
        return match.replace(
          'notasRevision: row.notas_revision',
          'notasRevision: row.notas_revision,\n            interesado: row.interesado'
        );
      }
    );

    // También actualizar el método updateCoincidenciaEstado
    updatedContent = updatedContent.replace(
      /async updateCoincidenciaEstado\([\s\S]*?if \(result\) {[\s\S]*?return {[\s\S]*?id: result\.id,[\s\S]*?estado: result\.estado,[\s\S]*?creadoEn: result\.creado_en,[\s\S]*?tipoCoincidencia: result\.tipo_coincidencia,[\s\S]*?idSenalPersona: result\.id_senal_persona,[\s\S]*?idSenalObjeto: result\.id_senal_objeto,[\s\S]*?idExcelData: result\.id_excel_data,[\s\S]*?puntuacionCoincidencia: result\.puntuacion_coincidencia,[\s\S]*?tipoMatch: result\.tipo_match,[\s\S]*?campoCoincidente: result\.campo_coincidente,[\s\S]*?valorCoincidente: result\.valor_coincidente,[\s\S]*?revisadoPor: result\.revisado_por,[\s\S]*?revisadoEn: result\.revisado_en,[\s\S]*?notasRevision: result\.notas_revision\s*}/g,
      (match) => {
        // Verificar si ya incluye el campo interesado
        if (match.includes('interesado: result.interesado')) {
          return match;
        }
        // Agregar el campo interesado
        return match.replace(
          'notasRevision: result.notas_revision',
          'notasRevision: result.notas_revision,\n          interesado: result.interesado'
        );
      }
    );

    // Guardar los cambios solo si hubo modificaciones
    if (updatedContent !== storageContent) {
      fs.writeFileSync(storagePath, updatedContent, 'utf8');
      console.log("Se han actualizado las funciones de coincidencias en storage.ts");
    } else {
      console.log("No fue necesario realizar cambios en las funciones");
    }

    console.log("Actualización de funciones completada con éxito.");
    
    return { success: true, message: "Funciones actualizadas correctamente" };
  } catch (error) {
    console.error("Error durante la actualización de las funciones:", error);
    return { success: false, error };
  }
}

// Ejecutar la función principal
updateStorageFunctions()
  .then(result => {
    console.log("Resultado:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });