import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original file
const filePath = path.join(__dirname, 'server', 'routes.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Find the problematic section and replace it
const startMarker = '  // Los módulos de señalamientos y coincidencias han sido eliminados temporalmente';
const endMarker = 'return httpServer;';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  // Create the replacement text
  const replacementText = `  // Los módulos de señalamientos y coincidencias han sido eliminados temporalmente
  // Estos módulos serán reimplementados en el futuro
  
  /* Los endpoints de señalamientos y coincidencias han sido eliminados:
  Rutas señalamientos:
  - GET /api/senalamiento/personas
  - GET /api/senalamiento/personas/:id
  - GET /api/senalamiento/personas/buscar/:query
  - POST /api/senalamiento/personas
  - PUT /api/senalamiento/personas/:id
  - DELETE /api/senalamiento/personas/:id
  - GET /api/senalamiento/objetos
  - GET /api/senalamiento/objetos/:id
  - GET /api/senalamiento/objetos/buscar/:query
  - POST /api/senalamiento/objetos
  - PUT /api/senalamiento/objetos/:id
  - DELETE /api/senalamiento/objetos/:id
  
  Rutas coincidencias:
  - GET /api/coincidencias
  - GET /api/coincidencias/:id
  - PUT /api/coincidencias/:id/estado
  - GET /api/coincidencias/excel/:excelDataId
  - GET /api/coincidencias/noleidas/count
  - POST /api/coincidencias/detectar/:excelDataId
  
  Las funcionalidades serán reimplementadas en el futuro.
  */

  `;
  
  // Create the new content
  const newContent = 
    content.substring(0, startIndex) + 
    replacementText + 
    content.substring(endIndex);
  
  // Write the new content back to the file
  fs.writeFileSync(filePath, newContent, 'utf8');
  
  console.log('Successfully replaced the señalamientos and coincidencias section');
} else {
  console.error('Could not find the section to replace');
  console.log('Start index:', startIndex);
  console.log('End index:', endIndex);
}