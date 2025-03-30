# Guía de Usuario - Áureo v2.0

## Índice
1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Interfaz Principal](#interfaz-principal)
4. [Gestión de Tiendas](#gestión-de-tiendas)
5. [Procesamiento de Archivos](#procesamiento-de-archivos)
6. [Gestión de Alertas y Coincidencias](#gestión-de-alertas-y-coincidencias)
7. [Módulo de Investigación](#módulo-de-investigación)
8. [Administración de Usuarios](#administración-de-usuarios)
9. [Preguntas Frecuentes](#preguntas-frecuentes)

## Introducción

Áureo es un sistema avanzado de gestión y vigilancia para controlar la actividad de compra en tiendas. El sistema permite procesar información de dos tipos principales de documentos:

- **Archivos Excel**: Contienen datos detallados de compras realizadas
- **Archivos PDF**: Documentos formales relacionados con las tiendas

El sistema monitoriza constantemente estos archivos para detectar información de interés relacionada con personas u objetos bajo vigilancia.

## Acceso al Sistema

1. Inicie la aplicación ejecutando `start.bat` (Windows) o `start.sh` (Linux/Mac)
2. Acceda a través del navegador a `http://localhost:5000`
3. Introduzca sus credenciales:
   - Usuario: (asignado por el administrador)
   - Contraseña: (su contraseña personal)

### Roles de Usuario

- **SuperAdmin**: Acceso completo al sistema, incluyendo gestión de usuarios
- **Admin**: Puede gestionar tiendas, alertas y datos, pero no usuarios
- **Usuario**: Acceso básico para consulta de información

## Interfaz Principal

La interfaz principal muestra:

- **Panel de Control**: Resumen estadístico del sistema
- **Alertas Recientes**: Últimas coincidencias detectadas
- **Actividad de Archivos**: Últimos archivos procesados
- **Menú Principal**: Acceso a todas las funcionalidades

## Gestión de Tiendas

### Ver Listado de Tiendas
1. Navegue a "Tiendas" en el menú principal
2. Visualice el listado completo con filtros disponibles por tipo y ubicación

### Añadir Nueva Tienda
1. Pulse el botón "Nueva Tienda"
2. Complete los campos obligatorios:
   - Código (único)
   - Nombre
   - Tipo
   - Ubicación (Distrito y Localidad)
3. Pulse "Guardar"

### Modificar Datos de Tienda
1. Seleccione la tienda de la lista
2. Pulse el botón "Editar"
3. Modifique la información
4. Pulse "Guardar"

## Procesamiento de Archivos

### Carga Manual de Archivos
1. Seleccione "Cargar Archivos" en el menú
2. Elija el tipo de archivo (Excel o PDF)
3. Seleccione la tienda correspondiente
4. Arrastre el archivo o utilice el selector de archivos
5. Pulse "Subir"

### Monitorización Automática
El sistema supervisa automáticamente las carpetas:
- `data/excel_watch`: Para archivos Excel
- `data/pdf_watch`: Para archivos PDF

Los archivos detectados se procesarán automáticamente según su nombre.

## Gestión de Alertas y Coincidencias

### Revisión de Coincidencias
1. Acceda a "Coincidencias" en el menú principal
2. Filtrar por estado (No leído, Leído, Descartado)
3. Consulte los detalles haciendo clic en cada elemento

### Procesamiento de Alertas
Para cada coincidencia puede:
- Marcar como leída
- Descartar (falso positivo)
- Añadir notas de revisión

## Módulo de Investigación

El módulo de investigación permite realizar búsquedas avanzadas:

1. Acceda a "Investigación" en el menú principal
2. Seleccione los criterios de búsqueda:
   - Por persona
   - Por objeto
   - Por documento
   - Por rango de fechas
3. Pulse "Buscar"
4. Utilice las opciones de exportación para generar informes

## Administración de Usuarios

*Solo disponible para SuperAdmin*

### Crear Nuevo Usuario
1. Acceda a "Administración > Usuarios"
2. Pulse "Nuevo Usuario"
3. Complete la información:
   - Nombre de usuario
   - Contraseña
   - Rol asignado
4. Pulse "Guardar"

### Modificar Usuario
1. Seleccione el usuario de la lista
2. Pulse "Editar"
3. Modifique la información
4. Pulse "Guardar"

## Preguntas Frecuentes

**P: ¿Qué hago si olvidé mi contraseña?**  
R: Contacte al administrador para que restablezca su contraseña.

**P: ¿Cómo detecta el sistema a qué tienda pertenece un archivo?**  
R: El sistema busca el código de tienda en el nombre del archivo. Si no lo encuentra, solicita asignación manual.

**P: ¿Qué tipo de archivos Excel son compatibles?**  
R: Se admiten archivos .xlsx y .xls con la estructura estándar definida.

**P: ¿Puedo exportar los resultados de una búsqueda?**  
R: Sí, todos los resultados pueden exportarse a Excel o PDF desde el botón "Exportar".

**P: ¿Cómo se determina el nivel de coincidencia?**  
R: El sistema establece 4 niveles:
   - Exacta: ≥95% de similitud
   - Alta: ≥80% de similitud
   - Media: ≥65% de similitud
   - Baja: ≥50% de similitud

---
Para asistencia técnica, contacte al departamento de soporte.