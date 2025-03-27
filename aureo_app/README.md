# Áureo - Sistema de Gestión

## Descripción

Áureo es un sistema de gestión para tiendas que permite el seguimiento y control de compras a través de dos sistemas paralelos: Excel y PDF. El sistema incluye alertas automáticas para objetos y personas de interés, búsqueda avanzada y un sistema de vigilancia de archivos.

## Requisitos

- Python 3.8 o superior
- SQLite (incluido con Python)
- Navegador web moderno (Chrome, Firefox, Edge, etc.)

## Instalación

1. Extraiga el archivo ZIP en el directorio deseado.

2. Instale las dependencias necesarias:

```bash
pip install -r requirements.txt
```

3. Ejecute la aplicación:

```bash
cd aureo_app
python run.py
```

4. Acceda a la aplicación desde un navegador:
   - URL local: http://localhost:5000
   - URL de red: http://IP_DEL_SERVIDOR:5000

## Estructura del Proyecto

- `/app`: Código principal de la aplicación Flask
- `/data`: Directorios de vigilancia para archivos
  - `/excel_watch`: Directorio para detección automática de archivos Excel
  - `/pdf_watch`: Directorio para detección automática de archivos PDF
- `/uploads`: Directorio donde se almacenan los archivos procesados
  - `/excel`: Archivos Excel procesados
  - `/pdf`: Archivos PDF procesados
- `config.py`: Configuración general
- `run.py`: Script principal para ejecutar la aplicación
- `datos.sqlite`: Base de datos SQLite donde se almacena toda la información

## Usuarios y Acceso

Al ejecutar por primera vez, se crea automáticamente un usuario administrador:

- **Usuario**: 117020
- **Contraseña**: password123

**IMPORTANTE**: Cambie esta contraseña inmediatamente después del primer inicio de sesión.

## Configuración

### Vigilancia de Archivos

Para activar la vigilancia automática de archivos:

1. Acceda como administrador.
2. Vaya a Configuración del Sistema.
3. Active la opción "FILE_WATCHING_ACTIVE".

Los archivos detectados se procesarán según su tipo (Excel o PDF) y se asignarán a la tienda correspondiente si el código de tienda está incluido en el nombre del archivo.

### Asignación Automática de Tiendas

Para activar la asignación automática de tiendas cuando no se detecta el código en el nombre del archivo:

1. Acceda como administrador.
2. Vaya a Configuración del Sistema.
3. Active la opción "AUTO_STORE_DETECTION".

## Registros

Los registros de la aplicación se muestran en la consola donde se ejecuta el script `run.py`. Estas salidas son útiles para diagnosticar problemas.

## Soporte

Si necesita ayuda adicional o encuentra algún problema, contacte al administrador del sistema.