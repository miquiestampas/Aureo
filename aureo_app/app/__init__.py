import os
from flask import Flask, render_template, send_from_directory, jsonify, redirect, url_for, request
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('aureo')

# Inicializar extensiones
db = SQLAlchemy()
login_manager = LoginManager()
sess = Session()

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')
    
    # Aplicar fixes para proxies si es necesario
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Inicializar extensiones
    db.init_app(app)
    login_manager.init_app(app)
    sess.init_app(app)
    CORS(app)
    
    # Configurar login manager
    login_manager.login_view = 'auth'
    
    with app.app_context():
        try:
            # Importar componentes
            from .models import User, init_db
            from .auth import auth_bp
            from .routes import main_bp
            
            # Verificar y crear la base de datos SQLite
            db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
            if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
                try:
                    init_db()
                    logger.info(f"Base de datos SQLite creada en: {db_path}")
                except Exception as e:
                    logger.error(f"Error al crear la base de datos: {e}")
            
            # Configurar login manager
            @login_manager.user_loader
            def load_user(user_id):
                try:
                    return User.query.get(int(user_id))
                except Exception as e:
                    logger.error(f"Error al cargar usuario: {e}")
                    return None
            
            # Registrar blueprints
            app.register_blueprint(auth_bp)
            app.register_blueprint(main_bp)
            
            # Ruta para autenticación
            @app.route('/auth')
            def auth():
                return render_template('auth.html')
            
            # Ruta para la página principal
            @app.route('/')
            def index():
                return render_template('index.html')
            
            # Rutas para servir archivos estáticos y otras rutas
            @app.route('/<path:path>')
            def serve(path):
                if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
                    return send_from_directory(app.static_folder, path)
                # Si no es un archivo estático, mostrar index (SPA)
                return render_template('index.html')
            
            # Manejador de errores 404
            @app.errorhandler(404)
            def page_not_found(e):
                logger.warning(f"Página no encontrada: {request.url}")
                return render_template('404.html'), 404
            
            # Manejador de errores 500
            @app.errorhandler(500)
            def server_error(e):
                logger.error(f"Error del servidor: {str(e)}")
                return jsonify(error=str(e)), 500
                
        except Exception as e:
            logger.critical(f"Error crítico al inicializar la aplicación: {e}")
            # Registrar una ruta de emergencia para mostrar el error
            @app.route('/')
            def error_startup():
                return render_template('error.html', error=str(e))
        
        return app