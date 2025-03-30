#!/bin/bash

# Script para iniciar la aplicación Áureo

echo "=== Iniciando Áureo v2.0 ==="
echo "Verificando directorios necesarios..."

# Asegurar que existan los directorios necesarios
mkdir -p data/excel_watch
mkdir -p data/pdf_watch
mkdir -p uploads/excel
mkdir -p uploads/pdf

# Verificar si la base de datos existe, si no, crearla
if [ ! -f "aureo.db" ]; then
    echo "Creando base de datos inicial..."
    npx tsx createTables.ts
fi

# Iniciar la aplicación
echo "Iniciando servidor..."
npm run dev