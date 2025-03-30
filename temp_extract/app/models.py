from . import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # "SuperAdmin", "Admin", "User"
    
    def set_password(self, password):
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'role': self.role
        }

class Store(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    type = db.Column(db.String(10), nullable=False)  # "Excel" o "PDF"
    district = db.Column(db.String(120), nullable=True)
    locality = db.Column(db.String(120), nullable=True)
    active = db.Column(db.Boolean, default=True)
    address = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    cif = db.Column(db.String(20), nullable=True)
    business_name = db.Column(db.String(120), nullable=True)
    owner_name = db.Column(db.String(120), nullable=True)
    owner_id_number = db.Column(db.String(20), nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'type': self.type,
            'district': self.district,
            'locality': self.locality,
            'active': self.active,
            'address': self.address,
            'phone': self.phone,
            'email': self.email,
            'cif': self.cif,
            'businessName': self.business_name,
            'ownerName': self.owner_name,
            'ownerIdNumber': self.owner_id_number,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'endDate': self.end_date.isoformat() if self.end_date else None,
            'notes': self.notes
        }

class SystemConfig(db.Model):
    __tablename__ = 'system_configs'  # Forzar el nombre de la tabla
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.String(1000), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description
        }

class FileActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_path = db.Column(db.String(512), nullable=True)
    saved_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    store_code = db.Column(db.String(20), nullable=True)
    detected_store_code = db.Column(db.String(20), nullable=True)
    file_type = db.Column(db.String(10), nullable=False)  # "Excel" o "PDF"
    status = db.Column(db.String(20), nullable=False, default='Pending')  # "Pending", "Processing", "Processed", "Failed", "PendingStoreAssignment"
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    processing_date = db.Column(db.DateTime, nullable=True)
    processed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # Relaciones
    processor = db.relationship('User', backref='processed_files', foreign_keys=[processed_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'storeCode': self.store_code,
            'detectedStoreCode': self.detected_store_code,
            'fileType': self.file_type,
            'status': self.status,
            'uploadDate': self.upload_date.isoformat(),
            'processingDate': self.processing_date.isoformat() if self.processing_date else None,
            'processedBy': self.processed_by,
            'errorMessage': self.error_message,
            'fileSize': self.file_size
        }

class ExcelData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    store_code = db.Column(db.String(20), nullable=False)
    order_number = db.Column(db.String(50), nullable=False)
    order_date = db.Column(db.DateTime, nullable=False)
    customer_name = db.Column(db.String(120), nullable=False)
    customer_contact = db.Column(db.String(120), nullable=True)
    customer_address = db.Column(db.String(255), nullable=True)
    customer_location = db.Column(db.String(120), nullable=True)
    item_details = db.Column(db.Text, nullable=True)
    metals = db.Column(db.String(120), nullable=True)
    engravings = db.Column(db.String(120), nullable=True)
    stones = db.Column(db.String(120), nullable=True)
    carats = db.Column(db.String(20), nullable=True)
    price = db.Column(db.String(20), nullable=True)
    pawn_ticket = db.Column(db.String(50), nullable=True)
    sale_date = db.Column(db.DateTime, nullable=True)
    file_activity_id = db.Column(db.Integer, db.ForeignKey('file_activity.id'), nullable=False)
    
    # Relaciones
    file_activity = db.relationship('FileActivity', backref='excel_data')
    
    def to_dict(self):
        return {
            'id': self.id,
            'storeCode': self.store_code,
            'orderNumber': self.order_number,
            'orderDate': self.order_date.isoformat() if self.order_date else None,
            'customerName': self.customer_name,
            'customerContact': self.customer_contact,
            'customerAddress': self.customer_address,
            'customerLocation': self.customer_location,
            'itemDetails': self.item_details,
            'metals': self.metals,
            'engravings': self.engravings,
            'stones': self.stones,
            'carats': self.carats,
            'price': self.price,
            'pawnTicket': self.pawn_ticket,
            'saleDate': self.sale_date.isoformat() if self.sale_date else None,
            'fileActivityId': self.file_activity_id
        }

class PdfDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    store_code = db.Column(db.String(20), nullable=False)
    document_type = db.Column(db.String(50), nullable=True)
    title = db.Column(db.String(255), nullable=True)
    path = db.Column(db.String(512), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    file_size = db.Column(db.Integer, nullable=True)
    file_activity_id = db.Column(db.Integer, db.ForeignKey('file_activity.id'), nullable=False)
    
    # Relaciones
    file_activity = db.relationship('FileActivity', backref='pdf_documents')
    
    def to_dict(self):
        return {
            'id': self.id,
            'storeCode': self.store_code,
            'documentType': self.document_type,
            'title': self.title,
            'path': self.path,
            'uploadDate': self.upload_date.isoformat(),
            'fileSize': self.file_size,
            'fileActivityId': self.file_activity_id
        }

class WatchlistPerson(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    id_number = db.Column(db.String(50), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    active = db.Column(db.Boolean, default=True)
    
    # Relaciones
    creator = db.relationship('User', backref='created_watchlist_persons')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'idNumber': self.id_number,
            'description': self.description,
            'createdDate': self.created_date.isoformat(),
            'createdBy': self.created_by,
            'active': self.active
        }

class WatchlistItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_type = db.Column(db.String(50), nullable=False)  # "Joya", "Metal", "Grabado", etc.
    description = db.Column(db.Text, nullable=False)
    serial_number = db.Column(db.String(50), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    active = db.Column(db.Boolean, default=True)
    
    # Relaciones
    creator = db.relationship('User', backref='created_watchlist_items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'itemType': self.item_type,
            'description': self.description,
            'serialNumber': self.serial_number,
            'createdDate': self.created_date.isoformat(),
            'createdBy': self.created_by,
            'active': self.active
        }

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    excel_data_id = db.Column(db.Integer, db.ForeignKey('excel_data.id'), nullable=False)
    watchlist_item_id = db.Column(db.Integer, db.ForeignKey('watchlist_item.id'), nullable=True)
    watchlist_person_id = db.Column(db.Integer, db.ForeignKey('watchlist_person.id'), nullable=True)
    type = db.Column(db.String(20), nullable=False)  # "Person" o "Item"
    match_type = db.Column(db.String(50), nullable=False)  # "Name", "IDNumber", "Serial", etc.
    match_value = db.Column(db.String(255), nullable=False)
    alert_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default='Pending')  # "Pending", "Reviewed", "Dismissed"
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    
    # Relaciones
    excel_data = db.relationship('ExcelData', backref='alerts')
    watchlist_item = db.relationship('WatchlistItem', backref='alerts')
    watchlist_person = db.relationship('WatchlistPerson', backref='alerts')
    reviewer = db.relationship('User', backref='reviewed_alerts')
    
    def to_dict(self):
        return {
            'id': self.id,
            'excelDataId': self.excel_data_id,
            'watchlistItemId': self.watchlist_item_id,
            'watchlistPersonId': self.watchlist_person_id,
            'type': self.type,
            'matchType': self.match_type,
            'matchValue': self.match_value,
            'alertDate': self.alert_date.isoformat(),
            'status': self.status,
            'reviewedBy': self.reviewed_by,
            'reviewNotes': self.review_notes
        }

class SearchHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    query = db.Column(db.String(255), nullable=False)
    search_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relaciones
    user = db.relationship('User', backref='search_history')
    
    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'query': self.query,
            'searchDate': self.search_date.isoformat()
        }

# Función para inicializar la base de datos con datos iniciales
def init_db():
    # Habilitar el soporte para claves foráneas en SQLite
    from sqlalchemy import event
    from sqlalchemy.engine import Engine
    from sqlite3 import Connection as SQLite3Connection
    
    @event.listens_for(Engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, SQLite3Connection):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    
    # Crear todas las tablas
    db.create_all()
    
    # Crear usuario SuperAdmin por defecto
    if User.query.filter_by(username='117020').first() is None:
        user = User(
            username='117020',
            name='Administrador',
            role='SuperAdmin'
        )
        user.set_password('admin')
        db.session.add(user)
    
    # Crear configuraciones del sistema
    configs = [
        {
            'key': 'FILE_PROCESSING_ENABLED',
            'value': 'true',
            'description': 'Indica si la vigilancia automática de archivos está activa'
        },
        {
            'key': 'AUTO_STORE_DETECTION',
            'value': 'false',
            'description': 'Asigna automáticamente una tienda cuando no se detecta en el nombre del archivo'
        },
        {
            'key': 'EXCEL_WATCH_DIR',
            'value': os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'data', 'excel_watch'),
            'description': 'Directorio para vigilancia automática de archivos Excel'
        },
        {
            'key': 'PDF_WATCH_DIR',
            'value': os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'data', 'pdf_watch'),
            'description': 'Directorio para vigilancia automática de archivos PDF'
        },
        {
            'key': 'APP_NAME',
            'value': 'Áureo',
            'description': 'Nombre de la aplicación'
        },
        {
            'key': 'EXCEL_COLUMN_MAPPING',
            'value': 'A=Código,B=Número,C=Fecha,D=Cliente,E=DNI,F=Dirección,G=Localidad,H=Artículo,I=Peso,J=Metal,K=Grabado,L=Piedras,M=Precio,N=Papeletas,O=Venta',
            'description': 'Mapeo de columnas Excel (no modificar)'
        }
    ]
    
    for config in configs:
        if SystemConfig.query.filter_by(key=config['key']).first() is None:
            db.session.add(SystemConfig(**config))
    
    db.session.commit()