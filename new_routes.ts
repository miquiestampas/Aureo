import { Express, Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { createServer, type Server } from "http";
import { User, InsertUser, Activity, ActivityStatus, Store, StoreStatus, 
  InsertStore, District, InsertDistrict, Locality, InsertLocality, 
  ExcelData, InsertExcelData, SearchRequest, SearchFilters, 
  InsertSearchHistory, PdfDocument, StoreReportData, SenalPersona, 
  InsertSenalPersona, SenalObjeto, InsertSenalObjeto } from "@shared/schema";
import { initializeFileWatchers, setupSocketIO, stopFileWatchers } from "./fileWatcher";
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
  
  // Rutas de la API
  
  // Ruta para obtener el estado del servidor
  app.get("/api/system/status", (req, res) => {
    res.json({
      status: "online",
      version: "1.0.0",
      message: "Áureo API funcionando correctamente"
    });
  });
  
  // Rutas de usuarios
  
  // Obtener usuarios (solo SuperAdmin)
  app.get("/api/users", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const users = await storage.getUsers();
        res.json(users);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener un usuario específico por ID
  app.get("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const user = await storage.getUser(id);
        
        if (!user) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.json(user);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Crear un nuevo usuario (solo SuperAdmin)
  app.post("/api/users", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const userData: InsertUser = req.body;
        
        // Verificar si el usuario ya existe
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
          return res.status(400).json({ error: "El nombre de usuario ya existe" });
        }
        
        const newUser = await storage.createUser(userData);
        res.status(201).json(newUser);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Actualizar un usuario existente (solo SuperAdmin)
  app.put("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const userData = req.body;
        
        // Verificar si el usuario existe
        const existingUser = await storage.getUser(id);
        if (!existingUser) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Verificar si el nombre de usuario está siendo cambiado y ya existe
        if (userData.username && userData.username !== existingUser.username) {
          const userWithUsername = await storage.getUserByUsername(userData.username);
          if (userWithUsername) {
            return res.status(400).json({ error: "El nombre de usuario ya existe" });
          }
        }
        
        const updatedUser = await storage.updateUser(id, userData);
        res.json(updatedUser);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Eliminar un usuario (solo SuperAdmin)
  app.delete("/api/users/:id", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        
        // Verificar si el usuario existe
        const existingUser = await storage.getUser(id);
        if (!existingUser) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // No permitir eliminar al SuperAdmin original
        if (id === 1) {
          return res.status(403).json({ error: "No se puede eliminar al SuperAdmin original" });
        }
        
        await storage.deleteUser(id);
        res.status(200).json({ message: "Usuario eliminado correctamente" });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Ruta para cambiar la contraseña del usuario
  app.post("/api/users/change-password", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: "Se requiere la contraseña actual y la nueva" });
        }
        
        // Verificar la contraseña actual
        const passwordVerified = await verifyAdminPassword(req.user!.id, currentPassword);
        if (!passwordVerified) {
          return res.status(400).json({ error: "La contraseña actual es incorrecta" });
        }
        
        // Cambiar la contraseña
        await storage.changeUserPassword(req.user!.id, newPassword);
        
        res.json({ success: true, message: "Contraseña cambiada correctamente" });
      } catch (error) {
        console.error("Error al cambiar la contraseña:", error);
        next(error);
      }
    });
  });
  
  // Rutas para activities (operativos)
  
  // Obtener todos los operativos
  app.get("/api/activities", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const activities = await storage.getActivities();
        res.json(activities);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener un operativo específico por ID
  app.get("/api/activities/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const activity = await storage.getActivity(id);
        
        if (!activity) {
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        res.json(activity);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Crear un nuevo operativo
  app.post("/api/activities", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const activityData = req.body;
        const newActivity = await storage.createActivity(activityData);
        res.status(201).json(newActivity);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Actualizar un operativo existente
  app.put("/api/activities/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const activityData = req.body;
        
        // Verificar si el operativo existe
        const existingActivity = await storage.getActivity(id);
        if (!existingActivity) {
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        const updatedActivity = await storage.updateActivity(id, activityData);
        res.json(updatedActivity);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Cambiar el estado de un operativo
  app.put("/api/activities/:id/status", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        
        if (!status || !Object.values(ActivityStatus).includes(status)) {
          return res.status(400).json({ error: "Estado no válido" });
        }
        
        // Verificar si el operativo existe
        const existingActivity = await storage.getActivity(id);
        if (!existingActivity) {
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        const updatedActivity = await storage.updateActivityStatus(id, status);
        res.json(updatedActivity);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Eliminar un operativo
  app.delete("/api/activities/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        
        // Verificar si el operativo existe
        const existingActivity = await storage.getActivity(id);
        if (!existingActivity) {
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        await storage.deleteActivity(id);
        res.status(200).json({ message: "Operativo eliminado correctamente" });
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Rutas para stores (tiendas)
  
  // Obtener todas las tiendas
  app.get("/api/stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === "true";
        const stores = await storage.getStores(includeInactive);
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
        
        const newStore = await storage.createStore(storeData);
        res.status(201).json(newStore);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Actualizar una tienda existente
  app.put("/api/stores/:code", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const code = req.params.code;
        const storeData = req.body;
        
        // Verificar si la tienda existe
        const existingStore = await storage.getStoreByCode(code);
        if (!existingStore) {
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        const updatedStore = await storage.updateStore(code, storeData);
        res.json(updatedStore);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Cambiar el estado de una tienda
  app.put("/api/stores/:code/status", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const code = req.params.code;
        const { status } = req.body;
        
        if (!status || !Object.values(StoreStatus).includes(status)) {
          return res.status(400).json({ error: "Estado no válido" });
        }
        
        // Verificar si la tienda existe
        const existingStore = await storage.getStoreByCode(code);
        if (!existingStore) {
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        const updatedStore = await storage.updateStoreStatus(code, status);
        res.json(updatedStore);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Rutas para distritos
  
  // Obtener todos los distritos
  app.get("/api/districts", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === "true";
        const districts = await storage.getDistricts(includeInactive);
        res.json(districts);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener un distrito específico por ID
  app.get("/api/districts/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const district = await storage.getDistrict(id);
        
        if (!district) {
          return res.status(404).json({ error: "Distrito no encontrado" });
        }
        
        res.json(district);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Crear un nuevo distrito
  app.post("/api/districts", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const districtData: InsertDistrict = req.body;
        
        // Verificar si el distrito ya existe
        const existingDistrict = await storage.getDistrictByName(districtData.name);
        if (existingDistrict) {
          return res.status(400).json({ error: "El nombre de distrito ya existe" });
        }
        
        const newDistrict = await storage.createDistrict(districtData);
        res.status(201).json(newDistrict);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Actualizar un distrito existente
  app.put("/api/districts/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const districtData = req.body;
        
        // Verificar si el distrito existe
        const existingDistrict = await storage.getDistrict(id);
        if (!existingDistrict) {
          return res.status(404).json({ error: "Distrito no encontrado" });
        }
        
        // Verificar si el nombre está siendo cambiado y ya existe
        if (districtData.name && districtData.name !== existingDistrict.name) {
          const districtWithName = await storage.getDistrictByName(districtData.name);
          if (districtWithName) {
            return res.status(400).json({ error: "El nombre de distrito ya existe" });
          }
        }
        
        const updatedDistrict = await storage.updateDistrict(id, districtData);
        res.json(updatedDistrict);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Rutas para localidades
  
  // Obtener todas las localidades
  app.get("/api/localities", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const includeInactive = req.query.includeInactive === "true";
        const districtId = req.query.districtId ? parseInt(req.query.districtId as string) : undefined;
        
        const localities = await storage.getLocalities(includeInactive, districtId);
        res.json(localities);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Obtener una localidad específica por ID
  app.get("/api/localities/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const locality = await storage.getLocality(id);
        
        if (!locality) {
          return res.status(404).json({ error: "Localidad no encontrada" });
        }
        
        res.json(locality);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Crear una nueva localidad
  app.post("/api/localities", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const localityData: InsertLocality = req.body;
        
        // Verificar si la localidad ya existe
        const existingLocality = await storage.getLocalityByName(localityData.name, localityData.districtId);
        if (existingLocality) {
          return res.status(400).json({ error: "El nombre de localidad ya existe en este distrito" });
        }
        
        // Verificar si el distrito existe
        const district = await storage.getDistrict(localityData.districtId);
        if (!district) {
          return res.status(400).json({ error: "El distrito seleccionado no existe" });
        }
        
        const newLocality = await storage.createLocality(localityData);
        res.status(201).json(newLocality);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Actualizar una localidad existente
  app.put("/api/localities/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const localityData = req.body;
        
        // Verificar si la localidad existe
        const existingLocality = await storage.getLocality(id);
        if (!existingLocality) {
          return res.status(404).json({ error: "Localidad no encontrada" });
        }
        
        // Verificar si el nombre está siendo cambiado y ya existe en el mismo distrito
        if (localityData.name && 
            (localityData.name !== existingLocality.name || 
             (localityData.districtId && localityData.districtId !== existingLocality.districtId))) {
          
          const districtId = localityData.districtId || existingLocality.districtId;
          const localityWithName = await storage.getLocalityByName(localityData.name, districtId);
          
          if (localityWithName && localityWithName.id !== id) {
            return res.status(400).json({ error: "El nombre de localidad ya existe en este distrito" });
          }
        }
        
        // Verificar si el distrito existe si se está cambiando
        if (localityData.districtId && localityData.districtId !== existingLocality.districtId) {
          const district = await storage.getDistrict(localityData.districtId);
          if (!district) {
            return res.status(400).json({ error: "El distrito seleccionado no existe" });
          }
        }
        
        const updatedLocality = await storage.updateLocality(id, localityData);
        res.json(updatedLocality);
      } catch (err) {
        next(err);
      }
    });
  });
  
  // Rutas para datos Excel
  
  // Obtener datos de Excel con filtros
  app.get("/api/excel-data", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        // Obtener parámetros de consulta para la paginación y filtrado
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const storeCode = req.query.storeCode as string || undefined;
        const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
        const personName = req.query.personName as string || undefined;
        const productName = req.query.productName as string || undefined;
        const dateRange = req.query.dateRange ? 
          JSON.parse(req.query.dateRange as string) as { from: string | null, to: string | null } : undefined;
        
        // Crear objeto de filtros
        const filters: SearchFilters = {
          storeCode,
          activityId,
          personName,
          productName,
          dateRange
        };
        
        // Obtener datos paginados según los filtros
        const result = await storage.searchExcelData({
          page,
          limit,
          filters
        });
        
        // Si se está realizando una búsqueda con criterios específicos, registrarla
        if (personName || productName) {
          // Crear una entrada en el historial de búsqueda
          const searchEntry: InsertSearchHistory = {
            userId: req.user!.id,
            searchType: "ExcelData",
            searchTerms: `${personName || ''} ${productName || ''}`.trim(),
            resultCount: result.totalItems
          };
          
          await storage.addSearchHistory(searchEntry);
        }
        
        res.json(result);
      } catch (error) {
        console.error("Error al obtener datos de Excel:", error);
        next(error);
      }
    });
  });
  
  // Obtener un dato de Excel específico por ID
  app.get("/api/excel-data/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const excelData = await storage.getExcelDataWithDetails(id);
        
        if (!excelData) {
          return res.status(404).json({ error: "Registro no encontrado" });
        }
        
        res.json(excelData);
      } catch (error) {
        console.error(`Error al obtener datos de Excel con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  // Ruta para cargar archivo Excel
  app.post("/api/upload/excel", upload.single("file"), (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No se proporcionó ningún archivo" });
        }
        
        const activityId = parseInt(req.body.activityId);
        const storeCode = req.body.storeCode;
        
        if (isNaN(activityId) || !storeCode) {
          // Eliminar el archivo si los parámetros son incorrectos
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Se requiere un ID de operativo válido y un código de tienda" });
        }
        
        // Verificar si el operativo existe
        const activity = await storage.getActivity(activityId);
        if (!activity) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        // Verificar si la tienda existe
        const store = await storage.getStoreByCode(storeCode);
        if (!store) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        // Procesar el archivo en segundo plano
        res.status(202).json({ 
          message: "Archivo recibido. Procesando...",
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size
        });
        
        // Procesar el archivo (esto se ejecutará después de enviar la respuesta)
        try {
          await processExcelFile(req.file.path, activityId, storeCode);
          console.log(`Archivo Excel procesado correctamente: ${req.file.originalname}`);
        } catch (err) {
          console.error(`Error al procesar archivo Excel ${req.file.originalname}:`, err);
        }
        
      } catch (error) {
        console.error("Error al subir archivo Excel:", error);
        next(error);
      }
    });
  });
  
  // Ruta para cargar archivo PDF
  app.post("/api/upload/pdf", upload.single("file"), (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No se proporcionó ningún archivo" });
        }
        
        const activityId = parseInt(req.body.activityId);
        const storeCode = req.body.storeCode;
        
        if (isNaN(activityId) || !storeCode) {
          // Eliminar el archivo si los parámetros son incorrectos
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Se requiere un ID de operativo válido y un código de tienda" });
        }
        
        // Verificar si el operativo existe
        const activity = await storage.getActivity(activityId);
        if (!activity) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Operativo no encontrado" });
        }
        
        // Verificar si la tienda existe
        const store = await storage.getStoreByCode(storeCode);
        if (!store) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        // Procesar el archivo en segundo plano
        res.status(202).json({ 
          message: "Archivo recibido. Procesando...",
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size
        });
        
        // Procesar el archivo (esto se ejecutará después de enviar la respuesta)
        try {
          await processPdfFile(req.file.path, activityId, storeCode);
          console.log(`Archivo PDF procesado correctamente: ${req.file.originalname}`);
        } catch (err) {
          console.error(`Error al procesar archivo PDF ${req.file.originalname}:`, err);
        }
        
      } catch (error) {
        console.error("Error al subir archivo PDF:", error);
        next(error);
      }
    });
  });
  
  // Rutas para documentos PDF
  
  // Obtener documentos PDF con filtros
  app.get("/api/pdf-documents", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        // Obtener parámetros de consulta para la paginación y filtrado
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const storeCode = req.query.storeCode as string || undefined;
        const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
        const fileName = req.query.fileName as string || undefined;
        const dateRange = req.query.dateRange ? 
          JSON.parse(req.query.dateRange as string) as { from: string | null, to: string | null } : undefined;
        
        // Crear objeto de filtros
        const filters: SearchFilters = {
          storeCode,
          activityId,
          fileName,
          dateRange
        };
        
        // Obtener documentos paginados según los filtros
        const result = await storage.searchPdfDocuments({
          page,
          limit,
          filters
        });
        
        // Si se está realizando una búsqueda por nombre de archivo, registrarla
        if (fileName) {
          // Crear una entrada en el historial de búsqueda
          const searchEntry: InsertSearchHistory = {
            userId: req.user!.id,
            searchType: "PdfDocument",
            searchTerms: fileName,
            resultCount: result.totalItems
          };
          
          await storage.addSearchHistory(searchEntry);
        }
        
        res.json(result);
      } catch (error) {
        console.error("Error al obtener documentos PDF:", error);
        next(error);
      }
    });
  });
  
  // Obtener un documento PDF específico por ID
  app.get("/api/pdf-documents/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const pdfDocument = await storage.getPdfDocument(id);
        
        if (!pdfDocument) {
          return res.status(404).json({ error: "Documento no encontrado" });
        }
        
        res.json(pdfDocument);
      } catch (error) {
        console.error(`Error al obtener documento PDF con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  // Descargar un documento PDF específico por ID
  app.get("/api/pdf-documents/:id/download", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        const pdfDocument = await storage.getPdfDocument(id);
        
        if (!pdfDocument) {
          return res.status(404).json({ error: "Documento no encontrado" });
        }
        
        const filePath = pdfDocument.filePath;
        
        // Verificar si el archivo existe
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "El archivo físico no se encuentra en el servidor" });
        }
        
        // Enviar el archivo
        res.download(filePath, pdfDocument.fileName);
        
      } catch (error) {
        console.error(`Error al descargar documento PDF con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  // Rutas para la búsqueda general
  app.post("/api/search", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin", "User"])(req, res, async () => {
      try {
        const searchRequest: SearchRequest = req.body;
        const { query, options } = searchRequest;
        
        if (!query || query.trim().length < 2) {
          return res.status(400).json({ error: "La búsqueda debe tener al menos 2 caracteres" });
        }
        
        // Realizar la búsqueda
        const results = await storage.performSearch(query, options);
        
        // Registrar la búsqueda en el historial
        const searchEntry: InsertSearchHistory = {
          userId: req.user!.id,
          searchType: "General",
          searchTerms: query,
          resultCount: results.totalResults
        };
        
        await storage.addSearchHistory(searchEntry);
        
        res.json(results);
      } catch (error) {
        console.error("Error al realizar búsqueda:", error);
        next(error);
      }
    });
  });
  
  // Ruta para obtener informes generales
  app.get("/api/reports/general", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const storeCode = req.query.storeCode as string;
        const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        
        // Obtener estadísticas generales
        const stats = await storage.getGeneralStats(activityId, storeCode, startDate, endDate);
        
        res.json(stats);
      } catch (error) {
        console.error("Error al obtener informe general:", error);
        next(error);
      }
    });
  });
  
  // Ruta para obtener informes por tienda
  app.get("/api/reports/stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        
        // Obtener estadísticas por tienda
        const storeStats = await storage.getStoreStats(activityId, startDate, endDate);
        
        res.json(storeStats);
      } catch (error) {
        console.error("Error al obtener informe por tiendas:", error);
        next(error);
      }
    });
  });
  
  // Ruta para obtener informes de una tienda específica
  app.get("/api/reports/stores/:code", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const storeCode = req.params.code;
        const activityId = req.query.activityId ? parseInt(req.query.activityId as string) : undefined;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        
        // Verificar si la tienda existe
        const store = await storage.getStoreByCode(storeCode);
        if (!store) {
          return res.status(404).json({ error: "Tienda no encontrada" });
        }
        
        // Obtener estadísticas detalladas de la tienda
        const storeReport = await storage.getStoreReport(storeCode, activityId, startDate, endDate);
        
        res.json(storeReport);
      } catch (error) {
        console.error(`Error al obtener informe de la tienda ${req.params.code}:`, error);
        next(error);
      }
    });
  });
  
  // Ruta para obtener estadísticas de vigilancia de archivos
  app.get("/api/file-watcher/stats", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const stats = await storage.getFileWatcherStats();
        res.json(stats);
      } catch (error) {
        console.error("Error al obtener estadísticas de vigilancia de archivos:", error);
        next(error);
      }
    });
  });
  
  // Ruta para controlar el estado de vigilancia de archivos
  app.post("/api/file-watcher/control", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const { action } = req.body;
        
        if (action === "start") {
          await initializeFileWatchers();
          res.json({ success: true, message: "Vigilancia de archivos iniciada" });
        } else if (action === "stop") {
          await stopFileWatchers();
          res.json({ success: true, message: "Vigilancia de archivos detenida" });
        } else {
          res.status(400).json({ error: "Acción no válida. Use 'start' o 'stop'." });
        }
      } catch (error) {
        console.error("Error al controlar vigilancia de archivos:", error);
        next(error);
      }
    });
  });
  
  // Rutas historial de búsquedas
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

  return httpServer;
}

// Helper function to set up multer for file uploads
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
      const extension = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
  });
  
  return multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
    fileFilter: function (req, file, cb) {
      // Aceptar solo archivos Excel, CSV y PDF
      if (file.mimetype === 'application/pdf' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'text/csv' ||
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

// Función auxiliar para verificar la contraseña de administrador
async function verifyAdminPassword(userId: number, password: string): Promise<boolean> {
  try {
    return await storage.verifyUserPassword(userId, password);
  } catch (error) {
    console.error(`Error al verificar contraseña para el usuario ${userId}:`, error);
    return false;
  }
}