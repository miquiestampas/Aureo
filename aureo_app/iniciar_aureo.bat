@echo off
echo === INICIANDO AUREO ===
echo.
echo Verificando Python...
python --version 2>NUL
if errorlevel 1 (
  echo ERROR: Python no esta instalado o no esta en el PATH
  echo Por favor, instale Python 3.9 o superior desde https://www.python.org/downloads/
  echo Asegurese de marcar la opcion "Add Python to PATH" durante la instalacion
  pause
  exit /b 1
)

echo.
echo Iniciando la aplicacion...
python start.py
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo iniciar la aplicacion
  echo Por favor, revise las instrucciones en INSTALL.txt
  pause
  exit /b 1
)

exit /b 0