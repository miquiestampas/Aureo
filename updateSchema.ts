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
  } catch (error) {
    console.error("Error al modificar la tabla:", error);
  } finally {
    // Cerrar conexión
    await client.end();
  }
}

main().catch(e => {
  console.error("Error al ejecutar la migración:", e);
  process.exit(1);
});