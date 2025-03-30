#!/usr/bin/env python3
"""
Script para generar un archivo zip de distribución de la aplicación Áureo.
Este script:
1. Compila el frontend de React
2. Crea un archivo zip con todos los archivos necesarios
3. Incluye instrucciones de instalación y uso
"""

import os
import sys
import zipfile
import shutil
import datetime
import subprocess
import argparse

# Esta función se ha integrado directamente en main()

def get_version():
    """Obtiene la versión de la aplicación desde config.py o genera una basada en la fecha"""
    try:
        config_path = os.path.join('aureo_app', 'config.py')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as file:
                for line in file:
                    if 'APP_VERSION' in line and '=' in line:
                        version = line.split('=')[1].strip().strip('"\'')
                        return version
    except Exception:
        pass
        
    # Si no se puede obtener la versión, usar la fecha actual
    return datetime.datetime.now().strftime('%Y%m%d')

def compile_frontend():
    """Compila el frontend de React"""
    base_dir = os.path.abspath('.')
    client_dir = os.path.join(base_dir, 'client')
    
    # Verificar que existe el directorio del cliente
    if not os.path.exists(client_dir):
        print(f"Error: No se encontró el directorio del cliente en: {client_dir}")
        return False
    
    try:
        print("Compilando el frontend de React...")
        
        # Ejecutar npm run build en el directorio raíz (donde está configurado el build de Vite)
        process = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=base_dir,  # Usar el directorio raíz donde está package.json principal
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Verificar si el proceso fue exitoso
        if process.returncode != 0:
            print("Error al compilar el frontend:")
            print(process.stderr)
            return False
        
        # Verificar que se creó la carpeta dist/public
        dist_dir = os.path.join(base_dir, 'dist', 'public')
        if not os.path.exists(dist_dir):
            print(f"Error: No se encontró el directorio de compilación en: {dist_dir}")
            return False
            
        print("Frontend compilado con éxito.")
        return True
        
    except Exception as e:
        print(f"Error al compilar el frontend: {str(e)}")
        return False

def create_distribution_zip(version=None, output_dir='.'):
    """Crea un archivo zip con todos los archivos necesarios para distribución"""
    # Obtener versión
    if not version:
        version = get_version()
    
    # Directorio base del proyecto
    base_dir = os.path.abspath('.')
    aureo_app_dir = os.path.join(base_dir, 'aureo_app')
    client_dir = os.path.join(base_dir, 'client')
    temp_dir = os.path.join(base_dir, 'tmp_dist')
    
    # Nombre del archivo zip
    zip_filename = f"aureo-{version}.zip"
    zip_path = os.path.join(output_dir, zip_filename)
    
    # Asegurar que el directorio de salida existe
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Crear directorio temporal para la distribución
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)
        
        # Copiar archivos de aureo_app
        aureo_dist_dir = os.path.join(temp_dir, 'aureo_app')
        os.makedirs(aureo_dist_dir)
        
        # Archivos y directorios a incluir de aureo_app
        include_dirs = [
            'app',
            'data',
            'uploads',
            'flask_session',
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
        
        # Archivos y directorios a excluir
        exclude_patterns = [
            '__pycache__',
            '__pycache__/',
            '*.pyc',
            '*.pyo',
            '*/__pycache__/*',
            '*.sqlite',
            '*.sqlite-journal',
            '.DS_Store',
            'Thumbs.db',
            '*.log',
        ]
        
        # Copiar directorios
        for dirname in include_dirs:
            src_dir = os.path.join(aureo_app_dir, dirname)
            dst_dir = os.path.join(aureo_dist_dir, dirname)
            
            # Siempre crear el directorio en el destino, exista o no en el origen
            os.makedirs(dst_dir, exist_ok=True)
            
            if os.path.exists(src_dir):
                for root, dirs, files in os.walk(src_dir):
                    # Filtrar directorios que no queremos incluir
                    dirs[:] = [d for d in dirs if d != '__pycache__']
                    
                    # Crear la estructura de directorios en el destino
                    rel_path = os.path.relpath(root, src_dir)
                    cur_dst_dir = os.path.join(dst_dir, rel_path) if rel_path != '.' else dst_dir
                    os.makedirs(cur_dst_dir, exist_ok=True)
                    
                    # Copiar archivos, excluyendo los que coincidan con patrones
                    for file in files:
                        if not any(file == p or file.endswith(p) for p in exclude_patterns):
                            src_file = os.path.join(root, file)
                            dst_file = os.path.join(cur_dst_dir, file)
                            shutil.copy2(src_file, dst_file)
        
        # Asegurar que existan directorios críticos aunque estén vacíos
        critical_dirs = [
            os.path.join(aureo_dist_dir, 'app', 'static'),
            os.path.join(aureo_dist_dir, 'app', 'templates'),
            os.path.join(aureo_dist_dir, 'data', 'excel_watch'),
            os.path.join(aureo_dist_dir, 'data', 'pdf_watch'),
            os.path.join(aureo_dist_dir, 'uploads'),
            os.path.join(aureo_dist_dir, 'uploads', 'excel'),
            os.path.join(aureo_dist_dir, 'uploads', 'pdf'),
            os.path.join(aureo_dist_dir, 'uploads', 'temp'),
            os.path.join(aureo_dist_dir, 'flask_session'),
        ]
        
        for dir_path in critical_dirs:
            os.makedirs(dir_path, exist_ok=True)
            
            # Agregar un archivo .gitkeep para mantener la estructura del directorio en el zip
            gitkeep_file = os.path.join(dir_path, '.gitkeep')
            with open(gitkeep_file, 'w') as f:
                f.write('# Este archivo se incluye para mantener la estructura del directorio\n')
        
        # Copiar archivos individuales
        for filename in include_files:
            src_file = os.path.join(aureo_app_dir, filename)
            dst_file = os.path.join(aureo_dist_dir, filename)
            
            if os.path.exists(src_file):
                shutil.copy2(src_file, dst_file)
        
        # Copiar el frontend compilado (si existe)
        # Buscar primero en la ubicación de build más reciente (la raíz dist/public)
        dist_public_dir = os.path.join(base_dir, 'dist', 'public')
        client_build_dir = os.path.join(client_dir, 'dist')
        
        build_dir = dist_public_dir if os.path.exists(dist_public_dir) else client_build_dir
        
        if os.path.exists(build_dir):
            print(f"Copiando frontend compilado desde: {build_dir}")
            # Copiar el frontend compilado al directorio static de Flask
            static_dir = os.path.join(aureo_dist_dir, 'app', 'static')
            templates_dir = os.path.join(aureo_dist_dir, 'app', 'templates')
            
            # Crear directorios si no existen
            os.makedirs(static_dir, exist_ok=True)
            os.makedirs(templates_dir, exist_ok=True)
            
            # Copiar index.html a templates
            index_html = os.path.join(build_dir, 'index.html')
            if os.path.exists(index_html):
                shutil.copy(index_html, os.path.join(templates_dir, 'index.html'))
            
            # Copiar el resto de archivos a static
            for item in os.listdir(build_dir):
                if item == 'index.html':
                    continue
                    
                src = os.path.join(build_dir, item)
                dst = os.path.join(static_dir, item)
                
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
                else:
                    # Cuando encontramos el directorio assets, asegurarnos de copiar todo su contenido
                    if item == 'assets':
                        print(f"Copiando directorio assets y su contenido a {os.path.join(static_dir, 'assets')}")
                    shutil.copytree(src, dst)
        
        # Copiar las instrucciones de instalación
        instructions_file = os.path.join(base_dir, 'INSTRUCCIONES_INSTALACION.md')
        if os.path.exists(instructions_file):
            shutil.copy2(instructions_file, os.path.join(temp_dir, 'LEEME.md'))
            
        # Copiar el README principal
        readme_file = os.path.join(base_dir, 'README.md')
        if os.path.exists(readme_file):
            shutil.copy2(readme_file, os.path.join(temp_dir, 'README.md'))
        
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

def main():
    parser = argparse.ArgumentParser(description='Genera un archivo zip de distribución de Áureo')
    parser.add_argument('--version', default=None, help='Versión para incluir en el nombre del archivo')
    parser.add_argument('--output-dir', default='.', help='Directorio donde se guardará el zip')
    parser.add_argument('--skip-frontend', action='store_true', help='Omitir la compilación del frontend')
    args = parser.parse_args()
    
    # Paso 1: Compilar el frontend (a menos que se indique lo contrario)
    frontend_success = True
    if not args.skip_frontend:
        print("=== Compilando frontend ===")
        frontend_success = compile_frontend()
        if not frontend_success:
            print("Advertencia: No se pudo compilar el frontend. Continuando con la distribución...")
    else:
        print("=== Omitiendo compilación del frontend ===")
    
    # Paso 2: Crear el archivo de distribución
    print("=== Creando archivo de distribución ===")
    zip_path = create_distribution_zip(args.version, args.output_dir)
    
    if zip_path and os.path.exists(zip_path):
        print(f"\n¡Distribución creada correctamente!")
        print(f"Archivo: {zip_path}")
        print("\nContenido:")
        print("- Aplicación backend (Flask)")
        print("- Interfaz de usuario compilada")
        print("- Instrucciones de instalación y uso")
        return 0
    else:
        print("Error al crear la distribución")
        return 1

if __name__ == "__main__":
    sys.exit(main())