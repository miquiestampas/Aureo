import sys
import os
from werkzeug.security import generate_password_hash
from getpass import getpass
import sqlite3

def reset_admin_password():
    """
    Resetea la contraseña del usuario SuperAdmin con ID 1 (cuenta por defecto).
    Este script se ejecuta de forma independiente (sin necesidad de que la aplicación esté funcionando).
    """
    db_path = os.path.join(os.path.dirname(__file__), 'datos.sqlite')
    
    # Verificar que la base de datos existe
    if not os.path.exists(db_path):
        print("Error: La base de datos no existe. Ejecute la aplicación al menos una vez para crearla.")
        return False
    
    try:
        # Solicitar nueva contraseña
        password = getpass("Ingrese la nueva contraseña para el administrador: ")
        confirm_password = getpass("Confirme la nueva contraseña: ")
        
        if password != confirm_password:
            print("Error: Las contraseñas no coinciden.")
            return False
        
        if len(password) < 8:
            print("Error: La contraseña debe tener al menos 8 caracteres.")
            return False
        
        # Generar hash de la contraseña
        password_hash = generate_password_hash(password)
        
        # Conectar a la base de datos
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar si existe el usuario SuperAdmin con username 117020
        cursor.execute("SELECT id FROM user WHERE username = ?", ('117020',))
        admin_user = cursor.fetchone()
        
        if not admin_user:
            print("Error: No se encontró el usuario administrador por defecto (117020).")
            print("¿Quiere crear el usuario administrador? (s/n)")
            if input().lower() != 's':
                return False
            
            # Crear usuario administrador
            cursor.execute("""
                INSERT INTO user (username, password, name, role) 
                VALUES (?, ?, ?, ?)
            """, ('117020', password_hash, 'Administrador', 'SuperAdmin'))
            
            print("Usuario administrador creado con éxito.")
        else:
            # Actualizar contraseña del usuario
            cursor.execute("""
                UPDATE user 
                SET password = ? 
                WHERE username = ?
            """, (password_hash, '117020'))
            
            print("Contraseña del administrador actualizada con éxito.")
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error al resetear la contraseña: {str(e)}")
        return False

if __name__ == "__main__":
    if reset_admin_password():
        print("Operación completada con éxito.")
    else:
        print("La operación no se completó correctamente.")
        sys.exit(1)