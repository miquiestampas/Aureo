import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, ROLES } from "./auth";
import { storage } from "./storage";
import { setupSocketIO, initializeFileWatchers, stopFileWatchers } from "./fileWatcher";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import XLSX from "xlsx";
import { processExcelFile, processPdfFile } from "./fileProcessors";
import { 
  InsertSearchHistory, User, 
  InsertSenalPersona, SenalPersona, 
  InsertSenalObjeto, SenalObjeto,
  InsertCoincidencia, Coincidencia
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

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
      fileSize: 50 * 1024 * 1024, // Incrementado a 50MB tamaño máximo
      fieldSize: 50 * 1024 * 1024 // También incrementamos el tamaño de campo para formularios grandes
    },
    fileFilter: function(req, file, cb) {
      console.log("Procesando archivo:", file.originalname, "Mimetype:", file.mimetype);
      
      // Accept Excel, CSV and PDF files with more tipos MIME
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.mimetype === 'text/plain' ||  // Para archivos CSV guardados como TXT
          file.mimetype === 'application/pdf' ||
          // Aceptar otros mimetype comunes para Excel
          file.mimetype === 'application/octet-stream' ||
          /excel|spreadsheet/i.test(file.mimetype)) {
        cb(null, true);
      } else {
        console.log("Tipo de archivo no permitido:", file.mimetype);
        cb(new Error(`Solo se permiten archivos Excel, CSV y PDF. Tipo recibido: ${file.mimetype}`), false);
      }
    }
  });
}

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
        // Check if user already exists
        const existingUser = await storage.getUserByUsername(req.body.username);
        if (existingUser) {
          return res.status(400).json({ error: "Ya existe un usuario con ese nombre de usuario" });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        
        // Create new user with hashed password
        const newUser = await storage.createUser({
          ...req.body,
          password: hashedPassword
        });
        
        // Remove password from response
        const { password, ...userWithoutPassword } = newUser;
        
        res.status(201).json(userWithoutPassword);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const user = await storage.getUser(parseInt(req.params.id));
        if (!user) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        res.json(userWithoutPassword);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        // Check if user exists
        const user = await storage.getUser(parseInt(req.params.id));
        if (!user) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Prepare update data
        const updateData: Partial<User> = { ...req.body };
        delete updateData.id; // Can't update ID
        
        // Hash password if it's being updated
        if (updateData.password) {
          const salt = await bcrypt.genSalt(10);
          updateData.password = await bcrypt.hash(updateData.password, salt);
        }
        
        // Update user
        const updatedUser = await storage.updateUser(parseInt(req.params.id), updateData);
        
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
        // Check if user exists
        const user = await storage.getUser(parseInt(req.params.id));
        if (!user) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Don't allow deleting the SuperAdmin with ID 1
        if (user.id === 1) {
          return res.status(403).json({ error: "No se puede eliminar el usuario SuperAdmin principal" });
        }
        
        // Delete user
        await storage.deleteUser(parseInt(req.params.id));
        
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Change password route with admin verification
  app.post("/api/users/:id/change-password", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const userId = parseInt(req.params.id);
        const { currentPassword, newPassword } = req.body;
        
        // Verify if current admin password is correct
        if (!(await verifyAdminPassword(req.user.id, currentPassword))) {
          return res.status(403).json({ error: "Contraseña de administrador incorrecta" });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update user's password
        await storage.updateUserPassword(userId, hashedPassword);
        
        res.json({ success: true, message: "Contraseña actualizada correctamente" });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Excel data routes
  app.get("/api/excel-data", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        let { page = "1", limit = "10", ...filters } = req.query;
        
        // Convert to numbers
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        
        // Get excel data with pagination
        const result = await storage.getExcelDataPaginated(pageNum, limitNum, filters);
        
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/excel-data/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const excelData = await storage.getExcelData(parseInt(req.params.id));
        if (!excelData) {
          return res.status(404).json({ error: "Datos Excel no encontrados" });
        }
        
        res.json(excelData);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Excel file upload route
  app.post("/api/upload/excel", upload.single('file'), (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No se ha subido ningún archivo" });
        }
        
        const filePath = req.file.path;
        const activityId = parseInt(req.body.activityId || "0");
        const storeCode = req.body.storeCode || "";
        
        // Process Excel file and save data to storage
        const processedData = await processExcelFile(filePath, activityId, storeCode);
        
        res.json({
          success: true,
          message: "Archivo Excel procesado correctamente",
          data: processedData
        });
      } catch (err) {
        console.error("Error processing Excel file:", err);
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path); // Delete file on error
          } catch (e) {
            console.error("Error deleting file:", e);
          }
        }
        next(err);
      }
    });
  });
  
  // Excel file search route
  app.post("/api/excel-data/search", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const { 
          searchTerm, 
          filters = {}, 
          page = 1, 
          limit = 10,
          sortField = 'fechaCompra',
          sortOrder = 'desc'
        } = req.body;
        
        console.log("Search request:", { searchTerm, filters, page, limit, sortField, sortOrder });
        
        // Add search term to search history if provided
        if (searchTerm && searchTerm.trim().length > 0) {
          const searchEntry: InsertSearchHistory = {
            userId: req.user.id,
            searchTerm: searchTerm.trim(),
            searchDate: new Date(),
          };
          
          await storage.addSearchHistory(searchEntry);
        }
        
        // Perform search with pagination and sorting
        const results = await storage.searchExcelData(
          searchTerm, 
          filters, 
          page, 
          limit, 
          sortField, 
          sortOrder
        );
        
        res.json(results);
      } catch (err) {
        console.error("Search error:", err);
        next(err);
      }
    });
  });
  
  // PDF file routes
  app.get("/api/pdf-documents", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        let { page = "1", limit = "10", ...filters } = req.query;
        
        // Convert to numbers
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        
        // Get PDF documents with pagination
        const result = await storage.getPdfDocumentsPaginated(pageNum, limitNum, filters);
        
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/pdf-documents/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const pdfDocument = await storage.getPdfDocument(parseInt(req.params.id));
        if (!pdfDocument) {
          return res.status(404).json({ error: "Documento PDF no encontrado" });
        }
        
        res.json(pdfDocument);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // PDF file download route
  app.get("/api/pdf-documents/:id/download", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const pdfDocument = await storage.getPdfDocument(parseInt(req.params.id));
        if (!pdfDocument || !pdfDocument.filePath) {
          return res.status(404).json({ error: "Documento PDF no encontrado" });
        }
        
        const filePath = pdfDocument.filePath;
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "Archivo PDF no encontrado en el servidor" });
        }
        
        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfDocument.fileName}"`);
        
        // Stream file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // PDF file upload route
  app.post("/api/upload/pdf", upload.single('file'), (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No se ha subido ningún archivo" });
        }
        
        const filePath = req.file.path;
        const activityId = parseInt(req.body.activityId || "0");
        const storeCode = req.body.storeCode || "";
        
        // Process PDF file and save data to storage
        const processedData = await processPdfFile(filePath, activityId, storeCode);
        
        res.json({
          success: true,
          message: "Archivo PDF procesado correctamente",
          data: processedData
        });
      } catch (err) {
        console.error("Error processing PDF file:", err);
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path); // Delete file on error
          } catch (e) {
            console.error("Error deleting file:", e);
          }
        }
        next(err);
      }
    });
  });
  
  // Multiple PDF files upload route
  app.post("/api/upload/pdfs", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      uploadMultiple(req, res, async (err) => {
        if (err) {
          console.error("Error uploading multiple files:", err);
          return res.status(400).json({ error: err.message });
        }
        
        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
          return res.status(400).json({ error: "No se han subido archivos" });
        }
        
        const files = req.files as Express.Multer.File[];
        const activityId = parseInt(req.body.activityId || "0");
        const storeCode = req.body.storeCode || "";
        
        try {
          // Process each PDF file
          const results = [];
          const errors = [];
          
          for (const file of files) {
            try {
              const processedData = await processPdfFile(file.path, activityId, storeCode);
              results.push({
                fileName: file.originalname,
                success: true,
                data: processedData
              });
            } catch (fileErr) {
              console.error(`Error processing file ${file.originalname}:`, fileErr);
              errors.push({
                fileName: file.originalname,
                error: fileErr.message
              });
              
              // Delete file on error
              if (fs.existsSync(file.path)) {
                try {
                  fs.unlinkSync(file.path);
                } catch (e) {
                  console.error("Error deleting file:", e);
                }
              }
            }
          }
          
          res.json({
            success: true,
            message: `Procesados ${results.length} archivos PDF con éxito, ${errors.length} con errores`,
            results,
            errors
          });
        } catch (err) {
          console.error("Error processing PDF files:", err);
          next(err);
        }
      });
    });
  });
  
  // Store and activity routes for dropdown lists
  app.get("/api/stores", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const stores = await storage.getStores();
        res.json(stores);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/activities", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const activities = await storage.getActivities();
        res.json(activities);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // File watcher status route
  app.get("/api/watcher/status", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const status = await storage.getWatcherStatus();
        res.json(status);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Toggle file watcher route
  app.post("/api/watcher/toggle", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const { active } = req.body;
        
        if (active) {
          await initializeFileWatchers();
        } else {
          await stopFileWatchers();
        }
        
        await storage.updateWatcherStatus(active);
        
        res.json({ success: true, active });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Search history routes
  app.get("/api/search-history", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const userId = req.user.id;
        const searchHistory = await storage.getUserSearchHistory(userId);
        res.json(searchHistory);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/search-history/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const searchId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check if search belongs to user
        const search = await storage.getSearchHistory(searchId);
        if (!search || search.userId !== userId) {
          return res.status(403).json({ error: "No tienes permiso para eliminar esta búsqueda" });
        }
        
        await storage.deleteSearchHistory(searchId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/search-history", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const userId = req.user.id;
        await storage.clearUserSearchHistory(userId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // System status route
  app.get("/api/system/status", (req, res) => {
    const status = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      hostname: os.hostname(),
      memory: {
        free: os.freemem(),
        total: os.totalmem()
      },
      cpu: os.cpus(),
      network: os.networkInterfaces()
    };
    
    res.json(status);
  });
  
  // Storage stats route
  app.get("/api/system/storage-stats", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const stats = await storage.getStorageStats();
        res.json(stats);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Señalamiento de personas routes
  app.get("/api/senalamiento/personas", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        let { page = "1", limit = "10", ...filters } = req.query;
        
        // Convert to numbers
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        
        // Get señalamiento personas with pagination
        const result = await storage.getSenalPersonasPaginated(pageNum, limitNum, filters);
        
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/senalamiento/personas", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const senalPersona: InsertSenalPersona = {
          ...req.body,
          createdAt: new Date(),
          createdBy: req.user.id
        };
        
        const created = await storage.createSenalPersona(senalPersona);
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const senalPersona = await storage.getSenalPersona(id);
        
        if (!senalPersona) {
          return res.status(404).json({ error: "Señalamiento de persona no encontrado" });
        }
        
        res.json(senalPersona);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const updateData = {
          ...req.body,
          updatedAt: new Date(),
          updatedBy: req.user.id
        };
        
        const updated = await storage.updateSenalPersona(id, updateData);
        
        if (!updated) {
          return res.status(404).json({ error: "Señalamiento de persona no encontrado" });
        }
        
        res.json(updated);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteSenalPersona(id);
        
        if (!deleted) {
          return res.status(404).json({ error: "Señalamiento de persona no encontrado" });
        }
        
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Señalamiento de objetos routes
  app.get("/api/senalamiento/objetos", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        let { page = "1", limit = "10", ...filters } = req.query;
        
        // Convert to numbers
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        
        // Get señalamiento objetos with pagination
        const result = await storage.getSenalObjetosPaginated(pageNum, limitNum, filters);
        
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/senalamiento/objetos", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const senalObjeto: InsertSenalObjeto = {
          ...req.body,
          createdAt: new Date(),
          createdBy: req.user.id
        };
        
        const created = await storage.createSenalObjeto(senalObjeto);
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const senalObjeto = await storage.getSenalObjeto(id);
        
        if (!senalObjeto) {
          return res.status(404).json({ error: "Señalamiento de objeto no encontrado" });
        }
        
        res.json(senalObjeto);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.put("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const updateData = {
          ...req.body,
          updatedAt: new Date(),
          updatedBy: req.user.id
        };
        
        const updated = await storage.updateSenalObjeto(id, updateData);
        
        if (!updated) {
          return res.status(404).json({ error: "Señalamiento de objeto no encontrado" });
        }
        
        res.json(updated);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.delete("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteSenalObjeto(id);
        
        if (!deleted) {
          return res.status(404).json({ error: "Señalamiento de objeto no encontrado" });
        }
        
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Coincidencias routes
  app.get("/api/coincidencias", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        let { page = "1", limit = "10", ...filters } = req.query;
        
        // Convert to numbers
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        
        // Get coincidencias with pagination
        const result = await storage.getCoincidenciasPaginated(pageNum, limitNum, filters);
        
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/coincidencias/:id", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const coincidencia = await storage.getCoincidencia(id);
        
        if (!coincidencia) {
          return res.status(404).json({ error: "Coincidencia no encontrada" });
        }
        
        res.json(coincidencia);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.get("/api/excel-data/:excelDataId/coincidencias", (req, res, next) => {
    req.authorize(["User", "Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const excelDataId = parseInt(req.params.excelDataId);
        const coincidencias = await storage.getCoincidenciasByExcelDataId(excelDataId);
        
        res.json(coincidencias);
      } catch (err) {
        next(err);
      }
    });
  });
  
  app.post("/api/excel-data/:excelDataId/detectar-coincidencias", (req, res, next) => {
    req.authorize(["Admin", "SuperAdmin"])(req, res, async () => {
      try {
        const excelDataId = parseInt(req.params.excelDataId);
        
        // Get the excel data record
        const excelData = await storage.getExcelData(excelDataId);
        if (!excelData) {
          return res.status(404).json({ error: "Datos Excel no encontrados" });
        }
        
        // Detect coincidencias for this excel data
        await storage.detectCoincidencias(excelDataId);
        
        res.json({ success: true, message: "Detección de coincidencias ejecutada correctamente" });
      } catch (error) {
        console.error(`Error al detectar coincidencias para excelDataId ${req.params.excelDataId}:`, error);
        next(error);
      }
    });
  });
  
  // Initialize file watchers on startup
  initializeFileWatchers().catch(err => 
    console.error("Error initializing file watchers on startup:", err)
  );
  
  return httpServer;
}

// Helper function to verify admin password
async function verifyAdminPassword(userId: number, password: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;
  
  return await bcrypt.compare(password, user.password);
}