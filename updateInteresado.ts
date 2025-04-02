import { db } from "./server/db";

async function addInteresadoColumn() {
    try {
        console.log("Añadiendo columna 'interesado' a la tabla senal_personas...");
        await db.run(`ALTER TABLE senal_personas ADD COLUMN interesado TEXT;`);
        console.log("Columna 'interesado' añadida correctamente a senal_personas.");
        
        console.log("Añadiendo columna 'interesado' a la tabla senal_objetos...");
        await db.run(`ALTER TABLE senal_objetos ADD COLUMN interesado TEXT;`);
        console.log("Columna 'interesado' añadida correctamente a senal_objetos.");
        
        console.log("Migración completada satisfactoriamente.");
    } catch (error) {
        console.error("Error durante la migración:", error);
    } finally {
        process.exit();
    }
}

// Ejecutar la función
addInteresadoColumn();