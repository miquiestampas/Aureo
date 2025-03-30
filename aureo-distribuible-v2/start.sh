#!/bin/bash

# Establece las variables de entorno desde .env si existe
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Verifica si la base de datos existe
if [ ! -f "aureo.db" ]; then
  echo "Inicializando base de datos..."
  npx tsx server/setupDb.ts
fi

# Inicia la aplicación
echo "Iniciando Áureo..."
npm run dev