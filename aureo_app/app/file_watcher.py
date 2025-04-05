import os
import shutil
import time
import threading
from datetime import datetime
import re
import logging
from . import db
from .models import FileActivity, SystemConfig, Store
from .file_processors import process_excel_file, process_pdf_file

# Configurar logging
logger = logging.getLogger('aureo.file_watcher')

# Intentar importar watchdog, pero no fallar si no está disponible
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    watchdog_available = True
except ImportError:
    logger.warning("La librería watchdog no está instalada. La vigilancia de archivos no funcionará.")
    watchdog_available = False
    # Definir clases dummy
    class Observer:
        def __init__(self): pass
        def schedule(self, *args, **kwargs): pass
        def start(self): pass
        def stop(self): pass
        def join(self): pass
    
    class FileSystemEventHandler:
        def on_created(self, event): pass

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
        # Verificar si watchdog está disponible
        if not watchdog_available:
            logger.warning("No se puede iniciar la vigilancia de archivos: la librería watchdog no está instalada.")
            # Actualizar configuración a falso para evitar intentos futuros
            config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
            if config:
                config.value = 'false'
                db.session.commit()
                logger.info("Se ha desactivado la vigilancia automática de archivos en la configuración.")
            return False
        
        # Verificar si la vigilancia está habilitada
        config = SystemConfig.query.filter_by(key='FILE_WATCHING_ACTIVE').first()
        if config and config.value.lower() == 'true':
            # Iniciar en un hilo separado para no bloquear la inicialización de la app
            global watcher_thread
            watcher_thread = threading.Thread(target=start_file_watchers)
            watcher_thread.daemon = True
            watcher_thread.start()
            logger.info("Vigilantes de archivos iniciados correctamente")
        else:
            logger.info("Vigilancia de archivos deshabilitada por configuración")
        return True
    except Exception as e:
        logger.error(f"Error al inicializar vigilantes de archivos: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def start_file_watchers():
    """
    Inicia la vigilancia de archivos en los directorios configurados.
    
    Returns:
        bool: True si se inició correctamente, False en caso contrario
    """
    try:
        from config import Config
        
        # Verificar si watchdog está disponible
        if not watchdog_available:
            logger.error("No se puede iniciar vigilancia: la librería watchdog no está instalada.")
            return False
        
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
        
        logger.info(f"Vigilancia de archivos iniciada: Excel en {excel_watch_dir}, PDF en {pdf_watch_dir}")
        
        # Mantener el hilo ejecutándose
        try:
            while is_watching:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_file_watchers()
        
        return True
    except Exception as e:
        logger.error(f"Error al iniciar vigilancia de archivos: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def stop_file_watchers():
    """
    Detiene la vigilancia de archivos.
    
    Returns:
        bool: True si se detuvo correctamente, False en caso contrario
    """
    try:
        global excel_observer, pdf_observer, is_watching
        
        # Si no hay observadores, no hay nada que detener
        if not excel_observer and not pdf_observer:
            logger.info("No hay vigilantes de archivos activos para detener")
            is_watching = False
            return True
        
        # Detener los observadores si existen
        if excel_observer:
            try:
                excel_observer.stop()
                excel_observer.join()
                excel_observer = None
                logger.info("Observador de Excel detenido")
            except Exception as e:
                logger.error(f"Error al detener observador de Excel: {str(e)}")
        
        if pdf_observer:
            try:
                pdf_observer.stop()
                pdf_observer.join()
                pdf_observer = None
                logger.info("Observador de PDF detenido")
            except Exception as e:
                logger.error(f"Error al detener observador de PDF: {str(e)}")
        
        is_watching = False
        logger.info("Vigilancia de archivos detenida completamente")
        return True
    except Exception as e:
        logger.error(f"Error al detener vigilancia de archivos: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
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
        
        logger.info(f"Procesando nuevo archivo Excel: {filename} ({file_size} bytes)")
        
        # Esperar a que el archivo termine de escribirse
        time.sleep(1)  # Pequeño retraso para asegurar que el archivo esté completo
        
        # Extraer código de tienda del nombre del archivo (típicamente un código alfanumérico al inicio)
        store_code = extract_store_code_from_filename(filename)
        logger.info(f"Código de tienda detectado: {store_code if store_code else 'No detectado'}")
        
        # Verificar si el código de tienda existe
        store = None
        if store_code:
            store = Store.query.filter_by(code=store_code, type='Excel').first()
            if store:
                logger.info(f"Tienda encontrada: {store.code} - {store.name}")
            else:
                logger.warning(f"No se encontró tienda con código {store_code} para Excel")
        
        # Si no se encontró una tienda y está habilitada la asignación automática
        auto_detection = SystemConfig.query.filter_by(key='AUTO_STORE_DETECTION').first()
        if not store and auto_detection and auto_detection.value.lower() == 'true':
            # Asignar a la primera tienda Excel activa
            store = Store.query.filter_by(type='Excel', active=True).first()
            if store:
                logger.info(f"Asignación automática a tienda: {store.code} - {store.name}")
            else:
                logger.warning("No hay tiendas Excel activas para asignación automática")
        
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
        logger.info(f"Archivo copiado a: {dest_path}")
        
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
        logger.info(f"Registro de actividad creado con ID: {activity.id}")
        
        # Si tenemos tienda, procesar inmediatamente
        if store:
            # Iniciar procesamiento en un hilo separado
            logger.info(f"Iniciando procesamiento en segundo plano para archivo {filename}")
            threading.Thread(target=process_excel_file, args=(activity.id,)).start()
        else:
            logger.info(f"Archivo {filename} queda pendiente de asignación de tienda")
        
    except Exception as e:
        logger.error(f"Error al procesar archivo Excel {file_path}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

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
        
        logger.info(f"Procesando nuevo archivo PDF: {filename} ({file_size} bytes)")
        
        # Esperar a que el archivo termine de escribirse
        time.sleep(1)  # Pequeño retraso para asegurar que el archivo esté completo
        
        # Extraer código de tienda del nombre del archivo
        store_code = extract_store_code_from_filename(filename)
        logger.info(f"Código de tienda detectado: {store_code if store_code else 'No detectado'}")
        
        # Verificar si el código de tienda existe
        store = None
        if store_code:
            store = Store.query.filter_by(code=store_code, type='PDF').first()
            if store:
                logger.info(f"Tienda encontrada: {store.code} - {store.name}")
            else:
                logger.warning(f"No se encontró tienda con código {store_code} para PDF")
        
        # Si no se encontró una tienda y está habilitada la asignación automática
        auto_detection = SystemConfig.query.filter_by(key='AUTO_STORE_DETECTION').first()
        if not store and auto_detection and auto_detection.value.lower() == 'true':
            # Asignar a la primera tienda PDF activa
            store = Store.query.filter_by(type='PDF', active=True).first()
            if store:
                logger.info(f"Asignación automática a tienda: {store.code} - {store.name}")
            else:
                logger.warning("No hay tiendas PDF activas para asignación automática")
        
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
        logger.info(f"Archivo copiado a: {dest_path}")
        
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
        logger.info(f"Registro de actividad creado con ID: {activity.id}")
        
        # Si tenemos tienda, procesar inmediatamente
        if store:
            # Iniciar procesamiento en un hilo separado
            logger.info(f"Iniciando procesamiento en segundo plano para archivo {filename}")
            threading.Thread(target=process_pdf_file, args=(activity.id,)).start()
        else:
            logger.info(f"Archivo {filename} queda pendiente de asignación de tienda")
        
    except Exception as e:
        logger.error(f"Error al procesar archivo PDF {file_path}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

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
            logger.warning(f"No se encontró actividad con ID {activity_id} para actualizar estado")
            return False
        
        old_status = activity.status
        activity.status = status
        if error_message:
            activity.error_message = error_message
        
        if status == 'Processing':
            activity.processing_date = datetime.utcnow()
        
        db.session.commit()
        logger.info(f"Actividad ID {activity_id} actualizada: estado {old_status} → {status}")
        return True
    except Exception as e:
        logger.error(f"Error al actualizar estado de actividad {activity_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        db.session.rollback()
        return False