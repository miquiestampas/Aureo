# Instrucciones de Instalación y Uso de Áureo

## Requisitos del Sistema

- Windows 10 o superior
- Python 3.8 o superior
- Aproximadamente 150 MB de espacio en disco
- 4 GB de RAM (recomendado)

## Guía Rápida de Instalación

1. **Descomprima** el archivo zip en la ubicación deseada de su PC
2. **Abra** una ventana de comando (cmd o PowerShell) en la carpeta descomprimida
3. **Instale** las dependencias ejecutando:
   ```
   pip install -r aureo_app/requirements.txt
   ```
4. **Inicie** la aplicación con:
   ```
   python aureo_app/start.py
   ```
5. **Acceda** a la aplicación abriendo http://localhost:5000 en su navegador

## Configuración Inicial

Al iniciar por primera vez, la aplicación:

1. Creará automáticamente la estructura de directorios necesaria
2. Inicializará una base de datos SQLite vacía 
3. Creará un usuario SuperAdmin con nombre de usuario `117020`

**Importante:** Para establecer la contraseña del SuperAdmin, ejecute:
```
python aureo_app/reset_admin.py
```

## Uso de la Aplicación

### Inicio de Sesión

- Use el nombre de usuario `117020` y la contraseña configurada en el paso anterior
- Si olvida la contraseña, puede restablecerla con `python aureo_app/reset_admin.py`

### Vigilancia de Archivos

La aplicación puede monitorear automáticamente carpetas para detectar nuevos archivos:

- Excel: carpeta `aureo_app/data/excel_watch/`
- PDF: carpeta `aureo_app/data/pdf_watch/`

Simplemente coloque archivos Excel o PDF en estas carpetas y la aplicación los procesará automáticamente.

### Principales Funcionalidades

- **Gestión de compras**: Registro detallado de compras con información completa
- **Gestión documental**: Clasificación y búsqueda de documentos PDF
- **Alertas automáticas**: Detección de elementos y personas de interés
- **Búsqueda avanzada**: Encuentre rápidamente información por múltiples criterios
- **Exportación de datos**: Genere reportes y exporte información

## Scripts Útiles

- `aureo_app/start.py`: Inicia la aplicación
- `aureo_app/reset_admin.py`: Restablece la contraseña del administrador
- `aureo_app/db_update.py`: Actualiza la estructura de la base de datos (si es necesario)

## Solución de Problemas

1. **La aplicación no inicia**:
   - Verifique que Python 3.8+ está instalado y en el PATH
   - Asegúrese de que todas las dependencias estén instaladas

2. **Error al acceder a la interfaz web**:
   - Verifique que el servidor Flask esté en ejecución
   - Pruebe acceder a http://127.0.0.1:5000 en lugar de localhost

3. **Problemas con la vigilancia de archivos**:
   - Compruebe que las carpetas `aureo_app/data/excel_watch/` y `aureo_app/data/pdf_watch/` existan
   - Verifique los permisos de escritura en estas carpetas

## Contacto para Soporte

Para soporte técnico, contacte a su proveedor.