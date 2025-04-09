# Script de inicio para Windows usando PowerShell
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Áureo en modo Windows (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Comprobar si Node.js está instalado
try {
    $nodeVersion = node -v
    Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js no encontrado. Por favor, instala Node.js desde https://nodejs.org/" -ForegroundColor Red
    exit
}

# Crear directorios necesarios
$directories = @("data", "data\excel", "data\pdf", "uploads")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        Write-Host "Creando directorio: $dir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Configurar el entorno para forzar IPv4
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"

# Mostrar instrucciones
Write-Host "`nIniciando servidor..." -ForegroundColor Green
Write-Host "La aplicación estará disponible en: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "Para detener la aplicación, presiona CTRL+C`n" -ForegroundColor Yellow

# Iniciar la aplicación con configuración para IPv4
try {
    node --dns-result-order=ipv4first --require=tsx server/index.ts
} catch {
    Write-Host "`nHa ocurrido un error al iniciar la aplicación:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Por favor, revisa si hay errores en la consola." -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
}