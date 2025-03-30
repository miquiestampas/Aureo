import os
import subprocess
import shutil
import sys

def build_frontend():
    """
    Compila el frontend de React y lo copia al directorio static de Flask.
    
    - Ejecuta `npm run build` en el directorio del cliente React
    - Copia los archivos generados al directorio static de Flask
    """
    base_dir = os.path.abspath(os.path.dirname(__file__))
    client_dir = os.path.abspath(os.path.join(base_dir, '..', 'client'))
    static_dir = os.path.join(base_dir, 'app', 'static')
    templates_dir = os.path.join(base_dir, 'app', 'templates')
    
    # Verificar que existe el directorio del cliente
    if not os.path.exists(client_dir):
        print(f"Error: No se encontró el directorio del cliente en: {client_dir}")
        return False
    
    try:
        print("Compilando el frontend de React...")
        
        # Ejecutar npm run build
        process = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=client_dir,
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
        
        print("Frontend compilado con éxito.")
        
        # Crear directorio static si no existe
        os.makedirs(static_dir, exist_ok=True)
        
        # Limpiar directorio static
        for item in os.listdir(static_dir):
            item_path = os.path.join(static_dir, item)
            if os.path.isfile(item_path):
                os.unlink(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        
        # Copiar archivos compilados al directorio static
        build_dir = os.path.join(client_dir, 'dist')
        
        if not os.path.exists(build_dir):
            print(f"Error: No se encontró el directorio de compilación en: {build_dir}")
            return False
        
        # Mover index.html a templates
        index_html = os.path.join(build_dir, 'index.html')
        if os.path.exists(index_html):
            shutil.copy(index_html, os.path.join(templates_dir, 'index.html'))
            print(f"Archivo index.html copiado a templates.")
        
        # Copiar el resto de archivos a static
        for item in os.listdir(build_dir):
            if item == 'index.html':
                continue
                
            src = os.path.join(build_dir, item)
            dst = os.path.join(static_dir, item)
            
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            else:
                shutil.copytree(src, dst)
        
        print(f"Archivos copiados al directorio static.")
        return True
        
    except Exception as e:
        print(f"Error al compilar y copiar el frontend: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== Compilación y configuración del frontend ===")
    if build_frontend():
        print("El frontend se ha compilado y configurado correctamente.")
    else:
        print("Error al compilar y configurar el frontend.")
        sys.exit(1)