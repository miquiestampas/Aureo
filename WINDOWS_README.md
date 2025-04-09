# Instrucciones para ejecutar Áureo en Windows

Si estás experimentando problemas al ejecutar la aplicación Áureo en Windows, especialmente relacionados con el error `ENOTSUP: operation not supported on socket ::1:5000`, puedes usar cualquiera de los scripts proporcionados en este directorio.

## Requisitos previos

- Node.js (versión 16 o superior) instalado en tu sistema
- NPM (normalmente viene incluido con Node.js)

## Opciones para iniciar la aplicación

### Opción 1: Usando el script batch (.bat)

1. Haz doble clic en el archivo `start_windows.bat`
2. Se abrirá una ventana de comando que iniciará la aplicación
3. La aplicación estará disponible en http://127.0.0.1:5000

### Opción 2: Usando PowerShell

1. Haz clic derecho en el archivo `start_windows.ps1` y selecciona "Ejecutar con PowerShell"
   - Si aparece una advertencia de seguridad, puedes ejecutar el siguiente comando en PowerShell para permitir la ejecución:
   - `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass`
2. La aplicación se iniciará en la ventana de PowerShell
3. La aplicación estará disponible en http://127.0.0.1:5000

### Opción 3: Usando Node.js directamente

1. Abre un símbolo del sistema (CMD) o PowerShell
2. Navega hasta el directorio del proyecto
3. Ejecuta el siguiente comando:
   ```
   node start_windows.js
   ```
4. La aplicación estará disponible en http://127.0.0.1:5000

## Solución de problemas comunes

Si sigue habiendo problemas para iniciar la aplicación:

1. **Asegúrate de que el puerto 5000 no esté en uso**: Puedes verificar si hay procesos usando el puerto 5000 con el comando:
   ```
   netstat -ano | findstr :5000
   ```
   Si está en uso, puedes finalizar el proceso usando el ID de proceso (PID) mostrado:
   ```
   taskkill /F /PID <número_PID>
   ```

2. **Comprobar la versión de Node.js**: Asegúrate de tener una versión reciente:
   ```
   node -v
   ```
   Se recomienda usar Node.js 16 o superior.

3. **Problema de dependencias**: Si ves errores relacionados con módulos, asegúrate de haber instalado todas las dependencias:
   ```
   npm install
   ```

4. **Firewall de Windows**: Asegúrate de que el Firewall de Windows permita las conexiones en el puerto 5000.

## Notas importantes

- Todos estos scripts están configurados para forzar el uso de IPv4 (127.0.0.1) en lugar de IPv6 (::1)
- Se crean automáticamente los directorios necesarios para la aplicación
- Para detener la aplicación, presiona `Ctrl+C` en la ventana de comando

Si continúas experimentando problemas, por favor contacta al soporte técnico con los detalles del error que estás enfrentando.