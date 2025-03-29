from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
import os
import json
import time
import re
from datetime import datetime, timedelta
import threading
from . import db
from .models import User, Store, SystemConfig, FileActivity, ExcelData, PdfDocument
from .models import WatchlistPerson, WatchlistItem, Alert, SearchHistory
from .auth import authorize
from .file_processors import process_excel_file, process_pdf_file
from .file_watcher import init_watchers, start_file_watchers, stop_file_watchers, update_activity_status

main_bp = Blueprint('main', __name__, url_prefix='/api')

# Rutas para manejo de tiendas
@main_bp.route('/stores', methods=['GET'])
@login_required
def get_stores():
    """Obtiene todas las tiendas"""
    stores = Store.query.all()
    return jsonify([store.to_dict() for store in stores]), 200

@main_bp.route('/stores/excel', methods=['GET'])
@login_required
def get_excel_stores():
    """Obtiene todas las tiendas de tipo Excel"""
    stores = Store.query.filter_by(type='Excel').all()
    return jsonify([store.to_dict() for store in stores]), 200

@main_bp.route('/stores/pdf', methods=['GET'])
@login_required
def get_pdf_stores():
    """Obtiene todas las tiendas de tipo PDF"""
    stores = Store.query.filter_by(type='PDF').all()
    return jsonify([store.to_dict() for store in stores]), 200

@main_bp.route('/stores', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def create_store():
    """Crea una nueva tienda"""
    data = request.json
    
    # Verificar si el código ya existe
    if Store.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'El código de tienda ya existe'}), 400
    
    # Crear tienda
    store = Store(
        code=data['code'],
        name=data['name'],
        type=data['type'],
        district=data.get('district'),
        locality=data.get('locality'),
        active=data.get('active', True),
        address=data.get('address'),
        phone=data.get('phone'),
        email=data.get('email'),
        cif=data.get('cif'),
        business_name=data.get('businessName'),
        owner_name=data.get('ownerName'),
        owner_id_number=data.get('ownerIdNumber'),
        start_date=datetime.fromisoformat(data['startDate']) if data.get('startDate') else None,
        end_date=datetime.fromisoformat(data['endDate']) if data.get('endDate') else None,
        notes=data.get('notes')
    )
    
    db.session.add(store)
    db.session.commit()
    
    return jsonify(store.to_dict()), 201

@main_bp.route('/stores/<int:id>', methods=['PUT'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def update_store(id):
    """Actualiza una tienda existente"""
    store = Store.query.get(id)
    if not store:
        return jsonify({'error': 'Tienda no encontrada'}), 404
    
    data = request.json
    
    # Verificar si el código ya existe en otra tienda
    if data.get('code') and data['code'] != store.code:
        if Store.query.filter_by(code=data['code']).first():
            return jsonify({'error': 'El código de tienda ya existe'}), 400
        store.code = data['code']
    
    # Actualizar campos
    if 'name' in data:
        store.name = data['name']
    if 'type' in data:
        store.type = data['type']
    if 'district' in data:
        store.district = data['district']
    if 'locality' in data:
        store.locality = data['locality']
    if 'active' in data:
        store.active = data['active']
    if 'address' in data:
        store.address = data['address']
    if 'phone' in data:
        store.phone = data['phone']
    if 'email' in data:
        store.email = data['email']
    if 'cif' in data:
        store.cif = data['cif']
    if 'businessName' in data:
        store.business_name = data['businessName']
    if 'ownerName' in data:
        store.owner_name = data['ownerName']
    if 'ownerIdNumber' in data:
        store.owner_id_number = data['ownerIdNumber']
    if 'startDate' in data:
        store.start_date = datetime.fromisoformat(data['startDate']) if data['startDate'] else None
    if 'endDate' in data:
        store.end_date = datetime.fromisoformat(data['endDate']) if data['endDate'] else None
    if 'notes' in data:
        store.notes = data['notes']
    
    db.session.commit()
    
    return jsonify(store.to_dict()), 200

@main_bp.route('/stores/<int:id>', methods=['DELETE'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def delete_store(id):
    """Elimina una tienda"""
    store = Store.query.get(id)
    if not store:
        return jsonify({'error': 'Tienda no encontrada'}), 404
    
    db.session.delete(store)
    db.session.commit()
    
    return jsonify({'message': 'Tienda eliminada correctamente'}), 200

# Rutas para actividades de archivos
@main_bp.route('/file-activities', methods=['GET'])
@login_required
def get_file_activities():
    """Obtiene las actividades de archivos recientes"""
    limit = request.args.get('limit', 20, type=int)
    
    activities = FileActivity.query.order_by(FileActivity.upload_date.desc()).limit(limit).all()
    return jsonify([activity.to_dict() for activity in activities]), 200

@main_bp.route('/file-activities/store/<store_code>', methods=['GET'])
@login_required
def get_store_file_activities(store_code):
    """Obtiene actividades de archivos para una tienda específica"""
    activities = FileActivity.query.filter_by(store_code=store_code).order_by(FileActivity.upload_date.desc()).all()
    return jsonify([activity.to_dict() for activity in activities]), 200

@main_bp.route('/file-activities/pending-store-assignment', methods=['GET'])
@login_required
def get_pending_store_assignments():
    """Obtiene actividades de archivos pendientes de asignación de tienda"""
    activities = FileActivity.query.filter_by(status='PendingStoreAssignment').order_by(FileActivity.upload_date.desc()).all()
    return jsonify([activity.to_dict() for activity in activities]), 200

@main_bp.route('/file-activities/<int:id>/assign-store', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin', 'User'])
def assign_store_to_activity(id):
    """Asigna una tienda a una actividad de archivo"""
    activity = FileActivity.query.get(id)
    if not activity:
        return jsonify({'error': 'Actividad no encontrada'}), 404
    
    data = request.json
    store_code = data.get('storeCode')
    
    if not store_code:
        return jsonify({'error': 'Código de tienda no proporcionado'}), 400
    
    # Verificar que la tienda existe
    store = Store.query.filter_by(code=store_code).first()
    if not store:
        return jsonify({'error': 'Tienda no encontrada'}), 404
    
    # Verificar que el tipo de tienda coincide con el tipo de archivo
    if store.type != activity.file_type:
        return jsonify({'error': f'Tipo de tienda ({store.type}) no coincide con tipo de archivo ({activity.file_type})'}), 400
    
    # Actualizar actividad
    activity.store_code = store_code
    activity.status = 'Pending'
    activity.processed_by = current_user.id
    
    db.session.commit()
    
    # Iniciar procesamiento en un hilo separado
    if activity.file_type == 'Excel':
        threading.Thread(target=process_excel_file, args=(activity.id,)).start()
    else:  # PDF
        threading.Thread(target=process_pdf_file, args=(activity.id,)).start()
    
    return jsonify(activity.to_dict()), 200

# Rutas para datos Excel
@main_bp.route('/excel-data/store/<store_code>', methods=['GET'])
@login_required
def get_excel_data_by_store(store_code):
    """Obtiene datos Excel para una tienda específica"""
    excel_data = ExcelData.query.filter_by(store_code=store_code).order_by(ExcelData.order_date.desc()).all()
    return jsonify([data.to_dict() for data in excel_data]), 200

@main_bp.route('/excel-data/<int:id>', methods=['GET'])
@login_required
def get_excel_data(id):
    """Obtiene un registro Excel específico"""
    data = ExcelData.query.get(id)
    if not data:
        return jsonify({'error': 'Registro no encontrado'}), 404
    
    return jsonify(data.to_dict()), 200

# Rutas para documentos PDF
@main_bp.route('/pdf-documents/store/<store_code>', methods=['GET'])
@login_required
def get_pdf_documents_by_store(store_code):
    """Obtiene documentos PDF para una tienda específica"""
    documents = PdfDocument.query.filter_by(store_code=store_code).order_by(PdfDocument.upload_date.desc()).all()
    return jsonify([doc.to_dict() for doc in documents]), 200

@main_bp.route('/pdf-documents/<int:id>', methods=['GET'])
@login_required
def get_pdf_document(id):
    """Obtiene información de un documento PDF específico"""
    document = PdfDocument.query.get(id)
    if not document:
        return jsonify({'error': 'Documento no encontrado'}), 404
    
    return jsonify(document.to_dict()), 200

@main_bp.route('/pdf-documents/<int:id>/view', methods=['GET'])
@login_required
def view_pdf_document(id):
    """Obtiene el archivo PDF para visualizarlo"""
    document = PdfDocument.query.get(id)
    if not document:
        return jsonify({'error': 'Documento no encontrado'}), 404
    
    # Verificar que existe el archivo
    if not os.path.exists(document.path):
        return jsonify({'error': 'Archivo no encontrado en el sistema'}), 404
    
    return send_file(document.path, mimetype='application/pdf')

# Ruta para búsqueda de datos Excel
@main_bp.route('/excel-data/search', methods=['POST'])
@login_required
def search_excel_data():
    """Busca datos Excel según criterios específicos"""
    data = request.json
    
    # Guardar historial de búsqueda
    if data.get('query'):
        search_entry = SearchHistory(
            user_id=current_user.id,
            query=data['query'],
            search_date=datetime.utcnow()
        )
        db.session.add(search_entry)
        db.session.commit()
    
    # Construir consulta
    query_text = data.get('query', '')
    store_code = data.get('storeCode')
    date_from = data.get('dateFrom')
    date_to = data.get('dateTo')
    order_number = data.get('orderNumber')
    customer_name = data.get('customerName')
    customer_contact = data.get('customerContact')
    item_details = data.get('itemDetails')
    metals = data.get('metals')
    price = data.get('price')
    price_operator = data.get('priceOperator', '=')
    only_alerts = data.get('onlyAlerts', False)
    
    try:
        # Usar SQLite directamente para controlar la construcción de la consulta
        # Esta parte es crítica para permitir búsquedas más flexibles
        
        sql_query = """
        SELECT e.* FROM excel_data e
        """
        
        # Si solo queremos registros con alertas, hacemos un JOIN
        if only_alerts:
            sql_query += """
            JOIN alerts a ON e.id = a.excel_data_id
            """
        
        # Construir WHERE
        conditions = []
        params = {}
        
        if store_code:
            conditions.append("e.store_code = :store_code")
            params['store_code'] = store_code
        
        if date_from:
            conditions.append("e.order_date >= :date_from")
            params['date_from'] = datetime.fromisoformat(date_from)
        
        if date_to:
            conditions.append("e.order_date <= :date_to")
            params['date_to'] = datetime.fromisoformat(date_to)
        
        if order_number:
            conditions.append("e.order_number LIKE :order_number")
            params['order_number'] = f"%{order_number}%"
        
        if customer_name:
            conditions.append("e.customer_name LIKE :customer_name")
            params['customer_name'] = f"%{customer_name}%"
        
        if customer_contact:
            conditions.append("e.customer_contact LIKE :customer_contact")
            params['customer_contact'] = f"%{customer_contact}%"
        
        if item_details:
            conditions.append("e.item_details LIKE :item_details")
            params['item_details'] = f"%{item_details}%"
        
        if metals:
            conditions.append("e.metals LIKE :metals")
            params['metals'] = f"%{metals}%"
        
        # Manejo especial para búsqueda de precio
        # Esto es complejo porque el campo price es un string pero queremos compararlo como número
        if price:
            # Función para determinar si un string es numérico
            def is_numeric_string(value):
                return re.match(r'^[0-9]+(\.[0-9]+)?$', value) is not None
            
            # Usar CASE WHEN para manejar valores numéricos y no numéricos en SQLite
            # SQLite no tiene REGEXP nativo, usamos LIKE para una aproximación
            price_condition = f"""
            CASE 
                WHEN (e.price GLOB '*[0-9]*' AND 
                     e.price NOT GLOB '*[a-zA-Z]*' AND 
                     (e.price GLOB '*.*' OR e.price NOT GLOB '*.*')) THEN 
                    CAST(e.price AS REAL) {price_operator} :price_value
                ELSE 0
            END
            """
            
            conditions.append(price_condition)
            params['price_value'] = float(price)
        
        # Búsqueda general de texto
        if query_text:
            # Escapar caracteres especiales en el patrón de búsqueda
            def escape_like_pattern(pattern):
                return pattern.replace('%', '\\%').replace('_', '\\_')
            
            escaped_query = escape_like_pattern(query_text)
            text_conditions = []
            
            # Campos de texto donde buscar
            text_fields = ['order_number', 'customer_name', 'customer_contact', 
                          'customer_address', 'customer_location', 'item_details', 
                          'metals', 'engravings', 'stones']
            
            for field in text_fields:
                text_conditions.append(f"e.{field} LIKE :query_text")
            
            conditions.append("(" + " OR ".join(text_conditions) + ")")
            params['query_text'] = f"%{escaped_query}%"
        
        # Unir todas las condiciones
        if conditions:
            sql_query += " WHERE " + " AND ".join(conditions)
        
        # Ordenar por fecha de forma descendente
        sql_query += " ORDER BY e.order_date DESC"
        
        # Ejecutar la consulta
        result = db.session.execute(sql_query, params)
        records = [dict(row) for row in result]
        
        return jsonify({
            'results': records,
            'count': len(records),
            'searchType': 'advanced'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rutas para carga de archivos
@main_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Carga un archivo (Excel o PDF) al sistema"""
    if 'file' not in request.files:
        return jsonify({'error': 'No se proporcionó archivo'}), 400
    
    file = request.files['file']
    store_code = request.form.get('storeCode')
    
    if not file.filename or file.filename == '':
        return jsonify({'error': 'Nombre de archivo no válido'}), 400
    
    if not store_code:
        return jsonify({'error': 'No se proporcionó código de tienda'}), 400
    
    # Verificar que la tienda existe
    store = Store.query.filter_by(code=store_code).first()
    if not store:
        return jsonify({'error': 'Tienda no encontrada'}), 404
    
    # Verificar tipo de archivo
    filename = secure_filename(file.filename)
    file_extension = os.path.splitext(filename)[1].lower()
    
    if file_extension in ['.xlsx', '.xls', '.xlsm']:
        file_type = 'Excel'
        upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'excel')
    elif file_extension == '.pdf':
        file_type = 'PDF'
        upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'pdf')
    else:
        return jsonify({'error': 'Tipo de archivo no soportado'}), 400
    
    # Verificar que el tipo de tienda coincide
    if store.type != file_type:
        return jsonify({'error': f'La tienda es de tipo {store.type}, pero el archivo es {file_type}'}), 400
    
    # Crear directorio si no existe
    os.makedirs(upload_dir, exist_ok=True)
    
    # Guardar el archivo con timestamp
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    new_filename = f"{timestamp}_{filename}"
    file_path = os.path.join(upload_dir, new_filename)
    file.save(file_path)
    
    # Crear registro de actividad
    activity = FileActivity(
        filename=filename,
        saved_path=file_path,
        file_size=os.path.getsize(file_path),
        store_code=store_code,
        file_type=file_type,
        status='Pending',
        upload_date=datetime.utcnow(),
        processed_by=current_user.id
    )
    
    db.session.add(activity)
    db.session.commit()
    
    # Iniciar procesamiento en un hilo separado
    if file_type == 'Excel':
        threading.Thread(target=process_excel_file, args=(activity.id,)).start()
    else:  # PDF
        threading.Thread(target=process_pdf_file, args=(activity.id,)).start()
    
    return jsonify({'message': 'Archivo cargado correctamente', 'activity': activity.to_dict()}), 201

# Rutas para configuración del sistema
@main_bp.route('/system-config', methods=['GET'])
@login_required
def get_system_configs():
    """Obtiene todas las configuraciones del sistema"""
    configs = SystemConfig.query.all()
    return jsonify([config.to_dict() for config in configs]), 200

@main_bp.route('/system-config/<key>', methods=['GET'])
@login_required
def get_system_config(key):
    """Obtiene una configuración específica del sistema"""
    config = SystemConfig.query.filter_by(key=key).first()
    if not config:
        return jsonify({'error': 'Configuración no encontrada'}), 404
    
    return jsonify(config.to_dict()), 200

@main_bp.route('/system-config/<key>', methods=['PUT'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def update_system_config(key):
    """Actualiza una configuración del sistema"""
    config = SystemConfig.query.filter_by(key=key).first()
    if not config:
        return jsonify({'error': 'Configuración no encontrada'}), 404
    
    data = request.json
    config.value = data.get('value', config.value)
    
    if 'description' in data:
        config.description = data['description']
    
    db.session.commit()
    
    # Si es la configuración de vigilancia de archivos, actualizar el estado
    if key == 'FILE_WATCHING_ACTIVE':
        if config.value.lower() == 'true':
            init_watchers()
        else:
            stop_file_watchers()
    
    return jsonify(config.to_dict()), 200

# Rutas para gestión de usuarios
@main_bp.route('/users', methods=['GET'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def get_users():
    """Obtiene todos los usuarios"""
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200

@main_bp.route('/users/<int:id>', methods=['GET'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def get_user(id):
    """Obtiene información de un usuario específico"""
    user = User.query.get(id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    return jsonify(user.to_dict()), 200

@main_bp.route('/users/<int:id>', methods=['PUT'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def update_user(id):
    """Actualiza un usuario"""
    user = User.query.get(id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Verificar permisos (solo SuperAdmin puede editar SuperAdmin)
    if user.role == 'SuperAdmin' and current_user.role != 'SuperAdmin':
        return jsonify({'error': 'No tiene permisos para editar un SuperAdmin'}), 403
    
    data = request.json
    
    # Actualizar nombre y rol
    if 'name' in data:
        user.name = data['name']
    
    if 'role' in data:
        # Solo SuperAdmin puede asignar rol SuperAdmin
        if data['role'] == 'SuperAdmin' and current_user.role != 'SuperAdmin':
            return jsonify({'error': 'Solo un SuperAdmin puede asignar rol SuperAdmin'}), 403
        user.role = data['role']
    
    # Actualizar contraseña si se proporciona
    if 'password' in data and data['password']:
        # Para cambiar contraseña de admin o superadmin, hay que verificar la contraseña actual
        if user.role in ['Admin', 'SuperAdmin'] and id != current_user.id:
            if not data.get('adminPassword'):
                return jsonify({'error': 'Se requiere la contraseña de administrador para este cambio'}), 400
            
            if not verifyAdminPassword(current_user.id, data['adminPassword']):
                return jsonify({'error': 'Contraseña de administrador incorrecta'}), 401
        
        user.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify(user.to_dict()), 200

@main_bp.route('/users/<int:id>', methods=['DELETE'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def delete_user(id):
    """Elimina un usuario"""
    user = User.query.get(id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # No permitir eliminar al propio usuario
    if id == current_user.id:
        return jsonify({'error': 'No puede eliminar su propio usuario'}), 400
    
    # Verificar permisos (solo SuperAdmin puede eliminar SuperAdmin o Admin)
    if user.role in ['SuperAdmin', 'Admin'] and current_user.role != 'SuperAdmin':
        return jsonify({'error': 'No tiene permisos para eliminar este usuario'}), 403
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'Usuario eliminado correctamente'}), 200

# Rutas para la lista de vigilancia
@main_bp.route('/watchlist/persons', methods=['GET'])
@login_required
def get_watchlist_persons():
    """Obtiene personas en la lista de vigilancia"""
    include_inactive = request.args.get('includeInactive', 'false').lower() == 'true'
    
    if include_inactive:
        persons = WatchlistPerson.query.all()
    else:
        persons = WatchlistPerson.query.filter_by(active=True).all()
    
    return jsonify([person.to_dict() for person in persons]), 200

@main_bp.route('/watchlist/persons', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def create_watchlist_person():
    """Añade una persona a la lista de vigilancia"""
    data = request.json
    
    person = WatchlistPerson(
        name=data['name'],
        id_number=data.get('idNumber'),
        description=data.get('description'),
        created_by=current_user.id,
        active=data.get('active', True)
    )
    
    db.session.add(person)
    db.session.commit()
    
    return jsonify(person.to_dict()), 201

@main_bp.route('/watchlist/persons/<int:id>', methods=['PUT'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def update_watchlist_person(id):
    """Actualiza una persona en la lista de vigilancia"""
    person = WatchlistPerson.query.get(id)
    if not person:
        return jsonify({'error': 'Persona no encontrada'}), 404
    
    data = request.json
    
    if 'name' in data:
        person.name = data['name']
    if 'idNumber' in data:
        person.id_number = data['idNumber']
    if 'description' in data:
        person.description = data['description']
    if 'active' in data:
        person.active = data['active']
    
    db.session.commit()
    
    return jsonify(person.to_dict()), 200

@main_bp.route('/watchlist/persons/<int:id>', methods=['DELETE'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def delete_watchlist_person(id):
    """Elimina una persona de la lista de vigilancia"""
    person = WatchlistPerson.query.get(id)
    if not person:
        return jsonify({'error': 'Persona no encontrada'}), 404
    
    db.session.delete(person)
    db.session.commit()
    
    return jsonify({'message': 'Persona eliminada correctamente'}), 200

@main_bp.route('/watchlist/items', methods=['GET'])
@login_required
def get_watchlist_items():
    """Obtiene elementos en la lista de vigilancia"""
    include_inactive = request.args.get('includeInactive', 'false').lower() == 'true'
    
    if include_inactive:
        items = WatchlistItem.query.all()
    else:
        items = WatchlistItem.query.filter_by(active=True).all()
    
    return jsonify([item.to_dict() for item in items]), 200

@main_bp.route('/watchlist/items', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def create_watchlist_item():
    """Añade un elemento a la lista de vigilancia"""
    data = request.json
    
    item = WatchlistItem(
        item_type=data['itemType'],
        description=data['description'],
        serial_number=data.get('serialNumber'),
        created_by=current_user.id,
        active=data.get('active', True)
    )
    
    db.session.add(item)
    db.session.commit()
    
    return jsonify(item.to_dict()), 201

@main_bp.route('/watchlist/items/<int:id>', methods=['PUT'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def update_watchlist_item(id):
    """Actualiza un elemento en la lista de vigilancia"""
    item = WatchlistItem.query.get(id)
    if not item:
        return jsonify({'error': 'Elemento no encontrado'}), 404
    
    data = request.json
    
    if 'itemType' in data:
        item.item_type = data['itemType']
    if 'description' in data:
        item.description = data['description']
    if 'serialNumber' in data:
        item.serial_number = data['serialNumber']
    if 'active' in data:
        item.active = data['active']
    
    db.session.commit()
    
    return jsonify(item.to_dict()), 200

@main_bp.route('/watchlist/items/<int:id>', methods=['DELETE'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def delete_watchlist_item(id):
    """Elimina un elemento de la lista de vigilancia"""
    item = WatchlistItem.query.get(id)
    if not item:
        return jsonify({'error': 'Elemento no encontrado'}), 404
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'message': 'Elemento eliminado correctamente'}), 200

# Rutas para alertas
@main_bp.route('/alerts', methods=['GET'])
@login_required
def get_alerts():
    """Obtiene alertas según estado y límite"""
    status = request.args.get('status')
    limit = request.args.get('limit', 50, type=int)
    
    query = Alert.query
    
    if status:
        query = query.filter_by(status=status)
    
    alerts = query.order_by(Alert.alert_date.desc()).limit(limit).all()
    return jsonify([alert.to_dict() for alert in alerts]), 200

@main_bp.route('/alerts/<int:id>', methods=['GET'])
@login_required
def get_alert(id):
    """Obtiene información de una alerta específica"""
    alert = Alert.query.get(id)
    if not alert:
        return jsonify({'error': 'Alerta no encontrada'}), 404
    
    return jsonify(alert.to_dict()), 200

@main_bp.route('/alerts/<int:id>/review', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def review_alert(id):
    """Marca una alerta como revisada"""
    alert = Alert.query.get(id)
    if not alert:
        return jsonify({'error': 'Alerta no encontrada'}), 404
    
    data = request.json
    
    alert.status = data.get('status', 'Reviewed')
    alert.reviewed_by = current_user.id
    alert.review_notes = data.get('notes')
    
    db.session.commit()
    
    return jsonify(alert.to_dict()), 200

@main_bp.route('/alerts/by-excel-data/<int:excel_data_id>', methods=['GET'])
@login_required
def get_alerts_by_excel_data(excel_data_id):
    """Obtiene alertas asociadas a un registro Excel específico"""
    alerts = Alert.query.filter_by(excel_data_id=excel_data_id).all()
    return jsonify([alert.to_dict() for alert in alerts]), 200

# Rutas para historial de búsqueda
@main_bp.route('/search-history', methods=['GET'])
@login_required
def get_search_history():
    """Obtiene el historial de búsqueda del usuario actual"""
    limit = request.args.get('limit', 10, type=int)
    
    history = SearchHistory.query.filter_by(user_id=current_user.id).order_by(SearchHistory.search_date.desc()).limit(limit).all()
    return jsonify([entry.to_dict() for entry in history]), 200

# Rutas para control de vigilancia de archivos
@main_bp.route('/file-watching/status', methods=['GET'])
@login_required
def get_file_watching_status():
    """Obtiene el estado actual de la vigilancia de archivos"""
    from .file_watcher import is_watching
    
    config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
    
    return jsonify({
        'active': is_watching,
        'configEnabled': config.value.lower() == 'true' if config else False
    }), 200

@main_bp.route('/file-watching/toggle', methods=['POST'])
@login_required
@authorize(['SuperAdmin', 'Admin'])
def toggle_file_watching():
    """Activa o desactiva la vigilancia de archivos"""
    from .file_watcher import is_watching
    
    config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
    if not config:
        return jsonify({'error': 'Configuración no encontrada'}), 404
    
    # Cambiar el estado
    if is_watching:
        stop_file_watchers()
        config.value = 'false'
    else:
        init_watchers()
        config.value = 'true'
    
    db.session.commit()
    
    return jsonify({
        'active': not is_watching,  # Devolver el nuevo estado esperado
        'configEnabled': config.value.lower() == 'true'
    }), 200

# Función de utilidad para verificar contraseña de administrador
async def verifyAdminPassword(userId, password):
    """Verifica la contraseña de un administrador"""
    user = User.query.get(userId)
    if not user:
        return False
    
    return user.check_password(password)