#!/usr/bin/env python

import os
import sys
import subprocess
import argparse
import time

def main():
    """
    Script principal para iniciar la aplicación Áureo.
    
    Pasos:
    1. Ejecuta setup.py para crear los directorios necesarios
    2. (Opcional) Ejecuta build_frontend.py para compilar el frontend
    3. Inicia la aplicación Flask con run.py
    """
    base_dir = os.path.abspath(os.path.dirname(__file__))
    
    # Analizar argumentos de línea de comandos
    parser = argparse.ArgumentParser(description='Inicia la aplicación Áureo')
    parser.add_argument('--skip-setup', action='store_true', help='Omitir la configuración inicial')
    parser.add_argument('--skip-build', action='store_true', help='Omitir la compilación del frontend')
    parser.add_argument('--debug', action='store_true', help='Iniciar en modo depuración')
    parser.add_argument('--host', default='127.0.0.1', help='Host para escuchar (por defecto: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='Puerto para escuchar (por defecto: 5000)')
    
    args = parser.parse_args()
    
    # Paso 1: Configuración inicial
    if not args.skip_setup:
        print("=== Ejecutando configuración inicial ===")
        setup_script = os.path.join(base_dir, 'setup.py')
        result = subprocess.run([sys.executable, setup_script], check=False)
        
        if result.returncode != 0:
            print("Error en la configuración inicial. Revise los logs para más detalles.")
            return result.returncode
    
    # Paso 2: Compilar frontend (opcional)
    if not args.skip_build:
        print("=== Compilando frontend ===")
        build_script = os.path.join(base_dir, 'build_frontend.py')
        
        if os.path.exists(build_script):
            result = subprocess.run([sys.executable, build_script], check=False)
            
            if result.returncode != 0:
                print("Error al compilar el frontend. Revise los logs para más detalles.")
                print("Continuando con la aplicación backend...")
        else:
            print("Script de compilación no encontrado. Omitiendo compilación del frontend.")
    
    # Paso 3: Iniciar la aplicación Flask
    print(f"=== Iniciando Áureo en {args.host}:{args.port} ===")
    run_script = os.path.join(base_dir, 'run.py')
    
    try:
        # Configurar variables de entorno
        env = os.environ.copy()
        if args.debug:
            env['FLASK_DEBUG'] = 'true'
        
        subprocess.run([
            sys.executable, 
            run_script,
            '--host', args.host,
            '--port', str(args.port)
        ], env=env)
        
    except KeyboardInterrupt:
        print("\nAplicación detenida por el usuario.")
        return 0
    except Exception as e:
        print(f"Error al iniciar la aplicación: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())