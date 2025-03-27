from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash
from functools import wraps
from . import db
from .models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Registra un nuevo usuario (solo admin puede hacerlo)"""
    if not current_user.is_authenticated or current_user.role not in ['SuperAdmin', 'Admin']:
        return jsonify({'error': 'No autorizado para realizar esta acción'}), 403
    
    data = request.json
    
    # Verificar si el nombre de usuario ya existe
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El nombre de usuario ya existe'}), 400
    
    # Crear nuevo usuario
    new_user = User(
        username=data['username'],
        name=data['name'],
        role=data['role']
    )
    new_user.set_password(data['password'])
    
    # SuperAdmin solo puede ser creado por otro SuperAdmin
    if data['role'] == 'SuperAdmin' and current_user.role != 'SuperAdmin':
        return jsonify({'error': 'Solo un SuperAdmin puede crear otro SuperAdmin'}), 403
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify(new_user.to_dict()), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Inicia sesión de usuario"""
    data = request.json
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Credenciales incorrectas'}), 401
    
    login_user(user)
    return jsonify(user.to_dict()), 200

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Cierra sesión de usuario"""
    logout_user()
    return jsonify({'message': 'Sesión cerrada correctamente'}), 200

@auth_bp.route('/user', methods=['GET'])
def get_user():
    """Obtiene información del usuario actual"""
    if current_user.is_authenticated:
        return jsonify(current_user.to_dict()), 200
    return jsonify({}), 401

def authorize(roles):
    """Decorador para autorizar acceso basado en roles"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({'error': 'Acceso no autorizado. Inicie sesión.'}), 401
            
            if current_user.role not in roles:
                return jsonify({'error': 'Permisos insuficientes para esta operación'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator