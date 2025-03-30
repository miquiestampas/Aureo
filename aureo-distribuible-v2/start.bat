@echo off
setlocal

REM Establece las variables de entorno desde .env si existe
if exist .env (
  for /F "tokens=*" %%A in (.env) do set %%A
)

REM Verifica si la base de datos existe
if not exist aureo.db (
  echo Inicializando base de datos...
  call npx tsx server/setupDb.ts
)

REM Inicia la aplicación
echo Iniciando Aureo...
call npm run dev

endlocal