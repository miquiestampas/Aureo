import os
import sys
import subprocess
import sqlite3
from app import create_app, db
from app.models import init_db

def backup_database():
    """Crea una copia de seguridad de la base de datos antes de actualizarla"""
    base_dir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(base_dir, 'datos.sqlite')
    backup_path = os.path.join(base_dir, 'datos.sqlite.bak')
    
    if os.path.exists(db_path):
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"Copia de seguridad creada en: {backup_path}")
        return True
    return False

def check_if_update_needed():
    """Verifica si es necesario actualizar la estructura de la base de datos"""
    # Esta función es muy básica, en producción se recomendaría usar
    # una herramienta de migración como Alembic
    app = create_app()
    with app.app_context():
        try:
            # Verificar que todas las tablas y columnas existen
            # Este método es muy simple y no detecta todos los cambios
            conn = sqlite3.connect(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
            cursor = conn.cursor()
            
            # Obtener todas las tablas en la base de datos
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
            
            # Lista de tablas que deberían existir (actualizar según cambios)
            required_tables = [
                'user', 'store', 'system_config', 'file_activity', 
                'excel_data', 'pdf_document', 'watchlist_person', 
                'watchlist_item', 'alert', 'search_history'
            ]
            
            missing_tables = [table for table in required_tables if table not in tables]
            
            if missing_tables:
                print(f"Tablas faltantes: {missing_tables}")
                return True
                
            return False
        except Exception as e:
            print(f"Error al verificar estructura de base de datos: {str(e)}")
            return True

def update_database_schema():
    """Actualiza la estructura de la base de datos según el modelo actual"""
    try:
        # Crear aplicación y contexto
        app = create_app()
        with app.app_context():
            # Obtener los datos importantes antes de recrear las tablas
            users_data = []
            try:
                # Obtener usuarios
                conn = sqlite3.connect(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
                cursor = conn.cursor()
                cursor.execute("SELECT id, username, password, name, role FROM user")
                users_data = cursor.fetchall()
                
                # Obtener otras tablas según sea necesario
                # Aquí se podrían guardar más datos para restaurarlos después
                
                conn.close()
            except Exception as e:
                print(f"Advertencia: No se pudieron recuperar datos existentes: {str(e)}")
            
            # Recrear todas las tablas
            db.drop_all()
            init_db()
            
            # Restaurar datos importantes
            if users_data:
                conn = sqlite3.connect(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
                cursor = conn.cursor()
                
                # Restaurar usuarios
                for user in users_data:
                    user_id, username, password, name, role = user
                    try:
                        cursor.execute("""
                            INSERT INTO user (id, username, password, name, role)
                            VALUES (?, ?, ?, ?, ?)
                        """, (user_id, username, password, name, role))
                    except Exception as e:
                        print(f"Error al restaurar usuario {username}: {str(e)}")
                
                conn.commit()
                conn.close()
            
            print("Base de datos actualizada correctamente.")
            return True
    except Exception as e:
        print(f"Error al actualizar la base de datos: {str(e)}")
        return False

def main():
    print("Verificando estructura de la base de datos...")
    
    if not check_if_update_needed():
        print("La base de datos está actualizada. No se requieren cambios.")
        return True
    
    print("Se requiere actualizar la estructura de la base de datos.")
    
    if not backup_database():
        print("Advertencia: No se pudo crear una copia de seguridad (¿base de datos nueva?).")
    
    response = input("¿Desea continuar con la actualización? (s/n): ")
    if response.lower() != 's':
        print("Actualización cancelada.")
        return False
    
    if update_database_schema():
        print("Base de datos actualizada correctamente.")
        return True
    else:
        print("Error al actualizar la base de datos.")
        return False

if __name__ == "__main__":
    if main():
        sys.exit(0)
    else:
        sys.exit(1)