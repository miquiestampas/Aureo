# Áureo - Sistema de Gestión de Compras para Tiendas

Áureo es un sistema completo para la gestión y vigilancia de compras en tiendas, con capacidades avanzadas de procesamiento de archivos Excel y PDF, detección de coincidencias con listas de vigilancia, y gestión completa de datos.

## Características principales

- **Procesamiento dual de documentos:** Gestión simultánea de archivos Excel (datos de compra) y PDF (documentos formales)
- **Vigilancia automática de directorios:** Detección y procesamiento automático de nuevos archivos
- **Sistema de alertas:** Identificación de personas y objetos de interés en las transacciones
- **Búsqueda avanzada:** Localización precisa de información en la base de datos
- **Gestión de usuarios:** Tres niveles de acceso (SuperAdmin, Admin, Usuario)
- **Interfaz moderna:** Diseño claro y funcional para todas las operaciones

## Requisitos previos

- Node.js v16 o superior
- NPM v7 o superior
- Base de datos SQLite (incluida)

## Instalación

1. Descomprime este archivo en la ubicación deseada
2. Abre una terminal en la carpeta descomprimida
3. Ejecuta el siguiente comando para instalar las dependencias:

```bash
npm install
```

## Iniciar la aplicación

Para iniciar la aplicación, ejecuta:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5000`

## Acceso inicial

- **Usuario:** 117020
- **Contraseña:** admin
- **Rol:** SuperAdmin

## Estructura de directorios

- `data/excel_watch` - Directorio vigilado para archivos Excel
- `data/pdf_watch` - Directorio vigilado para archivos PDF
- `uploads/excel` - Para subidas manuales de Excel
- `uploads/pdf` - Para subidas manuales de PDF
- `server/` - Código del servidor API
- `shared/` - Esquemas y definiciones compartidas
- `client/` - Interfaz de usuario

## Gestión de usuarios

Solamente el usuario SuperAdmin puede crear nuevos usuarios. Los nuevos usuarios pueden tener roles de Admin o Usuario estándar.

## Resetear la contraseña de SuperAdmin

Si necesitas restablecer la contraseña del administrador principal, ejecuta:

```bash
node resetSuperAdmin.js
```

## Soporte

Para cualquier consulta o soporte técnico, contacta con el equipo de desarrollo a través de los canales habituales.

---
© 2025 Áureo - Versión 2.0