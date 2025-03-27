import os
from flask import Flask, render_template, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix

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
    login_manager.login_view = '/auth'
    
    with app.app_context():
        # Importar componentes
        from .models import User
        from .auth import auth_bp
        from .routes import main_bp
        
        # Configurar login manager
        @login_manager.user_loader
        def load_user(user_id):
            return User.query.get(int(user_id))
        
        # Registrar blueprints
        app.register_blueprint(auth_bp)
        app.register_blueprint(main_bp)
        
        # Ruta para servir archivos estáticos de React
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve(path):
            if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
                return send_from_directory(app.static_folder, path)
            return render_template('index.html')
        
        # Manejador de errores 404
        @app.errorhandler(404)
        def page_not_found(e):
            return render_template('404.html'), 404
        
        # Manejador de errores 500
        @app.errorhandler(500)
        def server_error(e):
            return jsonify(error=str(e)), 500
        
        return app