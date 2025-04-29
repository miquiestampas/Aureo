import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import { sql } from 'drizzle-orm';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

// Función para obtener la ruta de la base de datos desde system_configs o usar la predeterminada
function getDatabasePathSync() {
  // Intentar leer la ruta de system_configs
  try {
    const configPath = path.join('./aureo_app', 'datos.sqlite');
    if (!fs.existsSync('./aureo_app')) {
      fs.mkdirSync('./aureo_app', { recursive: true });
    }
    // Leer la ruta de system_configs si existe
    try {
      const configFile = path.join('./aureo_app', 'system_configs.json');
      if (fs.existsSync(configFile)) {
        const configs = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (configs.DATABASE_PATH && typeof configs.DATABASE_PATH === 'string') {
          return configs.DATABASE_PATH;
        }
      }
    } catch {}
    return configPath;
  } catch {
    return './aureo_app/datos.sqlite';
  }
}

function initializeDatabaseConnection(dbPath?: string) {
  const pathToUse = dbPath || getDatabasePathSync();
  sqlite = new Database(pathToUse);
  db = drizzle(sqlite, { schema });
  console.log(`Base de datos SQLite inicializada en: ${pathToUse}`);
  return db;
}

// Inicializar la conexión al arrancar
initializeDatabaseConnection();

// Exportar el cliente SQLite directamente para consultas SQL puras
export { sqlite };

export { db, initializeDatabaseConnection };
