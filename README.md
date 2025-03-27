# Áureo - Sistema de Gestión para Tiendas

## Descripción

Áureo es un sistema de gestión completo diseñado para tiendas que necesitan un control detallado de compras y documentación. El sistema combina dos métodos paralelos de ingreso de datos:

1. **Sistema Excel**: Para el registro detallado de compras con información completa de cliente y artículos.
2. **Sistema PDF**: Para la gestión documental y clasificación por códigos de tienda.

El sistema cuenta con detección automática de archivos y procesamiento en segundo plano, búsqueda avanzada, alertas automáticas para elementos y personas de interés, y una interfaz completamente en español.

## Características Principales

- Interfaz de usuario moderna y fácil de usar con React
- Backend robusto desarrollado en Python con Flask
- Base de datos SQLite para fácil despliegue sin configuración adicional
- Vigilancia automática de archivos nuevos en carpetas específicas
- Asignación automática o manual de documentos a tiendas
- Sistema de alertas para elementos y personas de interés
- Búsqueda avanzada con múltiples criterios
- Tres niveles de usuarios: SuperAdmin, Admin y User
- Exportación de datos y reportes
- Diseño responsivo que funciona en cualquier dispositivo

## Estructura del Proyecto

El proyecto está dividido en dos componentes principales:

1. **Frontend (cliente)**: Aplicación React con TypeScript ubicada en el directorio `/client`
2. **Backend (servidor)**: Aplicación Flask ubicada en el directorio `/aureo_app`

### Instalación y Ejecución

#### Aplicación Backend (Flask)

La aplicación Flask es completamente independiente y puede ejecutarse en cualquier servidor Windows con Python 3.8 o superior.

1. Descomprima el archivo `aureo_app.zip` en el directorio deseado
2. Instale las dependencias:
   ```
   pip install -r requirements.txt
   ```
3. Ejecute la aplicación:
   ```
   python start.py
   ```

Para más detalles, consulte el README dentro del directorio `aureo_app`.

#### Desarrollo del Frontend

El frontend se desarrolla en React y se compila para ser servido por la aplicación Flask:

1. Navegue al directorio del cliente:
   ```
   cd client
   ```
2. Instale las dependencias:
   ```
   npm install
   ```
3. Ejecute el servidor de desarrollo:
   ```
   npm run dev
   ```

Para compilar el frontend para producción:
```
npm run build
```

Los archivos compilados pueden copiarse manualmente al directorio `aureo_app/app/static` o usar el script `build_frontend.py` incluido en `aureo_app`.

## Configuración y Personalización

### Sistema de Vigilancia de Archivos

El sistema puede vigilar automáticamente directorios específicos para detectar nuevos archivos:

- Excel: `aureo_app/data/excel_watch/`
- PDF: `aureo_app/data/pdf_watch/`

Esta función puede habilitarse o deshabilitarse desde la configuración del sistema.

### Base de Datos

La aplicación utiliza SQLite por defecto, lo que simplifica la instalación y el mantenimiento. Los datos se almacenan en el archivo `aureo_app/datos.sqlite`.

## Licencia

Esta aplicación es propiedad del cliente y está protegida por las leyes de propiedad intelectual.

## Soporte

Para soporte técnico, contacte al desarrollador o abra un ticket en el sistema de soporte.