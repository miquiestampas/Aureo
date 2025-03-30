import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original file
const filePath = path.join(__dirname, 'server', 'routes.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Log a substring around the marker to debug
const startMarker = '  // Los módulos de señalamientos y coincidencias han sido eliminados temporalmente';
const endMarker = 'return httpServer;';

const startIndex = content.indexOf(startMarker);
console.log('Start index found at:', startIndex);

if (startIndex !== -1) {
  // Log a substring around the marker for debugging
  const contextAround = content.substring(startIndex, startIndex + 500); // 500 chars after the start
  console.log('Context around start marker:');
  console.log('----------------------------------');
  console.log(contextAround);
  console.log('----------------------------------');
}

// Find occurrences of "return httpServer;"
let searchText = 'return httpServer;';
let foundIndex = content.indexOf(searchText);
let count = 0;

while (foundIndex !== -1) {
  count++;
  console.log(`Occurrence #${count} of "${searchText}" found at index ${foundIndex}`);
  foundIndex = content.indexOf(searchText, foundIndex + 1);
}