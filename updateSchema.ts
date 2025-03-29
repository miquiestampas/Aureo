import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./shared/schema";

async function main() {
  // Conexión a la base de datos
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    // Actualizar senal_personas tabla para permitir valores nulos en nombre
    console.log("Modificando la tabla senal_personas para permitir nombres nulos...");
    await client`
      ALTER TABLE senal_personas 
      ALTER COLUMN nombre DROP NOT NULL;
    `;
    console.log("Modificación completada exitosamente.");

    // Comprobar si la columna created_at ya existe en la tabla stores
    const columnCheck = await client`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'stores' AND column_name = 'created_at';
    `;

    // Si la columna no existe, añadirla
    if (columnCheck.length === 0) {
      console.log("Añadiendo columna created_at a la tabla stores...");
      await client`
        ALTER TABLE stores 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
      `;
      console.log("Columna created_at añadida exitosamente a la tabla stores.");
    } else {
      console.log("La columna created_at ya existe en la tabla stores. No se requieren cambios.");
    }
  } catch (error) {
    console.error("Error al modificar las tablas:", error);
  } finally {
    // Cerrar conexión
    await client.end();
  }
}

main().catch(e => {
  console.error("Error al ejecutar la migración:", e);
  process.exit(1);
});