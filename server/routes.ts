import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupSocketIO, initializeFileWatchers, stopFileWatchers } from "./fileWatcher";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processExcelFile, processPdfFile } from "./fileProcessors";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Create HTTP server for both Express and Socket.IO
  const httpServer = createServer(app);
  
  // Set up Socket.IO
  const io = setupSocketIO(httpServer);
  
  // Set up file upload middleware
  const upload = setupFileUpload();
  
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
  
  // File upload routes
  app.post("/api/upload/excel", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const storeCode = req.body.storeCode;
      if (!storeCode) {
        return res.status(400).json({ message: "Store code is required" });
      }
      
      // Create file activity entry
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode,
        fileType: 'Excel',
        status: 'Pending',
        processingDate: new Date(),
        processedBy: 'Manual Upload',
        errorMessage: null,
        metadata: null
      });
      
      // Process the file in the background
      processExcelFile(req.file.path, activity.id, storeCode)
        .catch(err => console.error("Error processing uploaded Excel file:", err));
      
      res.status(202).json({
        message: "File uploaded successfully and queued for processing",
        fileActivity: activity
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
      
      const storeCode = req.body.storeCode;
      if (!storeCode) {
        return res.status(400).json({ message: "Store code is required" });
      }
      
      // Create file activity entry
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode,
        fileType: 'PDF',
        status: 'Pending',
        processingDate: new Date(),
        processedBy: 'Manual Upload',
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
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const storeCode = req.body.storeCode || 'UNKNOWN';
      cb(null, `${storeCode}_${uniqueSuffix}_${file.originalname}`);
    }
  });
  
  // Configure upload limits
  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: function(req, file, cb) {
      // Accept only Excel and PDF files
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel and PDF files are allowed'), false);
      }
    }
  });
}
