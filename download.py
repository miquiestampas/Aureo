#!/usr/bin/env python3
"""
Script para descargar la última versión de Áureo y descomprimirla.
Este script está diseñado para ser ejecutado en Windows para facilitar
la instalación y actualización de Áureo.
"""

import os
import sys
import zipfile
import tempfile
from urllib.request import urlretrieve
import shutil

def main():
    # URL del archivo de distribución
    dist_url = "https://raw.githubusercontent.com/replit/Aureo/main/aureo-1.0.0.zip"
    
    print("=== Descargador de Áureo ===")
    print("Este script descargará e instalará la última versión de Áureo.")
    print()
    
    # Directorio de destino
    dest_dir = input("Ingrese el directorio donde desea instalar Áureo (por defecto: C:\\Aureo): ").strip()
    if not dest_dir:
        dest_dir = "C:\\Aureo"
    
    # Crear directorio si no existe
    if not os.path.exists(dest_dir):
        try:
            os.makedirs(dest_dir, exist_ok=True)
            print(f"Directorio creado: {dest_dir}")
        except Exception as e:
            print(f"Error al crear directorio: {str(e)}")
            return 1
    
    # Descargar archivo zip
    print(f"Descargando Áureo desde {dist_url}...")
    try:
        # Usar un archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_file:
            temp_path = temp_file.name
        
        # Descargar al archivo temporal
        urlretrieve(dist_url, temp_path)
        print("Descarga completada.")
        
        # Descomprimir
        print(f"Descomprimiendo en {dest_dir}...")
        with zipfile.ZipFile(temp_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
        
        print("Áureo ha sido instalado correctamente.")
        print(f"Para iniciar la aplicación, abra {dest_dir} y ejecute iniciar_aureo.bat")
        
        # Limpiar archivo temporal
        os.unlink(temp_path)
        return 0
        
    except Exception as e:
        print(f"Error durante la descarga o instalación: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())