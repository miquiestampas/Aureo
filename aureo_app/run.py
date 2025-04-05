from app import create_app, db, logger
import os
import argparse
import traceback

app = create_app()

# En Flask 2.0+, before_first_request ha sido eliminado
# Inicializamos los componentes antes de iniciar el servidor

# Función para inicializar componentes
def initialize_components():
    """Inicializa los componentes necesarios para la aplicación"""
    try:
        # Importamos aquí para evitar problemas de importación circular
        from app.file_watcher import init_watchers
        from app.models import SystemConfig

        # Verificar si la vigilancia está habilitada
        with app.app_context():
            config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
            if config and config.value.lower() == 'true':
                logger.info("Iniciando vigilantes de archivos desde configuración")
                success = init_watchers()
                if success:
                    logger.info("Vigilantes de archivos iniciados correctamente")
                else:
                    logger.warning("No se pudo iniciar los vigilantes de archivos")
            else:
                logger.info("Vigilancia de archivos deshabilitada por configuración")
        return True
    except Exception as e:
        logger.error(f"Error al inicializar componentes: {str(e)}")
        logger.error(traceback.format_exc())
        return False

# Configuramos un evento para inicializar componentes después de que la app esté lista
# Esto evita problemas con la inicialización de la base de datos
@app.before_request
def initialize_on_first_request():
    """Inicializa componentes en la primera solicitud"""
    if not hasattr(app, '_component_init_done'):
        with app.app_context():
            try:
                initialize_components()
                app._component_init_done = True
                logger.info("Componentes inicializados correctamente")
            except Exception as e:
                logger.error(f"Error al inicializar componentes en primera solicitud: {str(e)}")
                logger.error(traceback.format_exc())

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