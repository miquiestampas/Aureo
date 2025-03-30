import { db } from "./server/db";
import {
  users,
  stores,
  systemConfigs,
  fileActivities,
  excelData,
  pdfDocuments,
  searchHistories,
  watchlistPersons,
  watchlistItems,
  alerts,
  senalPersonas,
  senalObjetos,
  coincidencias,
} from "./shared/schema";

async function createTables() {
  try {
    console.log("Comenzando la creación de tablas...");

    // Crear todas las tablas definidas en el esquema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'User'
      );

      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        location TEXT,
        district TEXT,
        locality TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        address TEXT,
        phone TEXT,
        email TEXT,
        cif TEXT,
        business_name TEXT,
        owner_name TEXT,
        owner_id_number TEXT,
        start_date DATE,
        end_date DATE,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS system_configs (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS file_activities (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        store_code TEXT NOT NULL,
        file_type TEXT NOT NULL,
        status TEXT NOT NULL,
        processing_date TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_by TEXT NOT NULL,
        error_message TEXT,
        metadata JSONB,
        detected_store_code TEXT
      );

      CREATE TABLE IF NOT EXISTS excel_data (
        id SERIAL PRIMARY KEY,
        store_code TEXT NOT NULL,
        order_number TEXT NOT NULL,
        order_date DATE NOT NULL,
        customer_name TEXT,
        customer_contact TEXT,
        item_details TEXT,
        metals TEXT,
        stones TEXT,
        price DOUBLE PRECISION,
        weight DOUBLE PRECISION,
        engravings TEXT,
        purchase_type TEXT,
        sale_date DATE,
        file_activity_id INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pdf_documents (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        store_code TEXT NOT NULL,
        document_type TEXT,
        title TEXT,
        upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
        file_size INTEGER,
        file_activity_id INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS search_histories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        search_type TEXT NOT NULL,
        search_terms TEXT NOT NULL,
        search_date TIMESTAMP NOT NULL DEFAULT NOW(),
        result_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watchlist_persons (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL,
        phone TEXT,
        notes TEXT,
        full_name TEXT NOT NULL,
        identification_number TEXT,
        risk_level TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL,
        last_updated TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS watchlist_items (
        id SERIAL PRIMARY KEY,
        brand TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        description TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        serial_number TEXT,
        identification_marks TEXT,
        model TEXT,
        last_updated TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        alert_type TEXT NOT NULL,
        excel_data_id INTEGER NOT NULL,
        watchlist_person_id INTEGER,
        watchlist_item_id INTEGER,
        match_confidence INTEGER NOT NULL,
        reviewed_by INTEGER,
        review_notes TEXT,
        resolved_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS senal_personas (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        documento_id TEXT,
        notas TEXT,
        estado TEXT NOT NULL DEFAULT 'Activo',
        nivel_riesgo TEXT NOT NULL DEFAULT 'Medio',
        creado_por INTEGER NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
        modificado_por INTEGER,
        modificado_en TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS senal_objetos (
        id SERIAL PRIMARY KEY,
        descripcion TEXT NOT NULL,
        grabacion TEXT,
        notas TEXT,
        estado TEXT NOT NULL DEFAULT 'Activo',
        nivel_riesgo TEXT NOT NULL DEFAULT 'Medio',
        creado_por INTEGER NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
        modificado_por INTEGER,
        modificado_en TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coincidencias (
        id SERIAL PRIMARY KEY,
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
        creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
        revisado_en TIMESTAMP
      );
    `);

    console.log("✅ Todas las tablas han sido creadas exitosamente.");
  } catch (error) {
    console.error("Error al crear las tablas:", error);
  } finally {
    process.exit(0);
  }
}

createTables();