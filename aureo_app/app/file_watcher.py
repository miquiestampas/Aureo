import os
import shutil
import time
import threading
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import re
from . import db
from .models import FileActivity, SystemConfig, Store
from .file_processors import process_excel_file, process_pdf_file

# Variables globales
excel_observer = None
pdf_observer = None
watcher_thread = None
is_watching = False

class ExcelFileHandler(FileSystemEventHandler):
    """Manejador de eventos para archivos Excel"""
    def on_created(self, event):
        """Método llamado cuando se crea un archivo"""
        if event.is_directory:
            return
        
        filepath = event.src_path
        filename = os.path.basename(filepath)
        
        # Verificar extensiones de Excel
        if filename.lower().endswith(('.xlsx', '.xls', '.xlsm')):
            handle_new_excel_file(filepath)

class PdfFileHandler(FileSystemEventHandler):
    """Manejador de eventos para archivos PDF"""
    def on_created(self, event):
        """Método llamado cuando se crea un archivo"""
        if event.is_directory:
            return
        
        filepath = event.src_path
        filename = os.path.basename(filepath)
        
        # Verificar extensión PDF
        if filename.lower().endswith('.pdf'):
            handle_new_pdf_file(filepath)

def init_watchers():
    """Inicializa los vigilantes de archivos según la configuración del sistema"""
    try:
        # Verificar si la vigilancia está habilitada
        config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
        if config and config.value.lower() == 'true':
            # Iniciar en un hilo separado para no bloquear la inicialización de la app
            global watcher_thread
            watcher_thread = threading.Thread(target=start_file_watchers)
            watcher_thread.daemon = True
            watcher_thread.start()
            print("Vigilantes de archivos iniciados correctamente")
        else:
            print("Vigilancia de archivos deshabilitada por configuración")
        return True
    except Exception as e:
        print(f"Error al inicializar vigilantes de archivos: {str(e)}")
        return False

def start_file_watchers():
    """
    Inicia la vigilancia de archivos en los directorios configurados.
    
    Returns:
        bool: True si se inició correctamente, False en caso contrario
    """
    try:
        from config import Config
        
        # Obtener rutas de directorios a vigilar
        excel_watch_dir = Config.EXCEL_WATCH_DIR
        pdf_watch_dir = Config.PDF_WATCH_DIR
        
        # Asegurar que existen los directorios
        os.makedirs(excel_watch_dir, exist_ok=True)
        os.makedirs(pdf_watch_dir, exist_ok=True)
        
        # Inicializar manejadores y observadores
        global excel_observer, pdf_observer, is_watching
        
        excel_handler = ExcelFileHandler()
        excel_observer = Observer()
        excel_observer.schedule(excel_handler, excel_watch_dir, recursive=False)
        
        pdf_handler = PdfFileHandler()
        pdf_observer = Observer()
        pdf_observer.schedule(pdf_handler, pdf_watch_dir, recursive=False)
        
        # Iniciar observadores
        excel_observer.start()
        pdf_observer.start()
        is_watching = True
        
        print(f"Vigilancia de archivos iniciada: Excel en {excel_watch_dir}, PDF en {pdf_watch_dir}")
        
        # Mantener el hilo ejecutándose
        try:
            while is_watching:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_file_watchers()
        
        return True
    except Exception as e:
        print(f"Error al iniciar vigilancia de archivos: {str(e)}")
        return False

def stop_file_watchers():
    """
    Detiene la vigilancia de archivos.
    
    Returns:
        bool: True si se detuvo correctamente, False en caso contrario
    """
    try:
        global excel_observer, pdf_observer, is_watching
        
        if excel_observer:
            excel_observer.stop()
            excel_observer.join()
            excel_observer = None
        
        if pdf_observer:
            pdf_observer.stop()
            pdf_observer.join()
            pdf_observer = None
        
        is_watching = False
        print("Vigilancia de archivos detenida")
        return True
    except Exception as e:
        print(f"Error al detener vigilancia de archivos: {str(e)}")
        return False

def handle_new_excel_file(file_path):
    """
    Procesa un nuevo archivo Excel detectado.
    
    Args:
        file_path: Ruta al archivo Excel
    """
    try:
        # Información del archivo
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # Esperar a que el archivo termine de escribirse
        time.sleep(1)  # Pequeño retraso para asegurar que el archivo esté completo
        
        # Extraer código de tienda del nombre del archivo (típicamente un código alfanumérico al inicio)
        store_code = extract_store_code_from_filename(filename)
        
        # Verificar si el código de tienda existe
        store = None
        if store_code:
            store = Store.query.filter_by(code=store_code, type='Excel').first()
        
        # Si no se encontró una tienda y está habilitada la asignación automática
        auto_detection = SystemConfig.query.filter_by(key='AUTO_STORE_DETECTION').first()
        if not store and auto_detection and auto_detection.value.lower() == 'true':
            # Asignar a la primera tienda Excel activa
            store = Store.query.filter_by(type='Excel', active=True).first()
        
        # Crear destino para el archivo
        from config import Config
        upload_dir = os.path.join(Config.UPLOAD_FOLDER, 'excel')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generar timestamp para el nombre del archivo
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        new_filename = f"{timestamp}_{filename}"
        dest_path = os.path.join(upload_dir, new_filename)
        
        # Copiar archivo a directorio de uploads
        shutil.copy2(file_path, dest_path)
        
        # Crear registro de actividad
        activity = FileActivity(
            filename=filename,
            original_path=file_path,
            saved_path=dest_path,
            file_size=file_size,
            store_code=store.code if store else None,
            detected_store_code=store_code,
            file_type='Excel',
            status='PendingStoreAssignment' if not store else 'Pending',
            upload_date=datetime.utcnow()
        )
        
        db.session.add(activity)
        db.session.commit()
        
        # Si tenemos tienda, procesar inmediatamente
        if store:
            # Iniciar procesamiento en un hilo separado
            threading.Thread(target=process_excel_file, args=(activity.id,)).start()
        
        print(f"Archivo Excel detectado: {filename}, tienda: {store.code if store else 'Pendiente de asignación'}")
        
    except Exception as e:
        print(f"Error al procesar archivo Excel {file_path}: {str(e)}")

def handle_new_pdf_file(file_path):
    """
    Procesa un nuevo archivo PDF detectado.
    
    Args:
        file_path: Ruta al archivo PDF
    """
    try:
        # Información del archivo
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # Esperar a que el archivo termine de escribirse
        time.sleep(1)  # Pequeño retraso para asegurar que el archivo esté completo
        
        # Extraer código de tienda del nombre del archivo
        store_code = extract_store_code_from_filename(filename)
        
        # Verificar si el código de tienda existe
        store = None
        if store_code:
            store = Store.query.filter_by(code=store_code, type='PDF').first()
        
        # Si no se encontró una tienda y está habilitada la asignación automática
        auto_detection = SystemConfig.query.filter_by(key='AUTO_STORE_DETECTION').first()
        if not store and auto_detection and auto_detection.value.lower() == 'true':
            # Asignar a la primera tienda PDF activa
            store = Store.query.filter_by(type='PDF', active=True).first()
        
        # Crear destino para el archivo
        from config import Config
        upload_dir = os.path.join(Config.UPLOAD_FOLDER, 'pdf')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Mantener el nombre original del archivo pero añadir timestamp
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        new_filename = f"{timestamp}_{filename}"
        dest_path = os.path.join(upload_dir, new_filename)
        
        # Copiar archivo a directorio de uploads
        shutil.copy2(file_path, dest_path)
        
        # Crear registro de actividad
        activity = FileActivity(
            filename=filename,
            original_path=file_path,
            saved_path=dest_path,
            file_size=file_size,
            store_code=store.code if store else None,
            detected_store_code=store_code,
            file_type='PDF',
            status='PendingStoreAssignment' if not store else 'Pending',
            upload_date=datetime.utcnow()
        )
        
        db.session.add(activity)
        db.session.commit()
        
        # Si tenemos tienda, procesar inmediatamente
        if store:
            # Iniciar procesamiento en un hilo separado
            threading.Thread(target=process_pdf_file, args=(activity.id,)).start()
        
        print(f"Archivo PDF detectado: {filename}, tienda: {store.code if store else 'Pendiente de asignación'}")
        
    except Exception as e:
        print(f"Error al procesar archivo PDF {file_path}: {str(e)}")

def extract_store_code_from_filename(filename):
    """
    Extrae el código de tienda del nombre del archivo.
    El formato esperado es "CODIGO_TIENDA - Descripción.extensión"
    o "CODIGO_TIENDA_Descripción.extensión"
    
    Args:
        filename: Nombre del archivo
    
    Returns:
        str: Código de tienda extraído o None si no se encuentra
    """
    # Eliminar extensión
    base_name = os.path.splitext(filename)[0]
    
    # Intentar extraer un código de tienda con patrones comunes
    patterns = [
        r'^([A-Z0-9]+)[_\s-]',  # Patrón: CODIGO_ o CODIGO- o CODIGO<espacio>
        r'^([A-Z0-9]{3,6})',    # Simplemente las primeras 3-6 letras/números
    ]
    
    for pattern in patterns:
        match = re.search(pattern, base_name)
        if match:
            return match.group(1)
    
    return None

def update_activity_status(activity_id, status, error_message=None):
    """
    Actualiza el estado de una actividad de archivo.
    
    Args:
        activity_id: ID de la actividad
        status: Nuevo estado ('Pending', 'Processing', 'Processed', 'Failed')
        error_message: Mensaje de error opcional
    
    Returns:
        bool: True si se actualizó correctamente, False en caso contrario
    """
    try:
        activity = FileActivity.query.get(activity_id)
        if not activity:
            return False
            
        activity.status = status
        if error_message:
            activity.error_message = error_message
        
        if status == 'Processing':
            activity.processing_date = datetime.utcnow()
        
        db.session.commit()
        return True
    except Exception as e:
        print(f"Error al actualizar estado de actividad {activity_id}: {str(e)}")
        return False