import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import os from 'os';
import fs from 'fs';
import path from 'path';

// Función para detectar si estamos en Windows
const isWindows = os.platform() === 'win32';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configurar cabeceras para UTF-8 y asegurar que los caracteres especiales como la Ñ se muestren correctamente
app.use((req, res, next) => {
  // No sobreescribir el Content-Type si ya ha sido establecido
  if (!res.getHeader('Content-Type')) {
    // Detectar tipo de contenido basado en la ruta o usar JSON por defecto
    if (req.path.endsWith('.html') || req.path === '/' || req.path === '') {
      res.header('Content-Type', 'text/html; charset=utf-8');
    } else if (req.path.endsWith('.css')) {
      res.header('Content-Type', 'text/css; charset=utf-8');
    } else if (req.path.endsWith('.js')) {
      res.header('Content-Type', 'application/javascript; charset=utf-8');
    } else if (req.path.startsWith('/api')) {
      res.header('Content-Type', 'application/json; charset=utf-8');
    }
  }
  next();
});

// Asegúrate de que existan los directorios para los archivos temporales y cargados
const uploadsDir = path.join(process.cwd(), 'uploads');
const tempDir = path.join(uploadsDir, 'temp');
const excelDir = path.join(uploadsDir, 'excel');
const pdfDir = path.join(uploadsDir, 'pdf');

[uploadsDir, tempDir, excelDir, pdfDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Configuración específica según el sistema operativo
  const serverConfig = {
    port,
    host: "0.0.0.0"  // Escuchar en todas las interfaces
  };
  
  // Crear y loggear la URL según la configuración
  server.listen(serverConfig, () => {
    log(`Server running at http://localhost:${port}`);
    log(`Server running at http://127.0.0.1:${port}`);
    // Mostrar todas las IPs disponibles para facilitar el acceso
    const networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      networkInterfaces[interfaceName]?.forEach((iface: any) => {
        if (iface.family === 'IPv4' && !iface.internal) {
          log(`Available on network at: http://${iface.address}:${port}`);
        }
      });
    });
  });
})();
