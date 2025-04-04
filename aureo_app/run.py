from app import create_app, db
from app.file_watcher import init_watchers
import os
import argparse

app = create_app()

# En Flask 2.0+, before_first_request ha sido eliminado
# Inicializamos los componentes antes de iniciar el servidor

# Función para inicializar componentes
def initialize_components():
    # Inicializar vigilantes de archivos
    # La base de datos ya se inicializa en create_app()
    init_watchers()

# Configuramos un evento before_first_request alternativo usando un punto de extensión
with app.app_context():
    # Inicializamos los componentes inmediatamente
    initialize_components()

def parse_arguments():
    """Procesa los argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Inicia la aplicación Áureo')
    parser.add_argument('--host', default='127.0.0.1', help='Host para escuchar (por defecto: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='Puerto para escuchar (por defecto: 5000)')
    parser.add_argument('--debug', action='store_true', help='Iniciar en modo depuración (por defecto: False)')
    
    return parser.parse_args()

if __name__ == '__main__':
    # Procesar argumentos
    args = parse_arguments()
    
    # Crear todos los directorios necesarios
    os.makedirs(os.path.join(os.path.dirname(__file__), 'uploads', 'excel'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'uploads', 'pdf'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'data', 'excel_watch'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), 'data', 'pdf_watch'), exist_ok=True)
    
    # La base de datos se inicializa automáticamente en create_app()
    
    # Determinar modo de depuración
    debug_mode = args.debug or os.environ.get('FLASK_DEBUG', '').lower() == 'true'
    
    # Información de inicio
    print(f"=== Iniciando Áureo ===")
    print(f"Host: {args.host}")
    print(f"Puerto: {args.port}")
    print(f"Modo depuración: {'Activado' if debug_mode else 'Desactivado'}")
    print(f"======================")
    
    # Ejecutar aplicación
    app.run(host=args.host, port=args.port, debug=debug_mode)