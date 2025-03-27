from app import create_app, db
from app.models import init_db
from app.file_watcher import init_watchers
import os
import argparse
from werkzeug.security import generate_password_hash

app = create_app()

# Ejecutar antes del primer request
@app.before_first_request
def before_first_request():
    # Inicializar la base de datos si no existe
    if not os.path.exists(os.path.join(os.path.dirname(__file__), 'datos.sqlite')):
        with app.app_context():
            init_db()
    
    # Inicializar vigilantes de archivos
    init_watchers()

def parse_arguments():
    """Procesa los argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Inicia la aplicación Áureo')
    parser.add_argument('--host', default='0.0.0.0', help='Host para escuchar (por defecto: 0.0.0.0)')
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
    
    # Inicializar base de datos si no existe
    if not os.path.exists(os.path.join(os.path.dirname(__file__), 'datos.sqlite')):
        with app.app_context():
            init_db()
    
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