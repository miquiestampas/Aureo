import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const scryptAsync = promisify(scrypt);

// Ruta donde se creará la base de datos SQLite
const DB_PATH = './aureo_app';
const DB_FILE = 'datos.sqlite';
const FULL_PATH = path.join(DB_PATH, DB_FILE);

// Crear la conexión a la base de datos SQLite
const sqlite = new Database(FULL_PATH);
console.log(`Base de datos SQLite conectada en: ${FULL_PATH}`);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function resetSuperAdminPassword() {
  try {
    // Primero, revisar si el usuario existe
    const userExists = sqlite.prepare("SELECT id FROM users WHERE username = ?").get("117020");
    
    // Generar una nueva contraseña hasheada
    const hashedPassword = await hashPassword("admin");
    
    if (userExists) {
      // Actualizar la contraseña si el usuario existe
      sqlite
        .prepare("UPDATE users SET password = ? WHERE username = ?")
        .run(hashedPassword, "117020");
      console.log("Contraseña del SuperAdmin actualizada correctamente.");
    } else {
      // Crear el usuario si no existe
      sqlite
        .prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)")
        .run("117020", hashedPassword, "Salva", "SuperAdmin");
      console.log("Usuario SuperAdmin creado correctamente.");
    }
    
  } catch (error) {
    console.error("Error al resetear la contraseña:", error);
  } finally {
    // Cerrar la conexión a la base de datos
    sqlite.close();
  }
}

resetSuperAdminPassword();