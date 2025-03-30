import os
import pandas as pd
from datetime import datetime
import re
from PyPDF2 import PdfReader
from . import db
from .models import FileActivity, ExcelData, PdfDocument, WatchlistPerson, WatchlistItem, Alert, Store

def process_excel_file(activity_id):
    """
    Procesa un archivo Excel asociado a una actividad.
    
    Args:
        activity_id: ID de la actividad de archivo
    
    Returns:
        bool: True si se procesó correctamente, False en caso contrario
    """
    try:
        # Obtener la actividad
        activity = FileActivity.query.get(activity_id)
        if not activity:
            return False
        
        # Actualizar estado a procesando
        activity.status = 'Processing'
        activity.processing_date = datetime.utcnow()
        db.session.commit()
        
        # Leer el archivo Excel
        df = pd.read_excel(activity.saved_path)
        store_code = activity.store_code
        
        # Procesar filas
        rows_processed = 0
        
        for _, row in df.iterrows():
            excel_data = create_excel_data_from_values(row.values, store_code, activity_id)
            if excel_data:
                db.session.add(excel_data)
                rows_processed += 1
                
                # Verificar si hay coincidencias con elementos de la lista de vigilancia
                db.session.flush()  # Obtener el ID asignado
                check_watchlist_matches(excel_data)
        
        # Actualizar estado a procesado
        activity.status = 'Processed'
        db.session.commit()
        
        return True
    except Exception as e:
        # Manejo de errores
        if activity:
            activity.status = 'Failed'
            activity.error_message = str(e)
            db.session.commit()
        return False

def process_pdf_file(activity_id):
    """
    Procesa un archivo PDF asociado a una actividad.
    
    Args:
        activity_id: ID de la actividad de archivo
    
    Returns:
        bool: True si se procesó correctamente, False en caso contrario
    """
    try:
        # Obtener la actividad
        activity = FileActivity.query.get(activity_id)
        if not activity:
            return False
        
        # Actualizar estado a procesando
        activity.status = 'Processing'
        activity.processing_date = datetime.utcnow()
        db.session.commit()
        
        # Leer el archivo PDF
        reader = PdfReader(activity.saved_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # Determinar tipo de documento y título
        document_type = determine_document_type(text)
        title = extract_title(text) or os.path.basename(activity.saved_path)
        
        # Crear el documento PDF
        pdf_document = PdfDocument(
            store_code=activity.store_code,
            document_type=document_type,
            title=title,
            path=activity.saved_path,
            file_size=os.path.getsize(activity.saved_path),
            file_activity_id=activity_id
        )
        
        db.session.add(pdf_document)
        
        # Actualizar estado a procesado
        activity.status = 'Processed'
        db.session.commit()
        
        return True
    except Exception as e:
        # Manejo de errores
        if activity:
            activity.status = 'Failed'
            activity.error_message = str(e)
            db.session.commit()
        return False

def create_excel_data_from_values(values, store_code, activity_id):
    """
    Crea un objeto ExcelData a partir de los valores de una fila de Excel.
    
    Args:
        values: Lista de valores de la fila
        store_code: Código de la tienda
        activity_id: ID de la actividad de archivo
    
    Returns:
        ExcelData: Objeto creado o None si no hay datos suficientes
    """
    def safe_get(lst, idx, default=None):
        try:
            val = lst[idx]
            return None if pd.isna(val) else str(val).strip()
        except (IndexError, TypeError):
            return default
    
    # Extracción de datos (ajustar según las columnas reales)
    # A=Código, B=Número, C=Fecha, D=Cliente, E=DNI, F=Dirección, G=Provincia/País
    # H=Objeto, I=Peso, J=Metal, K=Grabado, L=Piedras/Quilates, M=Precio, N=Papeletas, O=Venta
    
    # Verificar que tenemos los campos mínimos necesarios 
    order_number = safe_get(values, 1)  # Columna B
    order_date_str = safe_get(values, 2)  # Columna C
    customer_name = safe_get(values, 3)  # Columna D
    
    if not order_number or not order_date_str or not customer_name:
        return None  # Faltan datos imprescindibles
    
    # Convertir fecha
    try:
        if isinstance(order_date_str, datetime):
            order_date = order_date_str
        else:
            order_date = pd.to_datetime(order_date_str)
    except:
        # Si falla la conversión, usar la fecha actual
        order_date = datetime.utcnow()
    
    # Intentar convertir fecha de venta si existe
    sale_date_str = safe_get(values, 14)  # Columna O
    sale_date = None
    if sale_date_str:
        try:
            if isinstance(sale_date_str, datetime):
                sale_date = sale_date_str
            else:
                sale_date = pd.to_datetime(sale_date_str)
        except:
            sale_date = None
    
    # Crear el objeto ExcelData
    return ExcelData(
        store_code=store_code,
        order_number=order_number,
        order_date=order_date,
        customer_name=customer_name,
        customer_contact=safe_get(values, 4),  # Columna E (DNI)
        customer_address=safe_get(values, 5),  # Columna F
        customer_location=safe_get(values, 6),  # Columna G
        item_details=safe_get(values, 7),  # Columna H
        metals=safe_get(values, 9),  # Columna J
        engravings=safe_get(values, 10),  # Columna K
        stones=safe_get(values, 11),  # Columna L
        carats=safe_get(values, 8),  # Columna I (peso)
        price=safe_get(values, 12),  # Columna M
        pawn_ticket=safe_get(values, 13),  # Columna N
        sale_date=sale_date,
        file_activity_id=activity_id
    )

def check_watchlist_matches(excel_data):
    """
    Comprueba si hay coincidencias con elementos de la lista de vigilancia.
    
    Args:
        excel_data: Objeto ExcelData para comprobar
    """
    # Comprobar coincidencias de personas
    watchlist_persons = WatchlistPerson.query.filter_by(active=True).all()
    for person in watchlist_persons:
        # Coincidencia por nombre (no sensible a mayúsculas/minúsculas)
        if person.name and excel_data.customer_name and \
           person.name.lower() in excel_data.customer_name.lower():
            alert = Alert(
                excel_data_id=excel_data.id,
                watchlist_person_id=person.id,
                type='Person',
                match_type='Name',
                match_value=excel_data.customer_name,
                status='Pending'
            )
            db.session.add(alert)
        
        # Coincidencia por número de identificación
        if person.id_number and excel_data.customer_contact and \
           person.id_number in excel_data.customer_contact:
            alert = Alert(
                excel_data_id=excel_data.id,
                watchlist_person_id=person.id,
                type='Person',
                match_type='IDNumber',
                match_value=excel_data.customer_contact,
                status='Pending'
            )
            db.session.add(alert)
    
    # Comprobar coincidencias de elementos
    watchlist_items = WatchlistItem.query.filter_by(active=True).all()
    for item in watchlist_items:
        # Coincidencia en descripción de artículo
        if item.description and excel_data.item_details and \
           item.description.lower() in excel_data.item_details.lower():
            alert = Alert(
                excel_data_id=excel_data.id,
                watchlist_item_id=item.id,
                type='Item',
                match_type='Description',
                match_value=excel_data.item_details,
                status='Pending'
            )
            db.session.add(alert)
        
        # Coincidencia por número de serie/grabado
        if item.serial_number and excel_data.engravings and \
           item.serial_number in excel_data.engravings:
            alert = Alert(
                excel_data_id=excel_data.id,
                watchlist_item_id=item.id,
                type='Item',
                match_type='Serial',
                match_value=excel_data.engravings,
                status='Pending'
            )
            db.session.add(alert)
    
    db.session.commit()

def determine_document_type(text):
    """
    Determina el tipo de documento PDF basado en su contenido.
    
    Args:
        text: Texto extraído del PDF
    
    Returns:
        str: Tipo de documento
    """
    text_lower = text.lower()
    
    if "factura" in text_lower:
        return "Factura"
    elif "albarán" in text_lower or "albaran" in text_lower:
        return "Albarán"
    elif "presupuesto" in text_lower:
        return "Presupuesto"
    elif "contrato" in text_lower:
        return "Contrato"
    elif "certificado" in text_lower:
        return "Certificado"
    elif "compra" in text_lower and ("oro" in text_lower or "plata" in text_lower):
        return "Compra"
    elif "venta" in text_lower:
        return "Venta"
    else:
        return "Documento"

def extract_title(text):
    """
    Extrae un posible título del texto del PDF.
    
    Args:
        text: Texto extraído del PDF
    
    Returns:
        str: Título extraído o None
    """
    # Buscar líneas que podrían ser títulos (primer bloque de texto significativo)
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if len(line) > 5 and len(line) < 100:  # Un título razonable
            # Evitar líneas que son claramente no títulos
            if re.search(r'^\d+[.,/-]', line):  # Empieza con número seguido de puntuación
                continue
            if re.search(r'@|www|http', line):  # Contiene elementos web
                continue
            if re.search(r'^\d{2}/\d{2}/\d{4}', line):  # Es una fecha
                continue
            
            return line
    
    return None