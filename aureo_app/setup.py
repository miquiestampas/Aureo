import os
import sys
from werkzeug.security import generate_password_hash

def setup_aureo():
    """
    Configura el entorno necesario para Áureo:
    - Crea los directorios necesarios
    - Crea un archivo .env básico si no existe
    """
    base_dir = os.path.abspath(os.path.dirname(__file__))
    
    # Crear estructura de directorios
    dirs = [
        os.path.join(base_dir, 'uploads', 'excel'),
        os.path.join(base_dir, 'uploads', 'pdf'),
        os.path.join(base_dir, 'data', 'excel_watch'),
        os.path.join(base_dir, 'data', 'pdf_watch'),
        os.path.join(base_dir, 'flask_session'),
    ]
    
    for directory in dirs:
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"Directorio creado o verificado: {directory}")
        except Exception as e:
            print(f"Error al crear directorio {directory}: {str(e)}")
            return False
    
    # Crear archivo .env si no existe (con codificación UTF-8 explícita)
    env_path = os.path.join(base_dir, '.env')
    if not os.path.exists(env_path):
        try:
            import secrets
            with open(env_path, 'w', encoding='utf-8') as f:
                f.write(f"# Configuración de Áureo\n")
                f.write(f"FLASK_APP=run.py\n")
                f.write(f"SECRET_KEY={secrets.token_hex(32)}\n")
                f.write(f"FLASK_DEBUG=True\n")
                f.write(f"# FLASK_ENV=development # Para versiones antiguas de Flask\n")
            print(f"Archivo .env creado en: {env_path}")
        except Exception as e:
            print(f"Error al crear archivo .env: {str(e)}")
            return False
    
    print("Configuración completada con éxito.")
    return True

if __name__ == "__main__":
    print("=== Configuración inicial de Áureo ===")
    if setup_aureo():
        print("La configuración se completó correctamente.")
    else:
        print("La configuración no se completó correctamente.")
        sys.exit(1)