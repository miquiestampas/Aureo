@echo off
echo === Iniciando Aureo v2.0 ===
echo Verificando directorios necesarios...

REM Asegurar que existan los directorios necesarios
mkdir data\excel_watch 2>nul
mkdir data\pdf_watch 2>nul
mkdir uploads\excel 2>nul
mkdir uploads\pdf 2>nul

REM Verificar si la base de datos existe, si no, crearla
if not exist aureo.db (
    echo Creando base de datos inicial...
    npx tsx createTables.ts
)

REM Iniciar la aplicación
echo Iniciando servidor...
npm run dev