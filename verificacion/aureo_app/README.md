# Áureo - Sistema de Gestión de Compras

Áureo es un sistema para gestionar información de compras en joyerías, procesando datos de archivos Excel y PDF de forma automatizada.

## Requisitos del Sistema

- Python 3.8 o superior
- Aproximadamente 150 MB de espacio en disco
- 4 GB de RAM (recomendado)
- Windows 10 o superior

## Instalación

1. Descomprime este directorio en la ubicación deseada en tu servidor Windows
2. Abre una terminal (cmd o PowerShell) en el directorio descomprimido
3. Instala las dependencias requeridas:

```
pip install -r requirements.txt
```

## Configuración Inicial

Al iniciar por primera vez, la aplicación:

1. Creará automáticamente la estructura de directorios necesaria
2. Inicializará una base de datos SQLite vacía con todos los esquemas requeridos
3. Creará un usuario SuperAdmin por defecto con nombre de usuario `117020`

Para configurar la contraseña del SuperAdmin, ejecuta:

```
python reset_admin.py
```

## Uso de la Aplicación

### Inicio Rápido

Para iniciar la aplicación:

```
python start.py
```

Esto realizará todas las comprobaciones necesarias e iniciará el servidor Flask.
Por defecto, la aplicación estará disponible en http://localhost:5000.

### Scripts de Utilidad

- `reset_admin.py`: Restablece la contraseña del administrador (SuperAdmin)
- `db_update.py`: Actualiza la estructura de la base de datos si es necesario
- `make_dist.py`: Crea un archivo zip de distribución limpio para implementación

### Vigilancia Automática de Archivos

La aplicación puede monitorear automáticamente carpetas específicas para procesar:

- Archivos Excel: `./data/excel_watch/`
- Archivos PDF: `./data/pdf_watch/`

Esta funcionalidad puede activarse/desactivarse a través de la interfaz de administración.

## Estructura de Directorios

- `/app`: Código principal de la aplicación Flask
- `/data`: Directorios de vigilancia para Excel y PDF
- `/uploads`: Archivos subidos manualmente por los usuarios
- `/flask_session`: Datos de sesión (generados automáticamente)

## Resolución de Problemas

### Base de Datos

Si encuentras errores relacionados con la base de datos, intenta:

1. Hacer una copia de seguridad de `datos.sqlite` si contiene información importante
2. Ejecutar `python db_update.py` para actualizar la estructura de la base de datos

### Usuario Administrador

Si has olvidado la contraseña del administrador:

```
python reset_admin.py
```

### Archivos No Procesados

- Verifica que los directorios de vigilancia existan y tengan permisos de escritura
- Asegúrate de que la vigilancia de archivos esté activada en la configuración
- Verifica que los archivos Excel y PDF sigan el formato esperado

## Desarrolladores

Para modificar el código fuente:

1. El backend utiliza Flask con SQLAlchemy para el ORM
2. El frontend está construido con React y se sirve como archivos estáticos
3. Para reconstruir el frontend, utiliza el script:

```
python build_frontend.py
```

## Licencia

Este software es propiedad del cliente y está protegido por leyes de propiedad intelectual. Su uso, modificación y distribución está restringida según los términos acordados.