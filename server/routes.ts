import { Express, Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { createServer, type Server } from "http";
import { initializeFileWatchers, setupSocketIO } from "./fileWatcher";
import { InsertStore, InsertExcelData, InsertPdfDocument } from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processExcelFile, processPdfFile } from "./fileProcessors";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar la autenticación
  setupAuth(app);
  
  // Configurar el servidor HTTP y Socket.IO
  const httpServer = createServer(app);
  setupSocketIO(httpServer);
  
  // Inicializar los vigilantes de archivos
  await initializeFileWatchers();
  
  // Configurar el middleware de carga de archivos
  const upload = setupFileUpload();
  
  // Ruta para obtener el estado del servidor (ruta pública)
  app.get("/api/system/status", (req, res) => {
    res.json({
      status: "online",
      version: "1.0.0",
      message: "Áureo API funcionando correctamente"
    });
  });

  // Los módulos de señalamientos y coincidencias han sido eliminados temporalmente
  // Estos módulos serán reimplementados en el futuro
  
  /* Los endpoints de señalamientos y coincidencias han sido eliminados:
  Rutas señalamientos:
  - GET /api/senalamiento/personas
  - GET /api/senalamiento/personas/:id
  - GET /api/senalamiento/personas/buscar/:query
  - POST /api/senalamiento/personas
  - PUT /api/senalamiento/personas/:id
  - DELETE /api/senalamiento/personas/:id
  - GET /api/senalamiento/objetos
  - GET /api/senalamiento/objetos/:id
  - GET /api/senalamiento/objetos/buscar/:query
  - POST /api/senalamiento/objetos
  - PUT /api/senalamiento/objetos/:id
  - DELETE /api/senalamiento/objetos/:id
  
  Rutas coincidencias:
  - GET /api/coincidencias
  - GET /api/coincidencias/:id
  - PUT /api/coincidencias/:id/estado
  - GET /api/coincidencias/excel/:excelDataId
  - GET /api/coincidencias/noleidas/count
  - POST /api/coincidencias/detectar/:excelDataId
  
  Las funcionalidades serán reimplementadas en el futuro.
  */
  
  // Stub para el endpoint de coincidencias no leídas (para mantener compatibilidad con el frontend)
  app.get("/api/coincidencias/noleidas/count", (req, res) => {
    res.json({ count: 0 });
  });
  
  // Rutas de tiendas
  
  // Obtener todas las tiendas
  app.get("/api/stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === "true";
        const stores = await storage.getStores();
        res.json(stores);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener una tienda específica por código
  app.get("/api/stores/:code", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const code = req.params.code;
        const store = await storage.getStoreByCode(code);
        
        if (!store) {
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        res.json(store);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Crear una nueva tienda
  app.post("/api/stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const storeData: InsertStore = req.body;
        
        // Verificar si la tienda ya existe
        const existingStore = await storage.getStoreByCode(storeData.code);
        if (existingStore) {
          return res.status(400).json({ error: "El código de tienda ya existe" });
        }
        
        // La fecha de creación se establece por defecto en el esquema, 
        // por lo que no es necesario asignarla aquí.
        // El esquema tiene: createdAt: text("created_at").notNull().default(String(new Date().toISOString()))
        
        // Asegurarse de que active sea un número
        if (storeData.active === undefined) {
          storeData.active = 1;
        }
        
        // Asegurarse de que los campos nulos estén presentes
        if (storeData.district === undefined) storeData.district = null;
        if (storeData.locality === undefined) storeData.locality = null;
        if (storeData.address === undefined) storeData.address = null;
        if (storeData.phone === undefined) storeData.phone = null;
        if (storeData.email === undefined) storeData.email = null;
        if (storeData.cif === undefined) storeData.cif = null;
        if (storeData.businessName === undefined) storeData.businessName = null;
        if (storeData.ownerName === undefined) storeData.ownerName = null;
        if (storeData.ownerIdNumber === undefined) storeData.ownerIdNumber = null;
        if (storeData.startDate === undefined) storeData.startDate = null;
        if (storeData.endDate === undefined) storeData.endDate = null;
        if (storeData.notes === undefined) storeData.notes = null;
        
        const newStore = await storage.createStore(storeData);
        res.status(201).json(newStore);
      } catch (err) {
        console.error("Error al crear tienda:", err);
        next(err);
      }
    });
  });
  
  // Actualizar una tienda existente
  app.put("/api/stores/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const storeData = req.body;
        
        // Verificar si la tienda existe
        const existingStore = await storage.getStore(id);
        if (!existingStore) {
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        const updatedStore = await storage.updateStore(id, storeData);
        res.json(updatedStore);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener actividades de archivo pendientes de asignación de tienda
  app.get("/api/pending-store-assignments", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const activities = await storage.getPendingStoreAssignmentActivities();
        res.json(activities);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener actividades de archivo recientes
  app.get("/api/file-activities", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const activities = await storage.getRecentFileActivities(limit);
        res.json(activities);
      } catch (err) {
        next(err);
      }
    });
  });

  return httpServer;
}

function setupFileUpload() {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      let uploadPath;
      
      // Determinar la carpeta de destino según el tipo de archivo
      if (file.mimetype === 'application/pdf') {
        uploadPath = path.join(process.cwd(), 'uploads', 'pdf');
      } else {
        uploadPath = path.join(process.cwd(), 'uploads', 'excel');
      }
      
      // Asegurarse de que el directorio existe
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      // Generar un nombre único para el archivo
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
    }
  });
  
  return multer({ storage: storage });
}