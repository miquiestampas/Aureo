// Script para restablecer la contraseña del SuperAdmin
const { db } = require('./server/db');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');
const crypto = require('crypto');

// Función para generar hash de contraseña
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = crypto.scryptSync(password, salt, 64);
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
        .where(eq(users.id, existingUser[0].id))
        .returning();
      
      console.log('Contraseña del SuperAdmin restablecida correctamente.');
    } else {
      // Crear nuevo usuario SuperAdmin
      await db.insert(users)
        .values({
          username: '117020',
          password: hashedPassword,
          name: 'Administrador del Sistema',
          role: 'SuperAdmin'
        })
        .returning();
      
      console.log('Usuario SuperAdmin creado correctamente.');
    }
    
    console.log('Usuario: 117020');
    console.log('Contraseña: SuperAdmin');
  } catch (error) {
    console.error('Error configurando SuperAdmin:', error);
  }
}

resetSuperAdminPassword();