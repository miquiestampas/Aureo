@echo off
:: Establecer la codificación a UTF-8 para permitir caracteres especiales como la Ñ
chcp 65001
ECHO ========================================
ECHO Iniciando Áureo en modo Windows
ECHO ========================================

:: Comprobar si Node.js está instalado
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
  ECHO ERROR: Node.js no encontrado. Por favor, instala Node.js desde https://nodejs.org/
  GOTO :EOF
)

:: Crear directorios necesarios
IF NOT EXIST data\excel mkdir data\excel
IF NOT EXIST data\pdf mkdir data\pdf
IF NOT EXIST uploads mkdir uploads

:: Establecer variables de entorno para IPv4 y soporte de caracteres internacionales
SET NODE_OPTIONS=--dns-result-order=ipv4first
SET LANG=es_ES.UTF-8
SET LC_ALL=es_ES.UTF-8
SET LC_CTYPE=UTF-8

:: Iniciar la aplicación
ECHO Iniciando servidor...
ECHO La aplicación estará disponible en: http://127.0.0.1:5000
ECHO Para detener la aplicación, presiona CTRL+C

:: Usar las opciones necesarias para forzar IPv4 y soportar caracteres especiales como la Ñ
node --dns-result-order=ipv4first --require=tsx --experimental-specifier-resolution=node server/index.ts

:: En caso de error, mostrar un mensaje y mantener la ventana abierta
IF %ERRORLEVEL% NEQ 0 (
  ECHO.
  ECHO Ha ocurrido un error al iniciar la aplicación.
  ECHO Por favor, revisa si hay errores en la consola.
  PAUSE
)