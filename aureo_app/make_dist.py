#!/usr/bin/env python3
"""
Script para generar un archivo zip de distribución de Áureo.
Este script prepara una versión lista para distribución, incluyendo
la base de datos SQLite y creando un archivo .env básico.
Se excluyen archivos temporales, caché y archivos de desarrollo.
"""

import os
import sys
import zipfile
import shutil
import datetime
import argparse

def parse_args():
    """Procesa los argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Genera un archivo zip de distribución de Áureo')
    parser.add_argument('--version', default=None, help='Versión para incluir en el nombre del archivo')
    parser.add_argument('--output-dir', default='..', help='Directorio donde se guardará el zip')
    return parser.parse_args()

def get_version_from_config():
    """Obtiene la versión de la aplicación desde config.py"""
    try:
        with open('config.py', 'r', encoding='utf-8') as file:
            for line in file:
                if 'APP_VERSION' in line and '=' in line:
                    version = line.split('=')[1].strip().strip('"\'')
                    return version
    except Exception:
        return None
    return None

def create_distribution_zip(version=None, output_dir='..'):
    """
    Crea un archivo zip con los archivos necesarios para distribución.
    
    Args:
        version (str, optional): Versión para incluir en el nombre del archivo
        output_dir (str, optional): Directorio donde se guardará el zip
    
    Returns:
        str: Ruta al archivo zip creado, o None si hubo un error
    """
    # Obtener versión
    if not version:
        version = get_version_from_config() or datetime.datetime.now().strftime('%Y%m%d')
    
    # Directorio base de la aplicación
    base_dir = os.path.abspath(os.path.dirname(__file__))
    
    # Nombre del archivo zip
    zip_filename = f"aureo-{version}.zip"
    zip_path = os.path.join(output_dir, zip_filename)
    
    # Asegurar que el directorio de salida existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Archivos y directorios a incluir
    include_dirs = [
        'app',
        'data',
        'uploads',
    ]
    
    include_files = [
        'config.py',
        'run.py',
        'requirements.txt',
        'reset_admin.py',
        'setup.py',
        'start.py',
        'db_update.py',
        'README.md',
        'build_frontend.py',
    ]
    
    # Crear un .env básico con codificación correcta
    env_content = """FLASK_APP=run.py
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=clave_secreta_para_aureo_aplicacion
"""
    
    # Archivos y directorios a excluir
    exclude_patterns = [
        '__pycache__',
        '*.pyc',
        '*.pyo',
        '*.sqlite-journal',
        '.DS_Store',
        'Thumbs.db',
        '*.log',
    ]
    
    # Incluir la base de datos en la distribución
    include_database = True
    
    # Crear un directorio temporal para preparar los archivos
    temp_dir = os.path.join(base_dir, 'temp_dist')
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    try:
        # Copiar directorios
        for dirname in include_dirs:
            src_dir = os.path.join(base_dir, dirname)
            dst_dir = os.path.join(temp_dir, dirname)
            
            if os.path.exists(src_dir):
                # Crear estructura de directorios
                os.makedirs(dst_dir, exist_ok=True)
                
                # Si es un directorio vacío, ya está listo
                if not os.listdir(src_dir):
                    continue
                
                # Copiar contenido del directorio, excluyendo patrones no deseados
                for root, dirs, files in os.walk(src_dir):
                    # Excluir directorios no deseados
                    dirs[:] = [d for d in dirs if not any(d == p or d.endswith(p) for p in exclude_patterns)]
                    
                    # Calcular ruta relativa y crear estructura de directorios en destino
                    rel_path = os.path.relpath(root, src_dir)
                    if rel_path != '.':
                        cur_dst_dir = os.path.join(dst_dir, rel_path)
                        os.makedirs(cur_dst_dir, exist_ok=True)
                    else:
                        cur_dst_dir = dst_dir
                    
                    # Copiar archivos, excluyendo patrones no deseados
                    for file in files:
                        if not any(file == p or file.endswith(p) for p in exclude_patterns):
                            src_file = os.path.join(root, file)
                            dst_file = os.path.join(cur_dst_dir, file)
                            shutil.copy2(src_file, dst_file)
        
        # Copiar archivos individuales
        for filename in include_files:
            src_file = os.path.join(base_dir, filename)
            dst_file = os.path.join(temp_dir, filename)
            
            if os.path.exists(src_file):
                shutil.copy2(src_file, dst_file)
        
        # Incluir la base de datos si está habilitada la opción
        if include_database:
            db_file = os.path.join(base_dir, 'datos.sqlite')
            if os.path.exists(db_file):
                dst_db_file = os.path.join(temp_dir, 'datos.sqlite')
                shutil.copy2(db_file, dst_db_file)
                print(f"Base de datos incluida en la distribución: {db_file}")
        
        # Crear directorio flask_session y archivo .env con codificación UTF-8 explícita
        os.makedirs(os.path.join(temp_dir, 'flask_session'), exist_ok=True)
        
        # Crear archivo .env con codificación explícita UTF-8
        env_file_path = os.path.join(temp_dir, '.env')
        with open(env_file_path, 'w', encoding='utf-8') as f:
            f.write(env_content)
        
        # Crear archivo zip
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    zipf.write(file_path, os.path.relpath(file_path, temp_dir))
        
        print(f"Archivo de distribución creado: {zip_path}")
        return zip_path
    except Exception as e:
        print(f"Error al crear archivo de distribución: {str(e)}")
        return None
    finally:
        # Limpiar directorio temporal
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == "__main__":
    args = parse_args()
    zip_path = create_distribution_zip(args.version, args.output_dir)
    
    if zip_path and os.path.exists(zip_path):
        print(f"Distribución creada correctamente: {zip_path}")
        sys.exit(0)
    else:
        print("Error al crear la distribución.")
        sys.exit(1)