/**
 * Script de inicio especial para entornos Windows
 * 
 * Este script inicia la aplicación Áureo utilizando una configuración
 * específica para Windows, evitando problemas comunes con IPv6 y sockets.
 * 
 * Configurado para soportar caracteres internacionales (UTF-8) como la Ñ.
 */

// Configurar la codificación para la consola
process.stdout.setEncoding('utf8');

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando Áureo en modo Windows...');

// Crear los directorios necesarios si no existen
const dataDirs = ['data', 'data/excel', 'data/pdf', 'uploads'];
dataDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`📁 Creando directorio: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Establecer variables de entorno específicas para Windows
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

// Iniciar el servidor en un nuevo proceso
console.log('🌐 Iniciando servidor...');
const server = spawn('node', [
  '--no-warnings',
  '--dns-result-order=ipv4first',
  '--require=tsx',
  '--experimental-specifier-resolution=node',
  'server/index.ts'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NODE_OPTIONS: '--dns-result-order=ipv4first',
    LANG: 'es_ES.UTF-8',
    LC_ALL: 'es_ES.UTF-8',
    LC_CTYPE: 'UTF-8'
  }
});

// Manejar eventos del proceso
server.on('error', (err) => {
  console.error('❌ Error al iniciar el servidor:', err.message);
});

server.on('close', (code) => {
  if (code !== 0) {
    console.log(`⚠️ El servidor se cerró con código: ${code}`);
  }
  console.log('👋 ¡Hasta pronto!');
});

// Mostrar instrucciones claras
console.log('');
console.log('📌 INSTRUCCIONES:');
console.log('- Áureo debería estar disponible en: http://127.0.0.1:5000');
console.log('- Para detener la aplicación, presiona CTRL+C');
console.log('');
console.log('🔍 Comprueba la consola para ver mensajes de error si la aplicación no inicia correctamente.');