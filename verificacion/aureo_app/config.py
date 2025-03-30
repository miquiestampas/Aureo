import os
from dotenv import load_dotenv

# Cargar variables de entorno desde un archivo .env si existe
load_dotenv()

class Config:
    # Directorio base de la aplicación
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # Configuración de la base de datos
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'datos.sqlite')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Configuración de seguridad
    SECRET_KEY = os.environ.get('SECRET_KEY', 'aureo_app_secret_key_change_in_production')
    
    # Configuración de sesión
    SESSION_TYPE = 'filesystem'
    SESSION_FILE_DIR = os.path.join(BASE_DIR, 'flask_session')
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    
    # Configuración de archivos
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    EXCEL_WATCH_DIR = os.path.join(BASE_DIR, 'data', 'excel_watch')
    PDF_WATCH_DIR = os.path.join(BASE_DIR, 'data', 'pdf_watch')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # Máximo 16MB
    
    # Configuración de aplicación
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    TESTING = False
    
    # Configuración de aplicación
    APP_NAME = "Áureo"
    APP_VERSION = "1.0.0"
    
    # Crear directorios necesarios
    @staticmethod
    def init_app(app):
        # Crear directorios para archivos
        os.makedirs(os.path.join(Config.BASE_DIR, 'uploads', 'excel'), exist_ok=True)
        os.makedirs(os.path.join(Config.BASE_DIR, 'uploads', 'pdf'), exist_ok=True)
        os.makedirs(os.path.join(Config.BASE_DIR, 'data', 'excel_watch'), exist_ok=True)
        os.makedirs(os.path.join(Config.BASE_DIR, 'data', 'pdf_watch'), exist_ok=True)
        
        # Crear directorio para sesiones
        os.makedirs(os.path.join(Config.BASE_DIR, 'flask_session'), exist_ok=True)

class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'generate-a-secure-key-for-production'
    
    # En producción, usar un tipo de sesión más seguro y eficiente si está disponible
    SESSION_TYPE = 'filesystem'  # Considerar 'redis' o 'memcached' para mayor rendimiento
    
    # Configuración de seguridad adicional para producción
    SESSION_COOKIE_SECURE = True  # Solo enviar cookie de sesión por HTTPS
    SESSION_COOKIE_HTTPONLY = True  # Prevenir acceso a cookie por JavaScript
    
    # Configuración de seguridad adicional
    PREFERRED_URL_SCHEME = 'https'

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

# Diccionario de configuraciones
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

# Configuración por defecto
DefaultConfig = config['default']