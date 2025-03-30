import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import { sql } from 'drizzle-orm';

// Ruta donde se creará la base de datos SQLite
const DB_PATH = './aureo_app';
const DB_FILE = 'datos.sqlite';
const FULL_PATH = path.join(DB_PATH, DB_FILE);

// Crear el directorio si no existe
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
  console.log(`Directorio creado: ${DB_PATH}`);
}

// Crear la conexión a la base de datos SQLite
const sqlite = new Database(FULL_PATH);
console.log(`Base de datos SQLite inicializada en: ${FULL_PATH}`);

// Crear la instancia de Drizzle ORM
export const db = drizzle(sqlite, { schema });

// Exportar el cliente SQLite directamente para consultas SQL puras
export { sqlite };
