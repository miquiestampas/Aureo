import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function updateTables() {
  console.log("Actualizando tablas para añadir el campo 'interesado'...");
  
  try {
    // Verificar si el campo interesado ya existe en senal_personas
    try {
      db.run(sql`
        ALTER TABLE senal_personas ADD COLUMN interesado TEXT;
      `);
      console.log("Campo 'interesado' añadido a la tabla senal_personas.");
    } catch (error: any) {
      if (error.message.includes("duplicate column name")) {
        console.log("El campo 'interesado' ya existe en la tabla senal_personas.");
      } else {
        throw error;
      }
    }
    
    // Verificar si el campo interesado ya existe en senal_objetos
    try {
      db.run(sql`
        ALTER TABLE senal_objetos ADD COLUMN interesado TEXT;
      `);
      console.log("Campo 'interesado' añadido a la tabla senal_objetos.");
    } catch (error: any) {
      if (error.message.includes("duplicate column name")) {
        console.log("El campo 'interesado' ya existe en la tabla senal_objetos.");
      } else {
        throw error;
      }
    }
    
    // Verificar si las columnas customer_address, customer_location e item_weight existen en excel_data
    try {
      db.run(sql`
        ALTER TABLE excel_data ADD COLUMN customer_address TEXT;
      `);
      console.log("Campo 'customer_address' añadido a la tabla excel_data.");
    } catch (error: any) {
      if (error.message.includes("duplicate column name")) {
        console.log("El campo 'customer_address' ya existe en la tabla excel_data.");
      } else {
        throw error;
      }
    }
    
    try {
      db.run(sql`
        ALTER TABLE excel_data ADD COLUMN customer_location TEXT;
      `);
      console.log("Campo 'customer_location' añadido a la tabla excel_data.");
    } catch (error: any) {
      if (error.message.includes("duplicate column name")) {
        console.log("El campo 'customer_location' ya existe en la tabla excel_data.");
      } else {
        throw error;
      }
    }
    
    try {
      db.run(sql`
        ALTER TABLE excel_data ADD COLUMN item_weight TEXT;
      `);
      console.log("Campo 'item_weight' añadido a la tabla excel_data.");
    } catch (error: any) {
      if (error.message.includes("duplicate column name")) {
        console.log("El campo 'item_weight' ya existe en la tabla excel_data.");
      } else {
        throw error;
      }
    }
    
    console.log("Actualización de tablas completada con éxito.");
    
  } catch (error) {
    console.error("Error al actualizar las tablas:", error);
    throw error;
  }
}

updateTables().then(() => {
  console.log("Base de datos SQLite actualizada correctamente.");
  process.exit(0);
}).catch(error => {
  console.error("Error al actualizar la base de datos:", error);
  process.exit(1);
});