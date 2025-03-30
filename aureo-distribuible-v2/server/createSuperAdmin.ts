// Script para crear o restablecer el usuario SuperAdmin
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

// Función para generar hash de contraseña de forma asíncrona
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function resetSuperAdminPassword() {
  console.log('Configurando el usuario SuperAdmin...');

  try {
    const hashedPassword = await hashPassword('SuperAdmin');
    
    // Buscar si existe el usuario SuperAdmin
    const existingUser = await db.select().from(users).where(eq(users.username, '117020'));
    
    if (existingUser && existingUser.length > 0) {
      // Actualizar el usuario existente
      await db.update(users)
        .set({ 
          password: hashedPassword,
          name: 'Administrador del Sistema',
          role: 'SuperAdmin'
        })
        .where(eq(users.id, existingUser[0].id));
      
      console.log('Contraseña del SuperAdmin restablecida correctamente.');
    } else {
      // Crear nuevo usuario SuperAdmin
      await db.insert(users)
        .values({
          username: '117020',
          password: hashedPassword,
          name: 'Administrador del Sistema',
          role: 'SuperAdmin'
        });
      
      console.log('Usuario SuperAdmin creado correctamente.');
    }
    
    console.log('Usuario: 117020');
    console.log('Contraseña: SuperAdmin');
  } catch (error) {
    console.error('Error configurando SuperAdmin:', error);
  }
}

// Ejecutar la función
resetSuperAdminPassword().then(() => {
  console.log('Proceso completado.');
  process.exit(0);
}).catch(err => {
  console.error('Error en el proceso:', err);
  process.exit(1);
});