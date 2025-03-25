// Script para restablecer la contraseña del SuperAdmin
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Función para generar hash de contraseña
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = crypto.scryptSync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function resetSuperAdminPassword() {
  console.log('Restableciendo contraseña del SuperAdmin...');

  try {
    const hashedPassword = await hashPassword('SuperAdmin');
    
    // Actualizar el usuario con ID 1 (SuperAdmin)
    await db.update(users)
      .set({ 
        password: hashedPassword,
        name: 'Administrador del Sistema'
      })
      .where(eq(users.id, 1))
      .returning();
    
    console.log('Contraseña del SuperAdmin restablecida correctamente.');
    console.log('Usuario: 117020');
    console.log('Contraseña: SuperAdmin');
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
  }
}

resetSuperAdminPassword();