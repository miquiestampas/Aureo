import { db } from './db';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function createTables() {
  console.log("Creando tablas en la base de datos SQLite...");
  
  try {
    // Crear las tablas de manera individual para evitar problemas con consultas muy largas
    
    // Tabla users
    db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'User'
      );
    `);
    console.log("Tabla users creada.");
    
    // Tabla stores
    db.run(sql`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        district TEXT,
        locality TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        email TEXT,
        cif TEXT,
        business_name TEXT,
        owner_name TEXT,
        owner_id_number TEXT,
        start_date TEXT,
        end_date TEXT,
        notes TEXT
      );
    `);
    console.log("Tabla stores creada.");
    
    // Tabla system_configs
    db.run(sql`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT
      );
    `);
    console.log("Tabla system_configs creada.");
    
    // Tabla file_activities
    db.run(sql`
      CREATE TABLE IF NOT EXISTS file_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        store_code TEXT NOT NULL,
        file_type TEXT NOT NULL,
        status TEXT NOT NULL,
        processing_date TEXT NOT NULL,
        processed_by TEXT NOT NULL,
        error_message TEXT,
        metadata TEXT,
        detected_store_code TEXT
      );
    `);
    console.log("Tabla file_activities creada.");
    
    // Tabla excel_data
    db.run(sql`
      CREATE TABLE IF NOT EXISTS excel_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT NOT NULL,
        order_number TEXT NOT NULL,
        order_date TEXT NOT NULL,
        customer_name TEXT,
        customer_contact TEXT,
        customer_address TEXT,
        customer_location TEXT,
        item_details TEXT,
        item_weight TEXT,
        metals TEXT,
        engravings TEXT,
        stones TEXT,
        carats TEXT,
        price TEXT,
        pawn_ticket TEXT,
        sale_date TEXT,
        file_activity_id INTEGER NOT NULL
      );
    `);
    console.log("Tabla excel_data creada.");
    
    // Tabla pdf_documents
    db.run(sql`
      CREATE TABLE IF NOT EXISTS pdf_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT NOT NULL,
        document_type TEXT,
        title TEXT,
        path TEXT NOT NULL,
        upload_date TEXT NOT NULL,
        file_size INTEGER,
        file_activity_id INTEGER NOT NULL
      );
    `);
    console.log("Tabla pdf_documents creada.");
    
    // Tabla watchlist_persons
    db.run(sql`
      CREATE TABLE IF NOT EXISTS watchlist_persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        identificationnumber TEXT,
        phone TEXT,
        notes TEXT,
        risklevel TEXT NOT NULL DEFAULT 'Medio',
        status TEXT NOT NULL DEFAULT 'Activo',
        createdat TEXT NOT NULL,
        createdby INTEGER NOT NULL,
        lastupdated TEXT
      );
    `);
    console.log("Tabla watchlist_persons creada.");
    
    // Tabla watchlist_items
    db.run(sql`
      CREATE TABLE IF NOT EXISTS watchlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemtype TEXT NOT NULL,
        description TEXT NOT NULL,
        serialnumber TEXT,
        identificationmarks TEXT,
        model TEXT,
        brand TEXT,
        notes TEXT,
        risklevel TEXT NOT NULL DEFAULT 'Medio',
        status TEXT NOT NULL DEFAULT 'Activo',
        createdat TEXT NOT NULL,
        createdby INTEGER NOT NULL,
        lastupdated TEXT
      );
    `);
    console.log("Tabla watchlist_items creada.");
    
    // Tabla alerts
    db.run(sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        excel_data_id INTEGER NOT NULL,
        watchlist_person_id INTEGER,
        watchlist_item_id INTEGER,
        match_confidence INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Nueva',
        reviewed_by INTEGER,
        review_notes TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
    `);
    console.log("Tabla alerts creada.");
    
    // Tabla search_history
    db.run(sql`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        search_type TEXT NOT NULL,
        search_terms TEXT NOT NULL,
        search_date TEXT NOT NULL,
        result_count INTEGER NOT NULL
      );
    `);
    console.log("Tabla search_history creada.");
    
    // Tabla senal_personas
    db.run(sql`
      CREATE TABLE IF NOT EXISTS senal_personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        documento_id TEXT,
        interesado TEXT,
        notas TEXT,
        estado TEXT NOT NULL DEFAULT 'Activo',
        creado_por INTEGER NOT NULL,
        creado_en TEXT NOT NULL,
        modificado_por INTEGER,
        modificado_en TEXT
      );
    `);
    console.log("Tabla senal_personas creada.");
    
    // Tabla senal_objetos
    db.run(sql`
      CREATE TABLE IF NOT EXISTS senal_objetos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT,
        grabacion TEXT,
        interesado TEXT,
        notas TEXT,
        estado TEXT NOT NULL DEFAULT 'Activo',
        creado_por INTEGER NOT NULL,
        creado_en TEXT NOT NULL,
        modificado_por INTEGER,
        modificado_en TEXT
      );
    `);
    console.log("Tabla senal_objetos creada.");
    
    // Tabla coincidencias
    db.run(sql`
      CREATE TABLE IF NOT EXISTS coincidencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo_coincidencia TEXT NOT NULL,
        id_senal_persona INTEGER,
        id_senal_objeto INTEGER,
        id_excel_data INTEGER NOT NULL,
        puntuacion_coincidencia INTEGER NOT NULL,
        tipo_match TEXT NOT NULL,
        campo_coincidente TEXT NOT NULL,
        valor_coincidente TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'NoLeido',
        revisado_por INTEGER,
        notas_revision TEXT,
        creado_en TEXT NOT NULL,
        revisado_en TEXT
      );
    `);
    console.log("Tabla coincidencias creada.");
    
    console.log("Tablas creadas correctamente.");
    
    // Comprobamos si necesitamos crear el usuario SuperAdmin
    const userCount = db.select({ count: sql`count(*)` }).from(schema.users).all();
    
    if (!userCount.length || userCount[0].count === 0) {
      console.log("Creando usuario SuperAdmin inicial...");
      
      const hashedPassword = await hashPassword("admin");
      
      // Insertamos el usuario SuperAdmin
      db.insert(schema.users).values({
        username: "117020",
        password: hashedPassword,
        name: "Salva",
        role: "SuperAdmin"
      }).run();
      
      console.log("Usuario SuperAdmin creado con éxito.");
      console.log("Username: 117020");
      console.log("Password: admin");
    } else {
      console.log("Ya existe al menos un usuario en la base de datos. No se creará un SuperAdmin.");
    }
    
    // Crear las carpetas necesarias para el almacenamiento de archivos
    const directories = [
      './data',
      './data/excel',
      './data/pdf',
      './data/excel/procesados',
      './data/pdf/procesados',
      './uploads',
      './uploads/excel',
      './uploads/pdf'
    ];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Directorio creado: ${dir}`);
      }
    }
    
    console.log("Inicialización de la base de datos completada con éxito.");
    
  } catch (error) {
    console.error("Error al crear las tablas:", error);
    throw error;
  }
}

createTables().then(() => {
  console.log("Base de datos SQLite inicializada correctamente.");
  process.exit(0);
}).catch(error => {
  console.error("Error al inicializar la base de datos:", error);
  process.exit(1);
});