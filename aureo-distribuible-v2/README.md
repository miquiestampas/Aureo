# Áureo v2.0

Sistema avanzado para gestión y control de compras en tiendas.

## Características principales

- Procesamiento de archivos Excel y PDF
- Detección automática de señalamientos
- Panel de control centralizado
- Gestión de tiendas y usuarios
- Módulo de investigación avanzado
- Reportes y exportaciones
- Sistema de alertas en tiempo real

## Requisitos

- Node.js 18+ (recomendado Node.js 20)
- npm 8+

## Instalación

1. Descomprima el archivo `aureo-v2.0-completo.zip` en la ubicación deseada.
2. Abra una terminal y navegue hasta la carpeta donde descomprimió el archivo.
3. Ejecute el siguiente comando para instalar las dependencias:

```
npm install
```

## Configuración

El archivo `.env` ya está configurado con los valores iniciales. Puede modificarlo según sus necesidades:

```
DATABASE_URL=file:./aureo.db
DATABASE_TYPE=sqlite
SESSION_SECRET=aureo_secure_session_key_12345
```

## Uso

### En Windows:
Ejecute el archivo `start.bat` haciendo doble clic sobre él o mediante el comando:
```
start.bat
```

### En Linux/Mac:
Ejecute el script de inicio:
```
chmod +x start.sh
./start.sh
```

Esto iniciará el servidor y la aplicación estará disponible en http://localhost:5000

## Acceso inicial

- Usuario: 117020
- Contraseña: admin

## Estructura de directorios

- `/client`: Código fuente del frontend
- `/server`: Código fuente del backend
- `/shared`: Esquemas y tipos compartidos
- `/data`: Datos de la aplicación
  - `/excel_watch`: Carpeta vigilada para archivos Excel
  - `/pdf_watch`: Carpeta vigilada para archivos PDF
- `/uploads`: Carpeta para archivos subidos manualmente

## Para más información

Consulte el archivo `guia-usuario.md` para obtener detalles completos sobre el uso de la aplicación.