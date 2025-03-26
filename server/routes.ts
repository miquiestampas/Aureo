import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupSocketIO, initializeFileWatchers, stopFileWatchers } from "./fileWatcher";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processExcelFile, processPdfFile } from "./fileProcessors";
import { InsertSearchHistory } from "@shared/schema";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Create HTTP server for both Express and Socket.IO
  const httpServer = createServer(app);
  
  // Set up Socket.IO
  const io = setupSocketIO(httpServer);
  
  // Set up file upload middleware
  const upload = setupFileUpload();
  const uploadMultiple = setupFileUpload().array('files', 20); // Permitir hasta 20 archivos a la vez
  
  // User routes
  app.get("/api/users", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const users = await storage.getUsers();
        // Remove passwords from response
        const sanitizedUsers = users.map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        });
        
        res.json(sanitizedUsers);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/users", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const { username } = req.body;
        const existingUser = await storage.getUserByUsername(username);
        
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
        
        // Create user with hashed password
        const crypto = require("crypto");
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto.scryptSync(req.body.password, salt, 64).toString("hex");
        const hashedPassword = `${hash}.${salt}`;
        
        const user = await storage.createUser({
          ...req.body,
          password: hashedPassword
        });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const userId = parseInt(req.params.id);
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const updatedUser = await storage.updateUser(userId, req.body);
        
        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update user" });
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const userId = parseInt(req.params.id);
        const success = await storage.deleteUser(userId);
        
        if (!success) {
          return res.status(404).json({ message: "User not found" });
        }
        
        res.sendStatus(204);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Store routes
  app.get("/api/stores", async (req, res, next) => {
    try {
      let stores;
      if (req.query.type) {
        stores = await storage.getStoresByType(req.query.type as 'Excel' | 'PDF');
      } else {
        stores = await storage.getStores();
      }
      res.json(stores);
    } catch (err) {
      next(err);
    }
  });
  
  app.post("/api/stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const { code } = req.body;
        const existingStore = await storage.getStoreByCode(code);
        
        if (existingStore) {
          return res.status(400).json({ message: "Store code already exists" });
        }
        
        const store = await storage.createStore(req.body);
        res.status(201).json(store);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/stores/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const storeId = parseInt(req.params.id);
        const store = await storage.getStore(storeId);
        
        if (!store) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        const updatedStore = await storage.updateStore(storeId, req.body);
        
        if (!updatedStore) {
          return res.status(500).json({ message: "Failed to update store" });
        }
        
        res.json(updatedStore);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/stores/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const storeId = parseInt(req.params.id);
        const success = await storage.deleteStore(storeId);
        
        if (!success) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        res.sendStatus(204);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // System configuration routes
  app.get("/api/config", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const configs = await storage.getAllConfigs();
        res.json(configs);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/config/:key", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const { key } = req.params;
        const { value } = req.body;
        
        if (!value) {
          return res.status(400).json({ message: "Value is required" });
        }
        
        const config = await storage.getConfig(key);
        
        if (!config) {
          // Create new config if it doesn't exist
          const newConfig = await storage.setConfig({ key, value, description: req.body.description });
          return res.json(newConfig);
        }
        
        const updatedConfig = await storage.updateConfig(key, value);
        
        if (!updatedConfig) {
          return res.status(500).json({ message: "Failed to update configuration" });
        }
        
        // Restart file watchers if related configs are changed
        if (
          key === 'EXCEL_WATCH_DIR' ||
          key === 'PDF_WATCH_DIR' || 
          key === 'FILE_PROCESSING_ENABLED'
        ) {
          if (value === 'true') {
            await initializeFileWatchers();
          } else if (key === 'FILE_PROCESSING_ENABLED' && value === 'false') {
            await stopFileWatchers();
          }
        }
        
        res.json(updatedConfig);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // File activity routes
  app.get("/api/file-activities", async (req, res, next) => {
    try {
      let activities;
      if (req.query.storeCode) {
        activities = await storage.getFileActivitiesByStore(req.query.storeCode as string);
      } else {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        activities = await storage.getRecentFileActivities(limit);
      }
      res.json(activities);
    } catch (err) {
      next(err);
    }
  });
  
  // Excel data routes
  app.get("/api/excel-data", async (req, res, next) => {
    try {
      if (!req.query.storeCode) {
        return res.status(400).json({ message: "storeCode query parameter is required" });
      }
      
      const data = await storage.getExcelDataByStore(req.query.storeCode as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });
  
  // Excel search route
  app.get("/api/search/excel-data", async (req, res, next) => {
    try {
      // Extract query parameters
      const searchType = req.query.searchType as string || 'General';
      const searchTerms = req.query.searchTerms as string;
      const storeCode = req.query.storeCode as string;
      
      // Optional date filters
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;
      
      // Optional price filters
      const priceMin = req.query.priceMin as string;
      const priceMax = req.query.priceMax as string;
      
      // Optional flags
      const includeArchived = req.query.includeArchived === 'true';
      
      // Field-specific search flags
      const searchCustomerName = req.query.searchCustomerName !== 'false';
      const searchCustomerContact = req.query.searchCustomerContact !== 'false';
      const searchItemDetails = req.query.searchItemDetails !== 'false';
      const searchMetals = req.query.searchMetals !== 'false';
      const searchStones = req.query.searchStones !== 'false';
      const searchEngravings = req.query.searchEngravings !== 'false';
      
      if (!searchTerms || searchTerms.length < 2) {
        return res.status(400).json({ error: "Los términos de búsqueda deben tener al menos 2 caracteres" });
      }
      
      // Construct filters object
      const filters = {
        storeCode,
        fromDate,
        toDate,
        priceMin,
        priceMax,
        includeArchived,
        searchCustomerName,
        searchCustomerContact,
        searchItemDetails,
        searchMetals,
        searchStones,
        searchEngravings
      };
      
      // Perform the search based on type
      const results = await storage.searchExcelData(searchTerms, filters);
      
      // Add search to history if user is authenticated
      if (req.isAuthenticated()) {
        try {
          const searchEntry: InsertSearchHistory = {
            userId: req.user!.id,
            searchType,
            searchTerms,
            searchDate: new Date(),
            resultCount: results.length,
            filters: JSON.stringify(filters)
          };
          
          await storage.addSearchHistory(searchEntry);
        } catch (historyError) {
          console.error("Error saving search history:", historyError);
          // Don't fail the request if history saving fails
        }
      }
      
      res.json({
        results,
        count: results.length,
        searchType
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Error al realizar la búsqueda" });
    }
  });
  
  // Search history routes
  app.get("/api/search-history", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const history = await storage.getRecentSearches(req.user!.id, limit);
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener historial de búsqueda" });
      next(error);
    }
  });
  
  // Export search results
  app.get("/api/export/excel-search", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      const searchType = req.query.type as string || 'General';
      const searchTerms = req.query.q as string;
      
      if (!searchTerms) {
        return res.status(400).json({ error: "Se requieren términos de búsqueda" });
      }
      
      // Simple implementation - just return the search results as JSON
      // In a real implementation, you would format this as an Excel file
      const results = await storage.searchExcelData(searchTerms, { searchType });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="search-results-${Date.now()}.json"`);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Error al exportar resultados" });
      next(error);
    }
  });
  
  // PDF document routes
  app.get("/api/pdf-documents", async (req, res, next) => {
    try {
      if (!req.query.storeCode) {
        return res.status(400).json({ message: "storeCode query parameter is required" });
      }
      
      const documents = await storage.getPdfDocumentsByStore(req.query.storeCode as string);
      res.json(documents);
    } catch (err) {
      next(err);
    }
  });
  
  // Obtener documento PDF por ID
  app.get("/api/pdf-documents/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getPdfDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Documento PDF no encontrado" });
      }
      
      res.json(document);
    } catch (err) {
      console.error('Error obteniendo documento PDF:', err);
      res.status(500).json({ message: "Error obteniendo documento PDF" });
    }
  });
  
  // Visualizar documento PDF por ID
  app.get("/api/pdf-documents/:id/view", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getPdfDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Documento PDF no encontrado" });
      }
      
      // Verificar si el archivo existe
      const filePath = document.path;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Archivo PDF no encontrado en el servidor" });
      }
      
      // Enviar el archivo PDF
      res.sendFile(path.resolve(filePath));
    } catch (err) {
      console.error('Error obteniendo documento PDF:', err);
      res.status(500).json({ message: "Error obteniendo documento PDF" });
    }
  });
  
  // File upload routes
  // Carga individual de archivos Excel
  app.post("/api/upload/excel", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha cargado ningún archivo" });
      }
      
      // Usamos un código de tienda genérico que será reemplazado automáticamente
      // durante el procesamiento del archivo basado en su contenido
      const defaultStoreCode = "PENDIENTE";
      
      // Create file activity entry
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode: defaultStoreCode,
        fileType: 'Excel',
        status: 'Pending',
        processingDate: new Date(),
        processedBy: 'Carga Manual',
        errorMessage: null,
        metadata: null
      });
      
      // Process the file in the background
      // El código de tienda será determinado automáticamente desde el archivo
      processExcelFile(req.file.path, activity.id, defaultStoreCode)
        .catch(err => console.error("Error al procesar archivo Excel cargado:", err));
      
      res.status(202).json({
        message: "Archivo cargado exitosamente y en cola para procesamiento",
        fileActivity: activity
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Carga masiva de archivos Excel
  app.post("/api/upload/excel/batch", uploadMultiple, async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No se ha cargado ningún archivo" });
      }
      
      // Usamos un código de tienda vacío, el servidor detectará automáticamente la tienda adecuada
      const defaultStoreCode = "";
      const activities = [];
      
      // Procesar cada archivo
      const filePromises = req.files.map(async (file) => {
        try {
          // Crear actividad para cada archivo
          const activity = await storage.createFileActivity({
            filename: file.originalname,
            storeCode: defaultStoreCode, // Se actualizará durante el procesamiento
            fileType: 'Excel',
            status: 'Pending',
            processingDate: new Date(),
            processedBy: 'Carga Masiva',
            errorMessage: null,
            metadata: null
          });
          
          activities.push(activity);
          
          // Procesar archivo en segundo plano - La tienda se detectará automáticamente
          processExcelFile(file.path, activity.id, defaultStoreCode)
            .catch(err => console.error(`Error al procesar archivo ${file.originalname}:`, err));
            
          return { filename: file.originalname, status: 'Encolado' };
        } catch (err) {
          console.error(`Error procesando archivo ${file.originalname}:`, err);
          return { filename: file.originalname, status: 'Error', error: err.message };
        }
      });
      
      // Esperar a que todos los archivos sean procesados
      const results = await Promise.all(filePromises);
      
      res.status(202).json({
        message: `${req.files.length} archivos cargados exitosamente y en cola para procesamiento`,
        files: results,
        activities: activities
      });
    } catch (err) {
      next(err);
    }
  });
  
  app.post("/api/upload/pdf", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Usamos un código de tienda vacío, que será reemplazado automáticamente
      // durante el procesamiento del archivo basado en su nombre
      const defaultStoreCode = "";
      
      // Si se proporciona un código de tienda explícitamente, lo usamos
      const storeCode = req.body.storeCode || defaultStoreCode;
      
      // Create file activity entry
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode,
        fileType: 'PDF',
        status: 'Pending',
        processingDate: new Date(),
        processedBy: 'Carga Manual',
        errorMessage: null,
        metadata: null
      });
      
      // Process the file in the background
      processPdfFile(req.file.path, activity.id, storeCode)
        .catch(err => console.error("Error processing uploaded PDF file:", err));
      
      res.status(202).json({
        message: "File uploaded successfully and queued for processing",
        fileActivity: activity
      });
    } catch (err) {
      next(err);
    }
  });
  
  // Carga masiva de archivos PDF
  app.post("/api/upload/pdf/batch", uploadMultiple, async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No se ha cargado ningún archivo" });
      }
      
      // Usamos un código de tienda vacío, que será reemplazado automáticamente
      // durante el procesamiento del archivo basado en su nombre
      const defaultStoreCode = "";
      // Si se proporciona un código de tienda explícitamente, lo usamos
      const storeCode = req.body.storeCode || defaultStoreCode;
      const activities = [];
      
      // Procesar cada archivo
      const filePromises = req.files.map(async (file) => {
        try {
          // Crear actividad para cada archivo
          const activity = await storage.createFileActivity({
            filename: file.originalname,
            storeCode, // Usamos el código de tienda proporcionado o el predeterminado
            fileType: 'PDF',
            status: 'Pending',
            processingDate: new Date(),
            processedBy: 'Carga Masiva',
            errorMessage: null,
            metadata: null
          });
          
          activities.push(activity);
          
          // Procesar archivo en segundo plano
          processPdfFile(file.path, activity.id, storeCode)
            .catch(err => console.error(`Error al procesar archivo ${file.originalname}:`, err));
            
          return { filename: file.originalname, status: 'Encolado' };
        } catch (err) {
          console.error(`Error procesando archivo ${file.originalname}:`, err);
          return { filename: file.originalname, status: 'Error', error: err.message };
        }
      });
      
      // Esperar a que todos los archivos sean procesados
      const results = await Promise.all(filePromises);
      
      res.status(202).json({
        message: `${req.files.length} archivos PDF cargados exitosamente y en cola para procesamiento`,
        files: results,
        activities: activities
      });
    } catch (err) {
      next(err);
    }
  });
  
  // System status routes
  app.get("/api/system/status", async (req, res) => {
    try {
      // Get system stats
      const [excelStores, pdfStores, recentActivities] = await Promise.all([
        storage.getStoresByType('Excel'),
        storage.getStoresByType('PDF'),
        storage.getRecentFileActivities(50)
      ]);
      
      // Calculate processed today count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const processedToday = recentActivities.filter(activity => {
        const activityDate = new Date(activity.processingDate);
        return activityDate >= today && activity.status === 'Processed';
      }).length;
      
      // Count pending files
      const pendingFiles = recentActivities.filter(activity => 
        activity.status === 'Pending' || activity.status === 'Processing'
      ).length;
      
      // Check if file watchers are enabled
      const fileProcessingConfig = await storage.getConfig('FILE_PROCESSING_ENABLED');
      const fileWatchingActive = fileProcessingConfig?.value === 'true';
      
      res.json({
        totalStores: excelStores.length + pdfStores.length,
        excelStores: excelStores.length,
        pdfStores: pdfStores.length,
        processedToday,
        pendingFiles,
        fileWatchingActive,
        lastSystemCheck: new Date().toISOString(),
        systemLoad: 25 // Placeholder value
      });
    } catch (err) {
      res.status(500).json({ message: "Error fetching system status" });
    }
  });
  
  // Database purge routes (SuperAdmin only)
  app.post("/api/system/purge/stores", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const { password, storeType } = req.body;
        
        // Verify password
        if (!req.user || !await verifyAdminPassword(req.user.id, password)) {
          return res.status(401).json({ message: "Contraseña incorrecta. Operación cancelada." });
        }
        
        let result;
        if (storeType === 'Excel') {
          result = await storage.purgeExcelStores();
        } else if (storeType === 'PDF') {
          result = await storage.purgePdfStores();
        } else {
          result = await storage.purgeAllStores();
        }
        
        res.json({ 
          message: `Tiendas de tipo ${storeType || 'todas'} eliminadas correctamente`, 
          count: result.count 
        });
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/system/purge/data", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const { password, dataType, fromDate, toDate } = req.body;
        
        // Verify password
        if (!req.user || !await verifyAdminPassword(req.user.id, password)) {
          return res.status(401).json({ message: "Contraseña incorrecta. Operación cancelada." });
        }
        
        let result;
        let dateRange = null;
        
        if (fromDate || toDate) {
          dateRange = {
            from: fromDate ? new Date(fromDate) : null,
            to: toDate ? new Date(toDate) : null
          };
        }
        
        if (dataType === 'Excel') {
          result = await storage.purgeExcelData(dateRange);
        } else if (dataType === 'PDF') {
          result = await storage.purgePdfData(dateRange);
        } else if (dataType === 'Activities') {
          result = await storage.purgeFileActivities(dateRange);
        } else if (dataType === 'All') {
          result = await storage.purgeAllData(dateRange);
        } else {
          return res.status(400).json({ message: "Tipo de datos no válido" });
        }
        
        res.json({ 
          message: `Datos de tipo ${dataType} eliminados correctamente`, 
          count: result.count 
        });
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/system/purge/all", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const { password, confirmation } = req.body;
        
        // Require a special confirmation phrase
        if (confirmation !== "CONFIRMAR-ELIMINAR-TODO") {
          return res.status(400).json({ message: "Frase de confirmación incorrecta. Operación cancelada." });
        }
        
        // Verify password
        if (!req.user || !await verifyAdminPassword(req.user.id, password)) {
          return res.status(401).json({ message: "Contraseña incorrecta. Operación cancelada." });
        }
        
        const result = await storage.purgeEntireDatabase();
        
        res.json({ 
          message: "Base de datos eliminada completamente", 
          tablesAffected: result.tablesAffected 
        });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Helper function to verify admin password
  async function verifyAdminPassword(userId: number, password: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return false;
      
      // Comparar contraseñas manualmente ya que no podemos usar require
      const [hashed, salt] = user.password.split(".");
      const crypto = await import('crypto');
      const hashedBuffer = Buffer.from(hashed, "hex");
      const suppliedBuffer = crypto.scryptSync(password, salt, 64) as Buffer;
      return crypto.timingSafeEqual(hashedBuffer, suppliedBuffer);
    } catch (err) {
      console.error("Error verifying admin password:", err);
      return false;
    }
  }
  
  // Start file watchers
  app.post("/api/system/start-watchers", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Update config
        await storage.updateConfig('FILE_PROCESSING_ENABLED', 'true');
        
        // Initialize watchers
        await initializeFileWatchers();
        
        res.json({ message: "File watchers started successfully" });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Stop file watchers
  app.post("/api/system/stop-watchers", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Update config
        await storage.updateConfig('FILE_PROCESSING_ENABLED', 'false');
        
        // Stop watchers
        await stopFileWatchers();
        
        res.json({ message: "File watchers stopped successfully" });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Watchlist Person routes
  app.get("/api/watchlist/persons", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === 'true';
        const persons = await storage.getWatchlistPersons(includeInactive);
        res.json(persons);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/watchlist/persons/search", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
          return res.status(400).json({ message: "Se requiere parámetro de búsqueda" });
        }
        
        // Registrar la búsqueda en el historial
        await storage.addSearchHistory({
          userId: req.user!.id,
          searchType: "Cliente",
          searchTerms: query,
          resultCount: 0 // Se actualizará después
        });
        
        const results = await storage.searchWatchlistPersons(query);
        
        // Actualizar el recuento de resultados
        // En un sistema de producción, consideraríamos si vale la pena esta segunda llamada
        // o si podríamos usar una cola de trabajos para actualizar el recuento de forma asíncrona
        
        res.json(results);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/watchlist/persons", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Añadir createdBy al objeto
        const personData = {
          ...req.body,
          createdBy: req.user!.id
        };
        
        const person = await storage.createWatchlistPerson(personData);
        res.status(201).json(person);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/watchlist/persons/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const person = await storage.getWatchlistPerson(id);
        if (!person) {
          return res.status(404).json({ message: "Persona no encontrada" });
        }
        
        res.json(person);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.patch("/api/watchlist/persons/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const updatedPerson = await storage.updateWatchlistPerson(id, req.body);
        if (!updatedPerson) {
          return res.status(404).json({ message: "Persona no encontrada" });
        }
        
        res.json(updatedPerson);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/watchlist/persons/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const success = await storage.deleteWatchlistPerson(id);
        if (!success) {
          return res.status(404).json({ message: "Persona no encontrada" });
        }
        
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Watchlist Item routes
  app.get("/api/watchlist/items", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === 'true';
        const items = await storage.getWatchlistItems(includeInactive);
        res.json(items);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/watchlist/items/search", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
          return res.status(400).json({ message: "Se requiere parámetro de búsqueda" });
        }
        
        // Registrar la búsqueda en el historial
        await storage.addSearchHistory({
          userId: req.user!.id,
          searchType: "Artículo",
          searchTerms: query,
          resultCount: 0 // Se actualizará después
        });
        
        const results = await storage.searchWatchlistItems(query);
        
        res.json(results);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/watchlist/items", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Añadir createdBy al objeto
        const itemData = {
          ...req.body,
          createdBy: req.user!.id
        };
        
        const item = await storage.createWatchlistItem(itemData);
        res.status(201).json(item);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/watchlist/items/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const item = await storage.getWatchlistItem(id);
        if (!item) {
          return res.status(404).json({ message: "Artículo no encontrado" });
        }
        
        res.json(item);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.patch("/api/watchlist/items/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const updatedItem = await storage.updateWatchlistItem(id, req.body);
        if (!updatedItem) {
          return res.status(404).json({ message: "Artículo no encontrado" });
        }
        
        res.json(updatedItem);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/watchlist/items/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const success = await storage.deleteWatchlistItem(id);
        if (!success) {
          return res.status(404).json({ message: "Artículo no encontrado" });
        }
        
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Alert routes
  app.get("/api/alerts", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        
        const alerts = await storage.getAlerts(status, limit);
        res.json(alerts);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/alerts/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const alert = await storage.getAlert(id);
        if (!alert) {
          return res.status(404).json({ message: "Alerta no encontrada" });
        }
        
        res.json(alert);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/alerts", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Añadir createdBy al objeto
        const alertData = {
          ...req.body,
          createdBy: req.user!.id
        };
        
        const alert = await storage.createAlert(alertData);
        res.status(201).json(alert);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.patch("/api/alerts/:id/status", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const { status, notes } = req.body;
        if (!status) {
          return res.status(400).json({ message: "Se requiere estado" });
        }
        
        const updatedAlert = await storage.updateAlertStatus(id, status, req.user!.id, notes);
        if (!updatedAlert) {
          return res.status(404).json({ message: "Alerta no encontrada" });
        }
        
        res.json(updatedAlert);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/alerts/excel/:excelDataId", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const excelDataId = parseInt(req.params.excelDataId);
        if (isNaN(excelDataId)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        
        const alerts = await storage.getAlertsByExcelDataId(excelDataId);
        res.json(alerts);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Search History routes
  app.get("/api/search-history", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        
        const searchHistory = await storage.getRecentSearches(req.user!.id, limit);
        res.json(searchHistory);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Initialize file watchers on startup
  initializeFileWatchers().catch(err => 
    console.error("Error initializing file watchers on startup:", err)
  );
  
  return httpServer;
}

// Helper function to set up multer for file uploads
function setupFileUpload() {
  // Create upload directories
  const uploadDir = path.join(process.cwd(), 'uploads');
  const excelDir = path.join(uploadDir, 'excel');
  const pdfDir = path.join(uploadDir, 'pdf');
  
  [uploadDir, excelDir, pdfDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Configure storage
  const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      // Determine destination based on file type
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, excelDir);
      } else if (file.mimetype === 'application/pdf') {
        cb(null, pdfDir);
      } else {
        cb(new Error('Unsupported file type'), '');
      }
    },
    filename: function(req, file, cb) {
      // Mantener el nombre original pero añadir fecha para evitar conflictos
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Obtener nombre y extensión
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      
      // Generar el nuevo nombre: original_fecha.extensión
      cb(null, `${nameWithoutExt}_${timestamp}${ext}`);
    }
  });
  
  // Configure upload limits
  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: function(req, file, cb) {
      // Accept Excel, CSV and PDF files
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.mimetype === 'text/plain' ||  // Para archivos CSV guardados como TXT
          file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos Excel, CSV y PDF'), false);
      }
    }
  });
}
