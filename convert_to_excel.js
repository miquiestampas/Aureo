import XLSX from 'xlsx';
import fs from 'fs';

// Leer el archivo CSV
const csv = fs.readFileSync('test_excel.xlsx', 'utf8');

// Convertir CSV a objeto de trabajo
const workbook = XLSX.read(csv, { type: 'string' });

// Escribir el archivo Excel
XLSX.writeFile(workbook, 'test_excel.xlsx');

console.log('Archivo Excel creado exitosamente'); 