import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
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
        
        // Preprocesar datos para asegurar compatibilidad con SQLite
        const storeData = {
          ...req.body,
          // Asegurar que active es number (1 o 0) para SQLite
          active: req.body.active === true || req.body.active === 1 ? 1 : 0,
          // Convertir fechas y otros campos cuando sea necesario
          createdAt: new Date().toISOString(),
          startDate: req.body.startDate || null,
          endDate: req.body.endDate || null,
          // Asegurar que los campos opcionales sean string o null
          district: req.body.district || null,
          locality: req.body.locality || null,
          address: req.body.address || null,
          phone: req.body.phone || null,
          email: req.body.email || null,
          cif: req.body.cif || null,
          businessName: req.body.businessName || null,
          ownerName: req.body.ownerName || null,
          ownerIdNumber: req.body.ownerIdNumber || null,
          notes: req.body.notes || null
        };
        
        const store = await storage.createStore(storeData);
        res.status(201).json(store);
      } catch (err) {
        console.error('Error creating store:', err);
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
        
        // Preprocesar datos para asegurar compatibilidad con SQLite
        const storeData = {
          ...req.body,
          // Asegurar que active es number (1 o 0) para SQLite
          active: req.body.active === true || req.body.active === 1 ? 1 : 0,
          // Convertir fechas y otros campos cuando sea necesario
          startDate: req.body.startDate === "" ? null : req.body.startDate,
          endDate: req.body.endDate === "" ? null : req.body.endDate,
          // Asegurar que los campos opcionales sean string o null
          district: req.body.district || null,
          locality: req.body.locality || null,
          address: req.body.address || null,
          phone: req.body.phone || null,
          email: req.body.email || null,
          cif: req.body.cif || null,
          businessName: req.body.businessName || null,
          ownerName: req.body.ownerName || null,
          ownerIdNumber: req.body.ownerIdNumber || null,
          notes: req.body.notes || null
        };
        
        const updatedStore = await storage.updateStore(storeId, storeData);
        
        if (!updatedStore) {
          return res.status(500).json({ message: "Failed to update store" });
        }
        
        res.json(updatedStore);
      } catch (err) {
        console.error('Error updating store:', err);
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
  
  // Endpoint para obtener estadísticas de una tienda
  app.get("/api/stores/:storeCode/stats", async (req, res, next) => {
    try {
      const storeCode = req.params.storeCode.trim();
      
      // Obtener total de órdenes para la tienda
      const orders = await storage.getExcelDataByStore(storeCode);
      
      // Si no hay órdenes, devolver estadísticas vacías
      if (!orders || orders.length === 0) {
        return res.status(200).json({
          totalOrders: 0,
          averagePrice: "0",
          lastActivity: "Sin actividad",
          mostCommonMetal: "Sin datos"
        });
      }
      
      // Calcular estadísticas
      const totalOrders = orders.length;
      
      // Calcular precio promedio de las órdenes
      let totalPrice = 0;
      let validPrices = 0;
      
      orders.forEach(order => {
        const price = parseFloat(order.price?.replace(/[^\d.-]/g, '') || "0");
        if (!isNaN(price)) {
          totalPrice += price;
          validPrices++;
        }
      });
      
      const averagePrice = validPrices > 0 
        ? `${Math.round(totalPrice / validPrices).toLocaleString('es-ES')} €` 
        : "No disponible";
      
      // Obtener fecha de última actividad
      const lastOrder = orders.sort((a, b) => 
        new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      )[0];
      
      const lastActivity = lastOrder 
        ? new Date(lastOrder.orderDate).toLocaleDateString('es-ES', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
          })
        : "Sin actividad reciente";
      
      // Contar metales más comunes
      const metalCounts: Record<string, number> = {};
      
      orders.forEach(order => {
        if (!order.metals) return;
        
        const metals = order.metals.split(',').map(m => m.trim().toUpperCase());
        metals.forEach(metal => {
          if (metal && metal.length > 0) {
            metalCounts[metal] = (metalCounts[metal] || 0) + 1;
          }
        });
      });
      
      let mostCommonMetal = "Sin datos";
      let maxCount = 0;
      
      for (const [metal, count] of Object.entries(metalCounts)) {
        if (count > maxCount) {
          mostCommonMetal = metal;
          maxCount = count;
        }
      }
      
      res.status(200).json({
        totalOrders,
        averagePrice,
        lastActivity,
        mostCommonMetal
      });
      
    } catch (err) {
      console.error("Error al obtener estadísticas de tienda:", err);
      next(err);
    }
  });
  
  // Endpoint para obtener estadísticas avanzadas de una tienda
  app.get("/api/stores/:storeCode/advanced-stats", async (req, res, next) => {
    try {
      const storeCode = req.params.storeCode.trim();
      
      // Obtener órdenes para la tienda
      const orders = await storage.getExcelDataByStore(storeCode);
      
      // Si no hay órdenes, devolver estadísticas vacías
      if (!orders || orders.length === 0) {
        return res.status(200).json({
          ordersByMonth: [],
          priceDistribution: [],
          sellersByRegion: [],
          customerMetrics: {
            totalCustomers: 0,
            returningCustomers: 0,
            returningRate: "0%"
          },
          performanceMetrics: {
            avgOrdersPerMonth: 0,
            peakMonth: "N/A",
            peakMonthValue: 0
          }
        });
      }
      
      // Calcular distribución de órdenes por mes
      const ordersByMonth: {month: string, count: number}[] = [];
      const monthCounts: Record<string, number> = {};
      
      // Calcular distribución de precios
      const priceRanges: Record<string, number> = {
        "0-50€": 0,
        "51-100€": 0,
        "101-200€": 0,
        "201-500€": 0,
        "501-1000€": 0,
        "+1000€": 0
      };
      
      // Clientes únicos
      const uniqueCustomers = new Set<string>();
      const customerOrders: Record<string, number> = {};
      
      // Vendedores por región (provincia/país)
      const sellersByRegionMap: Record<string, number> = {};
      
      // Procesar cada orden
      orders.forEach(order => {
        // Conteo por mes
        const date = new Date(order.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        
        // Distribución de precio
        const price = parseFloat(order.price?.replace(/[^\d.-]/g, '') || "0");
        if (!isNaN(price)) {
          if (price <= 50) priceRanges["0-50€"]++;
          else if (price <= 100) priceRanges["51-100€"]++;
          else if (price <= 200) priceRanges["101-200€"]++;
          else if (price <= 500) priceRanges["201-500€"]++;
          else if (price <= 1000) priceRanges["501-1000€"]++;
          else priceRanges["+1000€"]++;
        }
        
        // Clientes
        if (order.customerName) {
          const customerKey = order.customerName.toUpperCase().trim();
          uniqueCustomers.add(customerKey);
          customerOrders[customerKey] = (customerOrders[customerKey] || 0) + 1;
        }
        
        // Vendedores por región
        if (order.customerLocation) {
          // Extraer provincia/país de customerLocation
          let region = order.customerLocation;
          
          // Intentar extraer país de la ubicación (patrón común: "Ciudad, País")
          const locationParts = order.customerLocation.split(',');
          if (locationParts.length > 1) {
            // El último elemento es probablemente el país
            region = locationParts[locationParts.length - 1].trim();
          } else {
            // Si no hay coma, usar toda la ubicación
            region = order.customerLocation.trim();
          }
          
          // Normalizar la región
          region = region.toUpperCase();
          
          // Incrementar contador para esta región
          sellersByRegionMap[region] = (sellersByRegionMap[region] || 0) + 1;
        }
      });
      
      // Convertir conteo de meses a array ordenado
      const monthEntries = Object.entries(monthCounts);
      monthEntries.sort((a, b) => a[0].localeCompare(b[0]));
      
      const ordersByMonthArray = monthEntries.map(([month, count]) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
          .toLocaleDateString('es-ES', { month: 'long' });
        return {
          month: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`,
          count
        };
      });
      
      // Convertir distribución de precios a array
      const priceDistribution = Object.entries(priceRanges).map(([range, count]) => {
        return { range, count };
      });
      
      // Convertir vendedores por región a array ordenado
      const sellersByRegion = Object.entries(sellersByRegionMap)
        .sort((a, b) => b[1] - a[1])  // Ordenar por cantidad (descendente)
        .map(([region, count]) => {
          return { 
            region, 
            count, 
            percentage: Math.round((count / orders.length) * 100) 
          };
        });
      
      // Métricas de clientes
      const totalCustomers = uniqueCustomers.size;
      const returningCustomers = Object.values(customerOrders).filter(count => count > 1).length;
      const returningRate = totalCustomers > 0 
        ? `${Math.round((returningCustomers / totalCustomers) * 100)}%` 
        : "0%";
      
      // Métricas de rendimiento
      let peakMonth = "N/A";
      let peakMonthValue = 0;
      
      Object.entries(monthCounts).forEach(([month, count]) => {
        if (count > peakMonthValue) {
          peakMonthValue = count;
          const [year, monthNum] = month.split('-');
          const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
            .toLocaleDateString('es-ES', { month: 'long' });
          peakMonth = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
        }
      });
      
      // Calcular promedio de órdenes por mes si hay datos
      const uniqueMonths = Object.keys(monthCounts).length;
      const avgOrdersPerMonth = uniqueMonths > 0 
        ? Math.round(orders.length / uniqueMonths) 
        : 0;
      
      res.status(200).json({
        ordersByMonth: ordersByMonthArray,
        priceDistribution,
        sellersByRegion,
        customerMetrics: {
          totalCustomers,
          returningCustomers,
          returningRate
        },
        performanceMetrics: {
          avgOrdersPerMonth,
          peakMonth,
          peakMonthValue
        }
      });
      
    } catch (err) {
      console.error("Error al obtener estadísticas avanzadas de tienda:", err);
      next(err);
    }
  });
  
  // Importación de tiendas desde Excel
  app.post("/api/import-stores", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // @ts-ignore - req.files es añadido por express-fileupload
        if (!req.files || !req.files.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        
        // @ts-ignore - req.files es añadido por express-fileupload
        const file = req.files.file;
        if (Array.isArray(file)) {
          return res.status(400).json({ message: "Multiple files not supported" });
        }
        
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
          return res.status(400).json({ message: "Invalid file format. Only Excel files are supported." });
        }
        
        // Crear un archivo temporal para procesar
        const tempFilePath = path.join(os.tmpdir(), `import_${Date.now()}_${file.name}`);
        await fs.promises.writeFile(tempFilePath, file.data);
        
        // Procesar el archivo Excel
        const workbook = XLSX.readFile(tempFilePath);
        const worksheet = workbook.Sheets[workbook.SheetNames.find(name => name === 'Tiendas') || workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Validar y procesar los datos
        const importResults = {
          imported: 0,
          errors: [] as string[],
          skipped: 0
        };
        
        for (const row of data) {
          try {
            // Verificar campos obligatorios
            const storeCode = row['Código*'] as string;
            const storeName = row['Nombre*'] as string;
            const storeType = row['Tipo*'] as string;
            const storeActive = row['Activa*'] as string;
            
            if (!storeCode || !storeName || !storeType) {
              importResults.errors.push(`Fila con datos incompletos: ${JSON.stringify(row)}`);
              importResults.skipped++;
              continue;
            }
            
            // Verificar si la tienda ya existe
            const existingStore = await storage.getStoreByCode(storeCode);
            if (existingStore) {
              importResults.errors.push(`Tienda con código ${storeCode} ya existe`);
              importResults.skipped++;
              continue;
            }
            
            // Convertir valores a formato esperado
            const isActive = storeActive?.toLowerCase() === 'sí' || 
                             storeActive?.toLowerCase() === 'si' || 
                             storeActive?.toLowerCase() === 'yes' ||
                             storeActive?.toLowerCase() === 'true';
            
            let startDate = null;
            if (row['Fecha Inicio']) {
              // Convertir formato DD/MM/YYYY a Date
              const parts = (row['Fecha Inicio'] as string).split('/');
              if (parts.length === 3) {
                startDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            }
            
            let endDate = null;
            if (row['Fecha Cese']) {
              // Convertir formato DD/MM/YYYY a Date
              const parts = (row['Fecha Cese'] as string).split('/');
              if (parts.length === 3) {
                endDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            }
            
            // Crear la tienda
            const newStore = {
              code: storeCode,
              name: storeName,
              type: storeType as "Excel" | "PDF",
              active: isActive ? 1 : 0,
              district: (row['Distrito'] as string) || null,
              locality: (row['Localidad'] as string) || null,
              address: (row['Dirección'] as string) || null,
              phone: (row['Teléfono'] as string) || null,
              email: (row['Email'] as string) || null,
              cif: (row['CIF'] as string) || null,
              businessName: (row['Razón Social'] as string) || null,
              ownerName: (row['Nombre Propietario'] as string) || null,
              ownerIdNumber: (row['DNI Propietario'] as string) || null,
              startDate: startDate ? startDate.toISOString() : null,
              endDate: endDate ? endDate.toISOString() : null,
              notes: (row['Anotaciones'] as string) || null
            };
            
            await storage.createStore(newStore);
            importResults.imported++;
            
          } catch (error) {
            importResults.errors.push(`Error al procesar fila: ${error instanceof Error ? error.message : String(error)}`);
            importResults.skipped++;
          }
        }
        
        // Limpiar el archivo temporal
        await fs.promises.unlink(tempFilePath);
        
        res.status(200).json({
          imported: importResults.imported,
          skipped: importResults.skipped,
          errors: importResults.errors
        });
        
      } catch (err) {
        console.error('Error processing import:', err);
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
  
  // Endpoint para obtener archivos pendientes de asignación de tienda
  app.get("/api/pending-store-assignments", async (req, res, next) => {
    try {
      console.log("Solicitando actividades pendientes de asignación de tienda...");
      
      // Verificar primero en la DB si realmente hay actividades pendientes
      const pendingActivitiesFromDB = await db
        .select()
        .from(fileActivities)
        .where(
          or(
            eq(fileActivities.status, 'PendingStoreAssignment'),
            eq(fileActivities.storeCode, 'PENDIENTE')
          )
        )
        .orderBy(desc(fileActivities.processingDate));
        
      if (pendingActivitiesFromDB.length > 0) {
        console.log(`Se encontraron ${pendingActivitiesFromDB.length} actividades pendientes directamente en la DB`);
        res.json(pendingActivitiesFromDB);
      } else {
        // Si no hay en la DB, usar el método normal
        console.log("No se encontraron actividades pendientes en la DB, usando método storage...");
        const pendingActivities = await storage.getPendingStoreAssignmentActivities();
        
        if (pendingActivities.length > 0) {
          console.log("⚠️ INCONSISTENCIA DETECTADA: El storage reporta actividades pendientes pero no están en la DB");
          console.log("Actividades reportadas por storage:", JSON.stringify(pendingActivities));
          
          // Si hay actividades reportadas por el storage pero no por la DB, 
          // devolver un array vacío para limpiar la UI
          res.json([]);
        } else {
          res.json([]);
        }
      }
    } catch (error) {
      console.error("Error al obtener actividades pendientes:", error);
      // En caso de error, devolver un array vacío para evitar bloquear la UI
      res.json([]);
    }
  });
  
  // Endpoint para renombrar un archivo y procesarlo de nuevo
  app.post("/api/file-activities/:id/rename", async (req, res, next) => {
    try {
      const activityId = parseInt(req.params.id);
      const { newFilename } = req.body;
      
      // Verificar que el ID de actividad es válido
      const activity = await storage.getFileActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Actividad de archivo no encontrada" });
      }
      
      // Verificar que el nuevo nombre no está vacío
      if (!newFilename || typeof newFilename !== 'string' || newFilename.trim().length === 0) {
        return res.status(400).json({ message: "Debe proporcionar un nuevo nombre de archivo válido" });
      }
      
      // Ubicaciones de los archivos originales y nuevos
      let originalFilePath = '';
      
      console.log(`Renombrando archivo para la actividad ${activityId}: ${activity.filename} -> ${newFilename}`);
      
      // Posibles ubicaciones de archivos
      const possibleLocations = [];
      
      if (activity.fileType === 'Excel') {
        // Para archivos Excel
        possibleLocations.push(
          // Ubicaciones principales para Excel
          path.join('./data/excel', activity.filename),
          path.join('./data/excel/procesados', activity.filename),
          path.join('./uploads/excel', activity.filename),
          // Ubicación para archivos recién subidos
          path.join(os.tmpdir(), activity.filename),
          path.join('./temp', activity.filename)
        );
      } else if (activity.fileType === 'PDF') {
        // Para archivos PDF
        possibleLocations.push(
          // Ubicaciones principales para PDF
          path.join('./data/pdf', activity.filename),
          path.join('./data/pdf/procesados', activity.filename),
          path.join('./uploads/pdf', activity.filename),
          // Ubicación para archivos recién subidos
          path.join(os.tmpdir(), activity.filename),
          path.join('./temp', activity.filename)
        );
      } else {
        return res.status(400).json({ message: "Tipo de archivo no soportado" });
      }
      
      // Verificar si el archivo existe en alguna de las ubicaciones
      for (const location of possibleLocations) {
        if (fs.existsSync(location)) {
          originalFilePath = location;
          console.log(`Se encontró el archivo en: ${originalFilePath}`);
          break;
        }
      }
      
      // Si no se encontró con el nombre exacto, buscar por coincidencia parcial
      if (!originalFilePath) {
        console.warn(`No se encontró el archivo con el nombre exacto en ninguna ubicación conocida`);
        
        // Determinar los directorios a buscar
        const dirsToSearch = [];
        if (activity.fileType === 'Excel') {
          dirsToSearch.push('./data/excel', './data/excel/procesados', './uploads/excel');
        } else {
          dirsToSearch.push('./data/pdf', './data/pdf/procesados', './uploads/pdf');
        }
        
        // Extraer extensión y nombre base
        const fileExt = path.extname(activity.filename);
        const baseFileName = path.basename(activity.filename, fileExt);
        
        // Buscar en cada directorio por coincidencia parcial
        for (const dir of dirsToSearch) {
          if (fs.existsSync(dir)) {
            try {
              const files = fs.readdirSync(dir);
              for (const file of files) {
                // Comprobar si el archivo contiene parte del nombre original o si solo hay uno con la misma extensión
                if ((file.includes(baseFileName) || 
                    (files.length === 1 && file.endsWith(fileExt))) && 
                    file.endsWith(fileExt)) {
                  originalFilePath = path.join(dir, file);
                  console.log(`Se encontró un archivo similar: ${originalFilePath}`);
                  break;
                }
              }
              if (originalFilePath) break;
            } catch (err) {
              console.error(`Error al leer el directorio ${dir}:`, err);
            }
          }
        }
        
        if (!originalFilePath) {
          // Si la actividad fue recién creada, el archivo puede estar en el directorio temporal
          if (new Date().getTime() - new Date(activity.processingDate).getTime() < 60000) { // menos de 1 minuto
            // Buscar el PDF o Excel en el directorio temporal del sistema
            const tempDir = os.tmpdir();
            if (fs.existsSync(tempDir)) {
              try {
                const files = fs.readdirSync(tempDir);
                for (const file of files) {
                  if (file.endsWith(fileExt)) {
                    originalFilePath = path.join(tempDir, file);
                    console.log(`Se encontró un archivo temporal reciente: ${originalFilePath}`);
                    break;
                  }
                }
              } catch (err) {
                console.error(`Error al leer el directorio temporal:`, err);
              }
            }
          }
        }
        
        // Si aún no se ha encontrado, buscar en el directorio actual
        if (!originalFilePath) {
          const currentDir = './';
          try {
            const files = fs.readdirSync(currentDir);
            for (const file of files) {
              if (file.endsWith(fileExt) && (file.includes(baseFileName) || file === activity.filename)) {
                originalFilePath = path.join(currentDir, file);
                console.log(`Se encontró un archivo en el directorio actual: ${originalFilePath}`);
                break;
              }
            }
          } catch (err) {
            console.error(`Error al leer el directorio actual:`, err);
          }
        }
      }
      
      // Si después de todo no se encontró el archivo
      if (!originalFilePath) {
        return res.status(404).json({ message: "No se pudo encontrar el archivo físico para renombrar" });
      }
      // Generar la ruta para el nuevo archivo en el mismo directorio del original
      const originalDirPath = path.dirname(originalFilePath);
      const newFilePath = path.join(originalDirPath, newFilename);
      
      console.log(`Ruta del archivo original: ${originalFilePath}`);
      console.log(`Ruta para el nuevo archivo: ${newFilePath}`);
      
      // Actualizar el registro en la base de datos
      await storage.updateFileActivity(activityId, {
        filename: newFilename,
        status: 'Pending', // Marcar como pendiente para reprocesarlo
      });
      
      // Renombrar el archivo físico
      fs.renameSync(originalFilePath, newFilePath);
      console.log(`Archivo renombrado físicamente: ${originalFilePath} -> ${newFilePath}`);
      
      // Procesar el archivo de nuevo según su tipo
      if (activity.fileType === 'Excel') {
        // La detección del código de tienda se hace en el procesador
        // Usamos el ID de la actividad actual para mantener la relación con los datos
        const result = await processExcelFile(newFilePath, activityId, activity.storeCode || "");
        
        // Si se detectó un código de tienda diferente, actualizarlo en la actividad
        if (result?.detectedStoreCode && result.detectedStoreCode !== activity.storeCode) {
          await storage.updateFileActivity(activityId, {
            storeCode: result.detectedStoreCode
          });
          console.log(`Código de tienda actualizado para actividad ${activityId}: ${activity.storeCode} -> ${result.detectedStoreCode}`);
        }
        
        // Verificar el estado final de la actividad
        const updatedActivity = await storage.getFileActivity(activityId);
        const finalStatus = updatedActivity?.status || "Desconocido";
        
        res.json({ 
          success: true, 
          message: `Archivo Excel renombrado y procesado correctamente (Estado final: ${finalStatus})`, 
          newFilename, 
          detectedStoreCode: result?.detectedStoreCode,
          status: finalStatus
        });
      } else if (activity.fileType === 'PDF') {
        // La detección del código de tienda se hace en el procesador
        // Usamos el ID de la actividad actual para mantener la relación con los datos
        const result = await processPdfFile(newFilePath, activityId, activity.storeCode || "");
        
        // Si se detectó un código de tienda diferente, actualizarlo en la actividad
        if (result?.detectedStoreCode && result.detectedStoreCode !== activity.storeCode) {
          await storage.updateFileActivity(activityId, {
            storeCode: result.detectedStoreCode
          });
          console.log(`Código de tienda actualizado para actividad ${activityId}: ${activity.storeCode} -> ${result.detectedStoreCode}`);
        }
        
        // Verificar el estado final de la actividad
        const updatedActivity = await storage.getFileActivity(activityId);
        const finalStatus = updatedActivity?.status || "Desconocido";
        
        res.json({ 
          success: true, 
          message: `Archivo PDF renombrado y procesado correctamente (Estado final: ${finalStatus})`, 
          newFilename, 
          detectedStoreCode: result?.detectedStoreCode,
          status: finalStatus
        });
      }
    } catch (error) {
      console.error("Error al renombrar archivo:", error);
      next(error);
    }
  });
  
  // Endpoint para asignar una tienda a un archivo pendiente
  app.post(["/api/file-activities/:id/assign-store", "/api/assign-store"], async (req, res, next) => {
    try {
      // Si usamos la ruta general, extraer el activityId del body
      const activityId = req.params.id ? parseInt(req.params.id) : (req.body.activityId ? parseInt(req.body.activityId) : -1);
      const { storeCode, createNewStore } = req.body;
      
      console.log(`🔄 Asignación de tienda solicitada para activityId=${activityId}, storeCode=${storeCode}, createNewStore=${createNewStore}`);
      
      // Verificar que el ID de actividad es válido
      const activity = await storage.getFileActivity(activityId);
      if (!activity) {
        console.error(`❌ No se encontró una actividad con ID ${activityId}`);
        
        // Verificar directamente en la base de datos
        const dbCheck = await db
          .select()
          .from(fileActivities)
          .where(eq(fileActivities.id, activityId));
        
        if (dbCheck.length > 0) {
          console.log(`⚠️ INCONSISTENCIA: La actividad ${activityId} existe en la base de datos pero no en el storage`);
          console.log(`Actividad en DB:`, JSON.stringify(dbCheck[0]));
          
          // Reinsertar la actividad en la memoria desde la DB
          console.log(`Intentando recuperar la actividad de la DB al storage...`);
          const recoveredActivity = dbCheck[0];
          await storage.createFileActivity({
            filename: recoveredActivity.filename,
            storeCode: recoveredActivity.storeCode,
            fileType: recoveredActivity.fileType,
            status: recoveredActivity.status,
            processingDate: recoveredActivity.processingDate,
            processedBy: recoveredActivity.processedBy,
            errorMessage: recoveredActivity.errorMessage,
            metadata: recoveredActivity.metadata,
            detectedStoreCode: recoveredActivity.detectedStoreCode
          });
          
          return res.status(500).json({ 
            message: "Se detectó una inconsistencia en los datos. Por favor, intente de nuevo en unos momentos." 
          });
        }
        
        return res.status(404).json({ message: "Actividad de archivo no encontrada" });
      }
      
      // Verificar que la actividad está en estado pendiente de asignación o procesado
      // Permitimos reasignar tiendas a archivos en cualquier estado excepto 'Failed'
      if (activity.status === 'Failed') {
        return res.status(400).json({ 
          message: "No se puede asignar tienda a una actividad que ha fallado. Borre la actividad y procese el archivo nuevamente." 
        });
      }
      
      console.log(`Asignando tienda ${storeCode} a actividad ${activityId} con estado actual: ${activity.status}`);
      
      let targetStoreCode = storeCode;
      
      // Si se indicó crear una nueva tienda
      if (createNewStore === true) {
        // Usar el código detectado o el proporcionado
        const newStoreCode = storeCode || activity.detectedStoreCode;
        
        if (!newStoreCode) {
          return res.status(400).json({ 
            message: "Se requiere un código de tienda para crear una nueva tienda" 
          });
        }
        
        // Verificar que no exista una tienda con ese código
        const existingStore = await storage.getStoreByCode(newStoreCode);
        if (existingStore) {
          return res.status(400).json({ 
            message: `Ya existe una tienda con el código ${newStoreCode}` 
          });
        }
        
        // Crear la nueva tienda
        const newStore = await storage.createStore({
          code: newStoreCode,
          name: `Tienda ${newStoreCode}`,
          type: activity.fileType,
          district: "",
          locality: "",
          active: 1
        });
        
        targetStoreCode = newStore.code;
      } else {
        // Verificar que la tienda existe
        const store = await storage.getStoreByCode(storeCode);
        if (!store) {
          return res.status(404).json({ message: "Tienda no encontrada" });
        }
        
        // Verificar que el tipo de tienda coincide con el tipo de archivo
        if (store.type !== activity.fileType) {
          return res.status(400).json({ 
            message: `Esta tienda es de tipo ${store.type} pero el archivo es ${activity.fileType}` 
          });
        }
      }
      
      // Actualizar la actividad con el nuevo código de tienda y cambiar su estado a Pending
      // También asegurarnos de que no sea PENDIENTE para que no aparezca en la lista de pendientes
      const updatedActivity = await storage.updateFileActivity(activityId, {
        storeCode: targetStoreCode,
        status: 'Pending'
      });
      
      // Verificar que se haya actualizado correctamente
      console.log(`Actividad actualizada: storeCode=${updatedActivity.storeCode}, status=${updatedActivity.status}`);
      
      // Volver a procesar el archivo ahora que tiene una tienda asignada
      // Buscar el archivo en diferentes ubicaciones posibles
      let filePath = null;
      let fileName = activity.filename;
      
      // Directorios base a comprobar
      let baseDirs = [];
      
      if (activity.fileType === 'Excel') {
        baseDirs = ["./uploads/excel", "./data/excel"];
      } else if (activity.fileType === 'PDF') {
        baseDirs = ["./uploads/pdf", "./data/pdf"];
      }
      
      // Buscar en todas las rutas posibles
      for (const baseDir of baseDirs) {
        // Rutas a comprobar (incluye directorio de "procesados")
        const pathsToCheck = [
          path.join(baseDir, fileName),                     // Ruta original
          path.join(baseDir, "procesados", fileName)        // Carpeta "procesados"
        ];
        
        // Comprobar todas las rutas
        for (const checkPath of pathsToCheck) {
          if (fs.existsSync(checkPath)) {
            filePath = checkPath;
            console.log(`Encontrado archivo para reasignar tienda en: ${filePath}`);
            break;
          }
        }
        
        if (filePath) break; // Si encontramos el archivo, salir del bucle exterior
        
        // Si no se encontró el archivo exacto, buscar por nombre parcial
        if (!filePath) {
          const baseFileName = fileName.replace(/\.[^/.]+$/, ''); // Nombre sin extensión
          const extension = path.extname(fileName);
          
          // Buscar en directorio principal
          if (fs.existsSync(baseDir)) {
            try {
              const mainDir = fs.readdirSync(baseDir);
              for (const file of mainDir) {
                if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                  filePath = path.join(baseDir, file);
                  fileName = file;
                  console.log(`Encontrado archivo por coincidencia parcial: ${filePath}`);
                  break;
                }
              }
            } catch (err) {
              console.error(`Error al leer directorio ${baseDir}:`, err);
            }
          }
          
          // Si no se encontró, buscar en directorio "procesados"
          if (!filePath) {
            const processedDir = path.join(baseDir, "procesados");
            if (fs.existsSync(processedDir)) {
              try {
                const processedFiles = fs.readdirSync(processedDir);
                for (const file of processedFiles) {
                  if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                    filePath = path.join(processedDir, file);
                    fileName = file;
                    console.log(`Encontrado archivo por coincidencia parcial en procesados: ${filePath}`);
                    break;
                  }
                }
              } catch (err) {
                console.error(`Error al leer directorio ${processedDir}:`, err);
              }
            }
          }
          
          if (filePath) break; // Si encontramos el archivo, salir del bucle exterior
        }
      }
      
      // Verificar si encontramos el archivo
      if (!filePath) {
        console.error(`No se encontró el archivo ${activity.filename} en ninguna de las rutas buscadas`);
        // Actualizar la actividad para indicar que no se pudo encontrar el archivo
        await storage.updateFileActivity(activityId, {
          status: 'Failed',
          errorMessage: 'No se encontró el archivo físico para procesar. Verifique si fue eliminado o movido.'
        });
        
        // Devolver respuesta al cliente
        return res.status(200).json({
          ...updatedActivity,
          status: 'Failed',
          errorMessage: 'No se encontró el archivo físico para procesar. Verifique si fue eliminado o movido.'
        });
      }
      
      console.log(`Procesando archivo ${filePath} con activityId ${activityId} y storeCode ${targetStoreCode}`);
      
      try {
        if (activity.fileType === 'Excel') {
          // Para Excel, procesar el archivo de forma sincrónica
          const result = await processExcelFile(filePath, activityId, targetStoreCode);
          console.log(`Resultado de procesar Excel después de asignar tienda:`, result);
        } else {
          // Para PDF, procesar el archivo de forma sincrónica
          const result = await processPdfFile(filePath, activityId, targetStoreCode);
          console.log(`Resultado de procesar PDF después de asignar tienda:`, result);
        }
        
        // Obtener estado actualizado de la actividad
        const finalActivity = await storage.getFileActivity(activityId);
        
        // Devolver respuesta al cliente con el estado final
        return res.json(finalActivity);
      } catch (err) {
        console.error(`Error al procesar archivo después de asignar tienda:`, err);
        
        // Actualizar la actividad con el error
        await storage.updateFileActivity(activityId, {
          status: 'Failed',
          errorMessage: `Error al procesar archivo: ${err.message || 'Error desconocido'}`
        });
        
        // Devolver respuesta al cliente con el error
        const failedActivity = await storage.getFileActivity(activityId);
        return res.json(failedActivity);
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Descargar archivo original
  // Endpoint para descargar archivo a partir del ID de excel_data
  app.get("/api/excel-data/:id/download", async (req, res, next) => {
    try {
      const excelDataId = parseInt(req.params.id);
      if (isNaN(excelDataId)) {
        return res.status(400).json({ message: "ID de excel_data inválido" });
      }
      
      // Obtener el registro de excel_data
      const excelData = await storage.getExcelDataById(excelDataId);
      if (!excelData) {
        return res.status(404).json({ message: "Datos de Excel no encontrados" });
      }
      
      // Buscar todas las actividades de archivos
      const activities = await storage.getFileActivities();
      
      // Filtrar para encontrar la actividad correspondiente al excelData
      // Normalmente el archivo que generó un registro excelData tiene el mismo código de tienda
      const matchingActivity = activities.find(activity => 
        activity.storeCode === excelData.storeCode && 
        activity.fileType === 'Excel' &&
        activity.status === 'Processed'
      );
      
      if (!matchingActivity) {
        return res.status(404).json({ message: "No se encontró el archivo original" });
      }
      
      // Usar la lógica de descarga existente con la actividad encontrada
      const activity = matchingActivity;
      
      console.log(`Descargando archivo original para excelData ID ${excelDataId}: ${activity.filename}`);
      
      // Intentar encontrar el archivo correcto
      let filePath = '';
      let fileName = '';
      
      // Directorios base a comprobar para Excel
      const baseDirs = ["./uploads/excel", "./data/excel"];
      
      // Buscar en todas las rutas posibles
      for (const baseDir of baseDirs) {
        // Rutas a comprobar (incluye directorio de "procesados")
        const pathsToCheck = [
          path.join(baseDir, activity.filename),                   // Ruta original
          path.join(baseDir, "procesados", activity.filename)      // Carpeta "procesados"
        ];
        
        // Comprobar todas las rutas
        for (const checkPath of pathsToCheck) {
          if (fs.existsSync(checkPath)) {
            filePath = checkPath;
            fileName = activity.filename;
            console.log(`Encontrado archivo en: ${filePath}`);
            break;
          }
        }
        
        if (filePath && fileName) break; // Si encontramos el archivo, salir del bucle exterior
        
        // Si no se encontró el archivo exacto, buscar por nombre parcial
        if (!fileName) {
          const baseFileName = activity.filename.replace(/\.[^/.]+$/, ''); // Nombre sin extensión
          const extension = path.extname(activity.filename);
          
          // Buscar en directorio principal
          if (fs.existsSync(baseDir)) {
            const mainDir = fs.readdirSync(baseDir);
            for (const file of mainDir) {
              if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                filePath = path.join(baseDir, file);
                fileName = file;
                console.log(`Encontrado archivo por coincidencia parcial: ${filePath}`);
                break;
              }
            }
          }
          
          // Si no se encontró, buscar en directorio "procesados"
          if (!fileName) {
            const processedDir = path.join(baseDir, "procesados");
            if (fs.existsSync(processedDir)) {
              const processedFiles = fs.readdirSync(processedDir);
              for (const file of processedFiles) {
                if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                  filePath = path.join(processedDir, file);
                  fileName = file;
                  console.log(`Encontrado archivo por coincidencia parcial en procesados: ${filePath}`);
                  break;
                }
              }
            }
          }
          
          if (filePath && fileName) break; // Si encontramos el archivo, salir del bucle exterior
        }
      }
      
      // Verificar si encontramos el archivo
      if (!fileName || !filePath || !fs.existsSync(filePath)) {
        // Registrar las rutas que se intentaron para depuración
        console.error(`No se encontró el archivo ${activity.filename} en ninguna de las rutas buscadas`);
        return res.status(404).json({ 
          message: "Archivo no encontrado en el sistema. Se intentó buscar en todas las ubicaciones posibles."
        });
      }
      
      console.log(`Descargando archivo: ${filePath}`);
      // Enviar el archivo como descarga, manteniendo el nombre original
      res.download(filePath, activity.filename);
    } catch (err) {
      console.error("Error buscando archivo para descargar:", err);
      next(err);
    }
  });
  
  app.get("/api/file-activities/:id/download", async (req, res, next) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: "ID de actividad inválido" });
      }
      
      const activity = await storage.getFileActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Intentar encontrar el archivo correcto
      let filePath = '';
      let fileName = '';
      
      if (activity.fileType === 'PDF') {
        // Para PDFs, primero intentar obtener la ruta desde los documentos PDF si existe
        const pdfDoc = await storage.getPdfDocumentByActivityId(activityId);
        
        if (pdfDoc && pdfDoc.path) {
          // Probar la ruta con y sin "./" al principio
          if (fs.existsSync(pdfDoc.path)) {
            filePath = pdfDoc.path;
            fileName = activity.filename;
            console.log(`Usando ruta de documento PDF almacenada: ${filePath}`);
          } else if (fs.existsSync(`./${pdfDoc.path}`)) {
            filePath = `./${pdfDoc.path}`;
            fileName = activity.filename;
            console.log(`Usando ruta de documento PDF con prefijo ./: ${filePath}`);
          } else {
            console.log(`La ruta almacenada ${pdfDoc.path} no existe, buscando alternativas...`);
          }
        }
      }
      
      // Si no se encontró en la base de datos o no es un PDF, buscar en el sistema de archivos
      if (!filePath || !fileName) {
        // Directorios base a comprobar
        let baseDirs = [];
        
        if (activity.fileType === 'Excel') {
          baseDirs = ["./uploads/excel", "./data/excel"];
        } else if (activity.fileType === 'PDF') {
          baseDirs = ["./uploads/pdf", "./data/pdf"];
        } else {
          return res.status(400).json({ message: "Tipo de archivo no soportado" });
        }
        
        // Buscar en todas las rutas posibles
        for (const baseDir of baseDirs) {
          // Rutas a comprobar (incluye directorio de "procesados")
          const pathsToCheck = [
            path.join(baseDir, activity.filename),                          // Ruta original
            path.join(baseDir, "procesados", activity.filename)             // Carpeta "procesados"
          ];
          
          // Comprobar todas las rutas
          for (const checkPath of pathsToCheck) {
            if (fs.existsSync(checkPath)) {
              filePath = checkPath;
              fileName = activity.filename;
              console.log(`Encontrado archivo en: ${filePath}`);
              break;
            }
          }
          
          if (filePath && fileName) break; // Si encontramos el archivo, salir del bucle exterior
          
          // Si no se encontró el archivo exacto, buscar por nombre parcial
          if (!fileName) {
            const baseFileName = activity.filename.replace(/\.[^/.]+$/, ''); // Nombre sin extensión
            const extension = path.extname(activity.filename);
            
            // Buscar en directorio principal
            if (fs.existsSync(baseDir)) {
              const mainDir = fs.readdirSync(baseDir);
              for (const file of mainDir) {
                if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                  filePath = path.join(baseDir, file);
                  fileName = file;
                  console.log(`Encontrado archivo por coincidencia parcial: ${filePath}`);
                  break;
                }
              }
            }
            
            // Si no se encontró, buscar en directorio "procesados"
            if (!fileName) {
              const processedDir = path.join(baseDir, "procesados");
              if (fs.existsSync(processedDir)) {
                const processedFiles = fs.readdirSync(processedDir);
                for (const file of processedFiles) {
                  if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                    filePath = path.join(processedDir, file);
                    fileName = file;
                    console.log(`Encontrado archivo por coincidencia parcial en procesados: ${filePath}`);
                    break;
                  }
                }
              }
            }
            
            if (filePath && fileName) break; // Si encontramos el archivo, salir del bucle exterior
          }
        }
      }
      
      // Verificar si encontramos el archivo
      if (!fileName || !filePath || !fs.existsSync(filePath)) {
        // Registrar las rutas que se intentaron para depuración
        console.error(`No se encontró el archivo ${activity.filename} en ninguna de las rutas buscadas`);
        return res.status(404).json({ 
          message: "Archivo no encontrado en el sistema. Se intentó buscar en todas las ubicaciones posibles."
        });
      }
      
      console.log(`Descargando archivo: ${filePath}`);
      // Enviar el archivo como descarga, manteniendo el nombre original
      res.download(filePath, activity.filename);
    } catch (err) {
      console.error("Error descargando archivo:", err);
      next(err);
    }
  });
  
  // Endpoint para visualizar PDFs (solo para PDFs)
  app.get("/api/file-activities/:id/view", async (req, res, next) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: "ID de actividad inválido" });
      }
      
      const activity = await storage.getFileActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Solo permitir visualización de PDFs
      if (activity.fileType !== 'PDF') {
        return res.status(400).json({ message: "Solo se pueden visualizar archivos PDF" });
      }
      
      // Intentar encontrar el archivo correcto
      let filePath = '';
      
      // Primero, intentar obtener la ruta desde los documentos PDF si existe
      const pdfDoc = await storage.getPdfDocumentByActivityId(activityId);
      
      if (pdfDoc && pdfDoc.path) {
        // Probar la ruta con y sin "./" al principio
        if (fs.existsSync(pdfDoc.path)) {
          filePath = pdfDoc.path;
          console.log(`Usando ruta de documento PDF almacenada: ${filePath}`);
        } else if (fs.existsSync(`./${pdfDoc.path}`)) {
          filePath = `./${pdfDoc.path}`;
          console.log(`Usando ruta de documento PDF con prefijo ./: ${filePath}`);
        } else {
          console.log(`La ruta almacenada ${pdfDoc.path} no existe, buscando alternativas...`);
        }
      }
      
      if (!filePath) {
        // Directorios base a comprobar
        const baseDirs = ["./uploads/pdf", "./data/pdf"];
        
        // Buscar en todas las rutas posibles
        for (const baseDir of baseDirs) {
          // Rutas a comprobar (incluye directorio de "procesados")
          const pathsToCheck = [
            path.join(baseDir, activity.filename),                          // Ruta original
            path.join(baseDir, "procesados", activity.filename)             // Carpeta "procesados"
          ];
          
          // Comprobar todas las rutas
          for (const checkPath of pathsToCheck) {
            if (fs.existsSync(checkPath)) {
              filePath = checkPath;
              console.log(`Encontrado archivo en: ${filePath}`);
              break;
            }
          }
          
          if (filePath) break; // Si encontramos el archivo, salir del bucle exterior
          
          // Si no se encontró el archivo exacto, buscar por nombre parcial
          if (!filePath) {
            const baseFileName = activity.filename.replace(/\.[^/.]+$/, ''); // Nombre sin extensión
            const extension = path.extname(activity.filename);
            
            // Buscar en directorio principal
            if (fs.existsSync(baseDir)) {
              const mainDir = fs.readdirSync(baseDir);
              for (const file of mainDir) {
                if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                  filePath = path.join(baseDir, file);
                  console.log(`Encontrado archivo por coincidencia parcial: ${filePath}`);
                  break;
                }
              }
            }
            
            // Si no se encontró, buscar en directorio "procesados"
            if (!filePath) {
              const processedDir = path.join(baseDir, "procesados");
              if (fs.existsSync(processedDir)) {
                const processedFiles = fs.readdirSync(processedDir);
                for (const file of processedFiles) {
                  if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                    filePath = path.join(processedDir, file);
                    console.log(`Encontrado archivo por coincidencia parcial en procesados: ${filePath}`);
                    break;
                  }
                }
              }
            }
            
            if (filePath) break; // Si encontramos el archivo, salir del bucle exterior
          }
        }
      }
      
      if (!filePath || !fs.existsSync(filePath)) {
        // Registrar las rutas que se intentaron para depuración
        console.error(`No se encontró el archivo PDF ${activity.filename} en ninguna de las rutas buscadas`);
        return res.status(404).json({ 
          message: "Archivo PDF no encontrado en el sistema. Se intentó buscar en todas las ubicaciones posibles."
        });
      }
      
      console.log(`Visualizando PDF: ${filePath}`);
      
      // Configurar el encabezado para mostrar PDF en el navegador
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=' + activity.filename);
      
      // Enviar el archivo PDF como respuesta
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (err) {
      console.error("Error visualizando PDF:", err);
      next(err);
    }
  });
  
  // Eliminar actividad y datos relacionados
  app.delete("/api/file-activities/:id", async (req, res, next) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: "ID de actividad inválido" });
      }
      
      const activity = await storage.getFileActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Actividad no encontrada" });
      }
      
      // Eliminar datos relacionados según el tipo de archivo
      if (activity.fileType === 'Excel') {
        await storage.deleteExcelDataByActivityId(activityId);
      } else if (activity.fileType === 'PDF') {
        await storage.deletePdfDocumentsByActivityId(activityId);
      }
      
      // Eliminar la actividad en sí
      const result = await storage.deleteFileActivity(activityId);
      
      // Eliminar el archivo físico
      try {
        // Determinar las rutas base según el tipo de archivo
        let baseDirs = [];
        if (activity.fileType === 'Excel') {
          baseDirs = ["./uploads/excel", "./data/excel"];
        } else {
          baseDirs = ["./uploads/pdf", "./data/pdf"];
        }
        
        // Intentar eliminar el archivo original o cualquier versión de él
        let fileDeleted = false;
        
        // Para cada directorio base, comprobar todas las posibles ubicaciones
        for (const baseDir of baseDirs) {
          // Rutas a comprobar (incluye directorio de "procesados")
          const pathsToCheck = [
            path.join(baseDir, activity.filename),                          // Ruta original
            path.join(baseDir, "procesados", activity.filename)             // Carpeta "procesados"
          ];
        
          // Intentar eliminar en todas las rutas posibles
          for (const checkPath of pathsToCheck) {
            if (fs.existsSync(checkPath)) {
              fs.unlinkSync(checkPath);
              fileDeleted = true;
              console.log(`Archivo eliminado: ${checkPath}`);
              break;
            }
          }
          
          // Si no se eliminó por nombre exacto, buscar por nombre parcial
          if (!fileDeleted) {
            const baseFileName = activity.filename.replace(/\.[^/.]+$/, ''); // Nombre sin extensión
            const extension = path.extname(activity.filename);
            
            // Buscar en directorio principal
            const mainDir = fs.existsSync(baseDir) ? fs.readdirSync(baseDir) : [];
            for (const file of mainDir) {
              if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                const filePath = path.join(baseDir, file);
                fs.unlinkSync(filePath);
                fileDeleted = true;
                console.log(`Archivo eliminado: ${filePath}`);
                break;
              }
            }
            
            // Si no se encontró en el directorio principal, buscar en "procesados"
            if (!fileDeleted) {
              const processedDir = path.join(baseDir, "procesados");
              if (fs.existsSync(processedDir)) {
                const processedFiles = fs.readdirSync(processedDir);
                for (const file of processedFiles) {
                  if (file.startsWith(baseFileName) && file.endsWith(extension)) {
                    const filePath = path.join(processedDir, file);
                    fs.unlinkSync(filePath);
                    fileDeleted = true;
                    console.log(`Archivo eliminado de procesados: ${filePath}`);
                    break;
                  }
                }
              }
            }
          }
          
          // Si encontramos el archivo, no necesitamos buscar en otras ubicaciones
          if (fileDeleted) break;
        
        } // Cierre del bucle for sobre baseDirs
        
        if (!fileDeleted) {
          console.warn(`No se encontró el archivo físico para eliminar: ${activity.filename}`);
        }
      } catch (fileErr) {
        console.warn("No se pudo eliminar el archivo físico:", fileErr);
        // No detener la operación si el archivo no se puede eliminar
      }
      
      res.json({ success: result, message: "Actividad eliminada correctamente" });
    } catch (err) {
      console.error("Error eliminando actividad:", err);
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
  
  // Obtener datos de Excel por ID de actividad de archivo
  app.get("/api/excel-data/by-activity/:fileActivityId", async (req, res, next) => {
    try {
      console.log("Ruta getExcelDataByFileActivityId solicitada con fileActivityId:", req.params.fileActivityId);
      const fileActivityId = parseInt(req.params.fileActivityId);
      if (isNaN(fileActivityId)) {
        console.error("El ID de actividad de archivo no es un número válido:", req.params.fileActivityId);
        return res.status(400).json({ message: "El ID de actividad de archivo debe ser un número" });
      }
      
      // Vamos a verificar primero que esta actividad de archivo existe
      const fileActivity = await storage.getFileActivity(fileActivityId);
      if (!fileActivity) {
        console.error(`No se encontró la actividad de archivo con ID ${fileActivityId}`);
        return res.status(404).json({ message: "Actividad de archivo no encontrada" });
      }
      
      console.log(`Actividad de archivo encontrada: ${fileActivity.id}, tipo: ${fileActivity.fileType}`);
      
      const data = await storage.getExcelDataByFileActivityId(fileActivityId);
      console.log(`Datos de Excel recuperados: ${data.length} registros`);
      res.json(data);
    } catch (err) {
      console.error("Error al obtener datos de Excel por fileActivityId:", err);
      next(err);
    }
  });
  
  // Excel advanced search route for Purchase Control
  app.post("/api/search/excel-data/advanced", async (req, res, next) => {
    try {
      console.log("Búsqueda recibida:", req.body);
      
      // Extract all filters from the body
      const {
        query = "",
        storeCode,
        dateFrom,
        dateTo,
        orderNumber,
        customerName,
        customerContact,
        customerLocation, // Añadido: provincia/país
        itemDetails,
        metals,
        engravings,
        stones,
        price,
        priceOperator = "=",
        onlyAlerts = false
      } = req.body;
      
      // Verificamos si es búsqueda simple (solo tiene la propiedad query)
      const isSimpleSearch = Object.keys(req.body).length === 1 && query;
      
      // Preparar filtros
      const filters: any = {};
      
      // Agregar filtros solo si no es una búsqueda simple
      if (!isSimpleSearch) {
        // Agregar filtros de búsqueda avanzada
        if (storeCode && storeCode !== "all") filters.storeCode = storeCode;
        
        // Filtros de fecha
        if (dateFrom) filters.fromDate = new Date(dateFrom).toISOString();
        if (dateTo) filters.toDate = new Date(dateTo).toISOString();
        
        // Filtros específicos por campo
        if (orderNumber) filters.orderNumber = orderNumber;
        if (customerName) filters.customerName = customerName;
        if (customerContact) filters.customerContact = customerContact;
        if (customerLocation) filters.customerLocation = customerLocation; // Añadido: filtro de provincia/país
        if (itemDetails) filters.itemDetails = itemDetails;
        if (metals) filters.metals = metals;
        if (engravings) filters.engravings = engravings;
        if (stones) filters.stones = stones;
        
        // Manejar filtrado de precios con operadores
        if (price && !isNaN(parseFloat(price))) {
          const numericPrice = parseFloat(price);
          switch (priceOperator) {
            case ">":
              filters.priceMin = numericPrice;
              break;
            case "<":
              filters.priceMax = numericPrice;
              break;
            case ">=":
              filters.priceMin = numericPrice;
              filters.priceIncludeEqual = true;
              break;
            case "<=":
              filters.priceMax = numericPrice;
              filters.priceIncludeEqual = true;
              break;
            case "=":
            default:
              filters.priceExact = numericPrice;
              break;
          }
        }
      }
      
      // Ejecutar la búsqueda con los filtros configurados
      console.log(`Realizando búsqueda ${isSimpleSearch ? 'simple' : 'avanzada'} con:`, { query, filters });
      let results = await storage.searchExcelData(query, filters);
      
      console.log(`Búsqueda completada. Encontrados ${results.length} resultados`);
      
      // Si necesitamos filtrar por alertas, obtener alertas para cada registro
      if (onlyAlerts && !isSimpleSearch) {
        try {
          // Obtener todas las alertas
          const allAlerts = await storage.getAlerts();
          
          // Obtener todos los IDs de excelData que tienen alertas
          const excelDataIdsWithAlerts = new Set(
            allAlerts.map(alert => alert.excelDataId)
          );
          
          // Filtrar resultados a solo aquellos con alertas
          results = results.filter(record => excelDataIdsWithAlerts.has(record.id));
          console.log(`Filtrado por alertas completado. Quedan ${results.length} resultados`);
        } catch (alertError) {
          console.error("Error al filtrar por alertas:", alertError);
          // Continuar con los resultados sin filtrar
        }
      }
      
      // Para cada resultado, verificar si tiene alertas y agregar una propiedad hasAlerts
      let resultsWithAlertFlags = results;
      
      try {
        const allAlerts = await storage.getAlerts();
        resultsWithAlertFlags = results.map(record => {
          const recordAlerts = allAlerts.filter(alert => alert.excelDataId === record.id);
          return {
            ...record,
            hasAlerts: recordAlerts.length > 0
          };
        });
      } catch (alertError) {
        console.error("Error al obtener alertas para los resultados:", alertError);
        // En caso de error, continuamos con los resultados originales
        resultsWithAlertFlags = results.map(record => ({
          ...record,
          hasAlerts: false
        }));
      }
      
      // Agregar búsqueda al historial si el usuario está autenticado
      if (req.isAuthenticated() && query.trim()) {
        try {
          // Usar "General" como tipo de búsqueda por defecto
          const searchEntry: any = {
            userId: req.user!.id,
            searchType: "General",
            searchTerms: query || (isSimpleSearch ? "" : "Búsqueda avanzada"),
            searchDate: new Date(),
            resultCount: results.length,
            filters: isSimpleSearch ? "{}" : JSON.stringify(filters)
          };
          
          await storage.addSearchHistory(searchEntry);
        } catch (historyError) {
          console.error("Error al guardar historial de búsqueda:", historyError);
        }
      }
      
      // Devolver resultados con información sobre alertas
      return res.json({
        results: resultsWithAlertFlags,
        count: resultsWithAlertFlags.length,
        searchType: isSimpleSearch ? "simple" : "advanced"
      });
    } catch (err) {
      console.error("Error en la búsqueda:", err);
      res.status(500).json({ 
        error: "Error al realizar la búsqueda", 
        message: err instanceof Error ? err.message : "Error desconocido" 
      });
    }
  });
  
  // Original Excel search route
  app.get("/api/search/excel-data", async (req, res, next) => {
    try {
      // Extract query parameters
      const searchType = req.query.searchType as string || 'General';
      const searchTerms = req.query.searchTerms as string;
      const storeCode = req.query.storeCode as string;
      
      // Optional date filters
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string).toISOString() : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string).toISOString() : undefined;
      
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
  
  // Ruta para búsqueda avanzada de documentos PDF
  app.get("/api/pdf-documents/search", async (req, res, next) => {
    try {
      const {
        storeCode,
        storeName,
        district,
        locality,
        dateFrom,
        dateTo
      } = req.query;
      
      // Obtener primero las tiendas que coinciden con los criterios
      let matchingStores = await storage.getStores();
      
      // Filtrar tiendas por los criterios
      if (storeCode) {
        matchingStores = matchingStores.filter(store => 
          store.code.toLowerCase().includes((storeCode as string).toLowerCase()));
      }
      
      if (storeName) {
        matchingStores = matchingStores.filter(store => 
          store.name.toLowerCase().includes((storeName as string).toLowerCase()));
      }
      
      // location ya no se usa, se filtran por district y locality
      
      if (district) {
        matchingStores = matchingStores.filter(store => 
          store.district && store.district.toLowerCase().includes((district as string).toLowerCase()));
      }
      
      if (locality) {
        matchingStores = matchingStores.filter(store => 
          store.locality && store.locality.toLowerCase().includes((locality as string).toLowerCase()));
      }
      
      // Extraer los códigos de tienda que coinciden
      const storeCodesArray = matchingStores.map(store => store.code);
      
      // Si no hay tiendas coincidentes, devolver array vacío
      if (storeCodesArray.length === 0) {
        return res.json([]);
      }
      
      // Obtener documentos PDF basados en los códigos de tienda y fechas
      const documents = await storage.searchPdfDocuments({
        storeCodes: storeCodesArray,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined
      });
      
      // Enriquecer los resultados con información de tienda
      const enrichedDocuments = documents.map(doc => {
        const store = matchingStores.find(s => s.code === doc.storeCode);
        return {
          ...doc,
          storeName: store?.name || 'Desconocida',
          storeDistrict: store?.district || null,
          storeLocality: store?.locality || null
        };
      });
      
      res.json(enrichedDocuments);
    } catch (err) {
      console.error("Error en búsqueda de documentos PDF:", err);
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
      
      // Create file activity entry - asegurarnos de que la fecha sea una cadena para SQLite
      const processingDate = new Date().toISOString();
      
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode: defaultStoreCode,
        fileType: 'Excel',
        status: 'Pending',
        processingDate,
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
          const processingDate = new Date().toISOString();
          
          const activity = await storage.createFileActivity({
            filename: file.originalname,
            storeCode: defaultStoreCode, // Se actualizará durante el procesamiento
            fileType: 'Excel',
            status: 'Pending',
            processingDate,
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
      const processingDate = new Date().toISOString();
      
      const activity = await storage.createFileActivity({
        filename: req.file.originalname,
        storeCode,
        fileType: 'PDF',
        status: 'Pending',
        processingDate,
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
          const processingDate = new Date().toISOString();
          
          const activity = await storage.createFileActivity({
            filename: file.originalname,
            storeCode, // Usamos el código de tienda proporcionado o el predeterminado
            fileType: 'PDF',
            status: 'Pending',
            processingDate,
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
      const [excelStores, pdfStores, recentActivities, allStores] = await Promise.all([
        storage.getStoresByType('Excel'),
        storage.getStoresByType('PDF'),
        storage.getRecentFileActivities(100),
        storage.getStores()
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
      
      // Count failed files
      const failedFiles = recentActivities.filter(activity => 
        activity.status === 'Failed'
      ).length;
      
      console.log(`DEBUG: Conteo de archivos fallidos: ${failedFiles}`);
      console.log(`DEBUG: Actividades con status 'Failed':`, 
        recentActivities.filter(activity => activity.status === 'Failed')
          .map(act => ({id: act.id, filename: act.filename}))
      );
      
      // Calcula tiendas críticas (sin actividad en el último mes)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      // Crear un mapa de las últimas actividades por tienda
      const storeLastActivityMap: Record<string, Date> = {};
      
      recentActivities.forEach(activity => {
        if (activity.storeCode && activity.status === 'Processed') {
          const activityDate = new Date(activity.processingDate);
          // Si la tienda no tiene fecha o la fecha actual es más reciente, actualizar
          if (
            !storeLastActivityMap[activity.storeCode] || 
            activityDate > storeLastActivityMap[activity.storeCode]
          ) {
            storeLastActivityMap[activity.storeCode] = activityDate;
          }
        }
      });
      
      // Contar cuántas tiendas activas no tienen actividad reciente
      const criticalStores = allStores.filter(store => {
        // Solo considerar tiendas activas
        if (!store.active) return false;
        
        // Si no hay registro de actividad o la última actividad es anterior a un mes
        const lastActivity = storeLastActivityMap[store.code];
        return !lastActivity || lastActivity < oneMonthAgo;
      });
      
      // Check if file watchers are enabled
      const fileProcessingConfig = await storage.getConfig('FILE_PROCESSING_ENABLED');
      const fileWatchingActive = fileProcessingConfig?.value === 'true';
      
      // Calcular el tamaño de la base de datos SQLite (en porcentaje respecto a 1TB máximo)
      const getDatabaseSize = async () => {
        try {
          // Obtener estadísticas del archivo de la BD (SQLite)
          const dbPath = process.env.DATABASE_PATH || './aureo_app/datos.sqlite';
          const stats = await fs.promises.stat(dbPath);
          const sizeInBytes = stats.size;
          const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
          
          // Calcular porcentaje relativo a 1TB
          // 1TB = 1024GB, por lo que el porcentaje sería (tamaño en GB / 1024) * 100
          const percentageOfMaxSize = (sizeInGB / 1024) * 100;
          
          // Redondear a 2 decimales
          return Math.round(percentageOfMaxSize * 100) / 100;
        } catch (error) {
          console.error("Error al obtener el tamaño de la base de datos:", error);
          return 0; // Valor por defecto en caso de error
        }
      };
      
      const databaseSize = await getDatabaseSize();
      
      res.json({
        totalStores: excelStores.length + pdfStores.length,
        excelStores: excelStores.length,
        pdfStores: pdfStores.length,
        criticalStores: criticalStores.length,
        processedToday,
        pendingFiles,
        failedFiles,
        fileWatchingActive,
        lastSystemCheck: new Date().toISOString(),
        databaseSize
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
            from: fromDate || null,
            to: toDate || null
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
  
  // Endpoint para verificar contraseña de administrador (utilizado para operaciones destructivas)
  app.post("/api/verify-admin-password", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Se requiere contraseña" });
      }
      
      const isValid = await verifyAdminPassword(req.user.id, password);
      
      if (!isValid) {
        return res.status(403).json({ error: "Contraseña incorrecta o usuario no tiene permisos de administrador" });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error al verificar contraseña de administrador:", error);
      res.status(500).json({ error: "Error al verificar contraseña" });
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
  
  // ===== ENDPOINTS PARA SEÑALAMIENTOS =====
  
  // 1. Endpoints para Señalamientos de Personas
  app.get("/api/senalamiento/personas", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Por defecto solo mostrar activos, a menos que se indique lo contrario
        const incluirInactivos = req.query.incluirInactivos === "true";
        
        const personas = await storage.getSenalPersonas(incluirInactivos);
        res.json(personas);
      } catch (error) {
        console.error("Error al obtener señalamientos de personas:", error);
        next(error);
      }
    });
  });
  
  app.post("/api/senalamiento/personas", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const data = req.body;
        
        // Validar datos requeridos
        if (!data.nombre && !data.documentoId) {
          return res.status(400).json({ error: "Debe proporcionar al menos un nombre o un documento de identidad" });
        }
        
        // Agregar ID del usuario creador
        const senalPersona: InsertSenalPersona = {
          ...data,
          // Si el nombre es una cadena vacía, establecerlo como null para la base de datos
          nombre: data.nombre || null,
          creadoPor: req.user!.id
        };
        
        const nuevaPersona = await storage.createSenalPersona(senalPersona);
        res.status(201).json(nuevaPersona);
      } catch (error) {
        console.error("Error al crear señalamiento de persona:", error);
        next(error);
      }
    });
  });
  
  app.get("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const persona = await storage.getSenalPersona(id);
        if (!persona) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        res.json(persona);
      } catch (error) {
        console.error(`Error al obtener señalamiento de persona con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.put("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Obtener el señalamiento para verificar permisos
        const persona = await storage.getSenalPersona(id);
        if (!persona) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        // Si es Admin (no SuperAdmin), solo puede editar sus propios señalamientos
        if (req.user!.role === "Admin" && persona.creadoPor !== req.user!.id) {
          return res.status(403).json({ error: "Solo puedes modificar tus propios señalamientos" });
        }
        
        const data = req.body;
        
        // Validar datos requeridos
        if (!data.nombre && !data.documentoId) {
          return res.status(400).json({ error: "Debe proporcionar al menos un nombre o un documento de identidad" });
        }
        
        // Agregar ID del usuario que modifica
        const updates: Partial<SenalPersona> = {
          ...data,
          // Si el nombre es una cadena vacía, establecerlo como null para la base de datos
          nombre: data.nombre || null,
          modificadoPor: req.user!.id
        };
        
        const personaActualizada = await storage.updateSenalPersona(id, updates);
        if (!personaActualizada) {
          return res.status(404).json({ error: "No se pudo actualizar el señalamiento" });
        }
        
        res.json(personaActualizada);
      } catch (error) {
        console.error(`Error al actualizar señalamiento de persona con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.delete("/api/senalamiento/personas/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Obtener el señalamiento para verificar permisos
        const persona = await storage.getSenalPersona(id);
        if (!persona) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        // Si es Admin (no SuperAdmin), solo puede eliminar sus propios señalamientos
        if (req.user!.role === "Admin" && persona.creadoPor !== req.user!.id) {
          return res.status(403).json({ error: "Solo puedes eliminar tus propios señalamientos" });
        }
        
        const resultado = await storage.deleteSenalPersona(id, req.user!.id);
        if (!resultado) {
          return res.status(404).json({ error: "No se pudo eliminar el señalamiento" });
        }
        
        res.json({ success: true, message: "Señalamiento eliminado correctamente" });
      } catch (error) {
        console.error(`Error al eliminar señalamiento de persona con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.get("/api/senalamiento/personas/buscar/:query", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const query = req.params.query || "";
        
        const personas = await storage.searchSenalPersonas(query);
        res.json(personas);
      } catch (error) {
        console.error(`Error al buscar señalamientos de personas con query ${req.params.query}:`, error);
        next(error);
      }
    });
  });
  
  // 2. Endpoints para Señalamientos de Objetos
  app.get("/api/senalamiento/objetos", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Por defecto solo mostrar activos, a menos que se indique lo contrario
        const incluirInactivos = req.query.incluirInactivos === "true";
        
        const objetos = await storage.getSenalObjetos(incluirInactivos);
        res.json(objetos);
      } catch (error) {
        console.error("Error al obtener señalamientos de objetos:", error);
        next(error);
      }
    });
  });
  
  app.post("/api/senalamiento/objetos", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const data = req.body;
        
        // Validar que al menos uno de los campos tenga información
        if (!data.descripcion && !data.grabacion && !data.notas) {
          return res.status(400).json({ error: "Debe proporcionar al menos una descripción, grabación o notas" });
        }
        
        // Agregar ID del usuario creador
        const senalObjeto: InsertSenalObjeto = {
          ...data,
          // Si la descripción es una cadena vacía, establecerla como null para la base de datos
          descripcion: data.descripcion || null,
          creadoPor: req.user!.id
        };
        
        const nuevoObjeto = await storage.createSenalObjeto(senalObjeto);
        res.status(201).json(nuevoObjeto);
      } catch (error) {
        console.error("Error al crear señalamiento de objeto:", error);
        next(error);
      }
    });
  });
  
  app.get("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const objeto = await storage.getSenalObjeto(id);
        if (!objeto) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        res.json(objeto);
      } catch (error) {
        console.error(`Error al obtener señalamiento de objeto con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.put("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Obtener el señalamiento para verificar permisos
        const objeto = await storage.getSenalObjeto(id);
        if (!objeto) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        // Si es Admin (no SuperAdmin), solo puede editar sus propios señalamientos
        if (req.user!.role === "Admin" && objeto.creadoPor !== req.user!.id) {
          return res.status(403).json({ error: "Solo puedes modificar tus propios señalamientos" });
        }
        
        const data = req.body;
        
        // Validar que al menos uno de los campos tenga información
        if (!data.descripcion && !data.grabacion && !data.notas) {
          return res.status(400).json({ error: "Debe proporcionar al menos una descripción, grabación o notas" });
        }
        
        // Agregar ID del usuario que modifica
        const updates: Partial<SenalObjeto> = {
          ...data,
          // Si la descripción es una cadena vacía, establecerla como null para la base de datos
          descripcion: data.descripcion || null,
          modificadoPor: req.user!.id
        };
        
        const objetoActualizado = await storage.updateSenalObjeto(id, updates);
        if (!objetoActualizado) {
          return res.status(404).json({ error: "No se pudo actualizar el señalamiento" });
        }
        
        res.json(objetoActualizado);
      } catch (error) {
        console.error(`Error al actualizar señalamiento de objeto con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.delete("/api/senalamiento/objetos/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Obtener el señalamiento para verificar permisos
        const objeto = await storage.getSenalObjeto(id);
        if (!objeto) {
          return res.status(404).json({ error: "Señalamiento no encontrado" });
        }
        
        // Si es Admin (no SuperAdmin), solo puede eliminar sus propios señalamientos
        if (req.user!.role === "Admin" && objeto.creadoPor !== req.user!.id) {
          return res.status(403).json({ error: "Solo puedes eliminar tus propios señalamientos" });
        }
        
        const resultado = await storage.deleteSenalObjeto(id, req.user!.id);
        if (!resultado) {
          return res.status(404).json({ error: "No se pudo eliminar el señalamiento" });
        }
        
        res.json({ success: true, message: "Señalamiento eliminado correctamente" });
      } catch (error) {
        console.error(`Error al eliminar señalamiento de objeto con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.get("/api/senalamiento/objetos/buscar/:query", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const query = req.params.query || "";
        
        const objetos = await storage.searchSenalObjetos(query);
        res.json(objetos);
      } catch (error) {
        console.error(`Error al buscar señalamientos de objetos con query ${req.params.query}:`, error);
        next(error);
      }
    });
  });
  
  // 3. Endpoints para Coincidencias
  app.get("/api/coincidencias", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        // Convertir los valores del frontend al formato de la base de datos
        let estado: "NoLeido" | "Leido" | "Descartado" | undefined = undefined;
        
        if (req.query.estado === "noleidas") {
          estado = "NoLeido";
        } else if (req.query.estado === "leidas") {
          estado = "Leido";
        } else if (req.query.estado === "descartadas") {
          estado = "Descartado";
        } else if (req.query.estado === "all") {
          estado = undefined; // Todas
        } else if (req.query.estado) {
          estado = req.query.estado as any; // Si ya viene en el formato correcto
        }
        
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        
        console.log(`Buscando coincidencias con estado: ${estado || 'todas'}`);
        const coincidencias = await storage.getCoincidencias(estado, limit);
        console.log(`Encontradas ${coincidencias.length} coincidencias`);
        
        // Enriquecer las coincidencias con la información de la orden
        const coincidenciasEnriquecidas = await Promise.all(coincidencias.map(async (coincidencia) => {
          try {
            // Obtener la información de los datos de Excel
            const excelData = await storage.getExcelDataById(coincidencia.idExcelData);
            
            // Obtener información de la tienda
            let storeName = "";
            if (excelData && excelData.storeCode) {
              const store = await storage.getStoreByCode(excelData.storeCode);
              if (store) {
                storeName = store.name;
              }
            }
            
            // Obtener datos de señalamientos si corresponde
            let nombrePersona = undefined;
            let descripcionObjeto = undefined;
            let interesado = undefined;
            let notas = undefined;
            if (coincidencia.tipoCoincidencia === "Persona" && coincidencia.idSenalPersona) {
              const persona = await storage.getSenalPersona(coincidencia.idSenalPersona);
              if (persona) {
                nombrePersona = persona.nombre;
                interesado = persona.interesado;
                notas = persona.notas;
              }
            } else if (coincidencia.tipoCoincidencia === "Objeto" && coincidencia.idSenalObjeto) {
              const objeto = await storage.getSenalObjeto(coincidencia.idSenalObjeto);
              if (objeto) {
                descripcionObjeto = objeto.descripcion;
                interesado = objeto.interesado;
                notas = objeto.notas;
              }
            }
            
            // Enriquecer la coincidencia con la información obtenida
            return {
              ...coincidencia,
              nombrePersona,
              descripcionObjeto,
              interesado,
              notas,
              ordenInfo: excelData ? {
                storeCode: excelData.storeCode || "",
                storeName: storeName,
                orderNumber: excelData.orderNumber || "",
                orderDate: excelData.orderDate || "",
                customerName: excelData.customerName || ""
              } : {
                storeCode: "",
                storeName: "",
                orderNumber: "",
                orderDate: "",
                customerName: ""
              }
            };
          } catch (error) {
            console.error(`Error al enriquecer coincidencia ${coincidencia.id}:`, error);
            // Si hay error, devolver la coincidencia original con datos vacíos para ordenInfo
            return {
              ...coincidencia,
              ordenInfo: {
                storeCode: "",
                storeName: "",
                orderNumber: "",
                orderDate: "",
                customerName: ""
              }
            };
          }
        }));
        
        res.json(coincidenciasEnriquecidas);
      } catch (error) {
        console.error("Error al obtener coincidencias:", error);
        next(error);
      }
    });
  });
  
  app.get("/api/coincidencias/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const coincidencia = await storage.getCoincidencia(id);
        if (!coincidencia) {
          return res.status(404).json({ error: "Coincidencia no encontrada" });
        }
        
        // Enriquecer la coincidencia con la información de la orden
        try {
          // Obtener la información de los datos de Excel
          const excelData = await storage.getExcelDataById(coincidencia.idExcelData);
          
          // Obtener información de la tienda
          let storeName = "";
          if (excelData && excelData.storeCode) {
            const store = await storage.getStoreByCode(excelData.storeCode);
            if (store) {
              storeName = store.name;
            }
          }
          
          // Obtener datos de señalamientos si corresponde
          let nombrePersona = undefined;
          let descripcionObjeto = undefined;
          let interesado = undefined;
          let notas = undefined;
          
          if (coincidencia.tipoCoincidencia === "Persona" && coincidencia.idSenalPersona) {
            const persona = await storage.getSenalPersona(coincidencia.idSenalPersona);
            if (persona) {
              nombrePersona = persona.nombre;
              interesado = persona.interesado;
              notas = persona.notas;
            }
          } else if (coincidencia.tipoCoincidencia === "Objeto" && coincidencia.idSenalObjeto) {
            const objeto = await storage.getSenalObjeto(coincidencia.idSenalObjeto);
            if (objeto) {
              descripcionObjeto = objeto.descripcion;
              interesado = objeto.interesado;
              notas = objeto.notas;
            }
          }
          
          // Enriquecer la coincidencia con la información obtenida
          const coincidenciaEnriquecida = {
            ...coincidencia,
            nombrePersona,
            descripcionObjeto,
            interesado,
            notas,
            ordenInfo: excelData ? {
              storeCode: excelData.storeCode || "",
              storeName: storeName,
              orderNumber: excelData.orderNumber || "",
              orderDate: excelData.orderDate || "",
              customerName: excelData.customerName || ""
            } : {
              storeCode: "",
              storeName: "",
              orderNumber: "",
              orderDate: "",
              customerName: ""
            }
          };
          
          res.json(coincidenciaEnriquecida);
        } catch (error) {
          console.error(`Error al enriquecer coincidencia ${id}:`, error);
          // Si hay error, devolver la coincidencia original con datos vacíos para ordenInfo
          res.json({
            ...coincidencia,
            ordenInfo: {
              storeCode: "",
              storeName: "",
              orderNumber: "",
              orderDate: "",
              customerName: ""
            }
          });
        }
      } catch (error) {
        console.error(`Error al obtener coincidencia con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  app.put("/api/coincidencias/:id/estado", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Convertir los valores del frontend al formato de la base de datos
        let estado: "NoLeido" | "Leido" | "Descartado";
        
        if (req.body.estado === "noleida") {
          estado = "NoLeido";
        } else if (req.body.estado === "leida") {
          estado = "Leido";
        } else if (req.body.estado === "descartada") {
          estado = "Descartado";
        } else if (["NoLeido", "Leido", "Descartado"].includes(req.body.estado)) {
          estado = req.body.estado as "NoLeido" | "Leido" | "Descartado";
        } else {
          return res.status(400).json({ error: "Estado inválido" });
        }
        
        const { notas } = req.body;
        
        console.log(`Actualizando coincidencia ${id} a estado: ${estado}`);
        const coincidenciaActualizada = await storage.updateCoincidenciaEstado(
          id,
          estado,
          req.user!.id,
          notas
        );
        
        if (!coincidenciaActualizada) {
          return res.status(404).json({ error: "No se pudo actualizar la coincidencia" });
        }
        
        console.log(`Coincidencia ${id} actualizada correctamente`);
        res.json(coincidenciaActualizada);
      } catch (error) {
        console.error(`Error al actualizar estado de coincidencia con ID ${req.params.id}:`, error);
        next(error);
      }
    });
  });
  
  // Nuevo endpoint para marcar como leída
  app.post("/api/coincidencias/:id/leer", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const { notasRevision } = req.body;
        
        console.log(`Marcando coincidencia ${id} como leída`);
        const coincidenciaActualizada = await storage.updateCoincidenciaEstado(
          id,
          "Leido",
          req.user!.id,
          notasRevision
        );
        
        if (!coincidenciaActualizada) {
          return res.status(404).json({ error: "No se pudo actualizar la coincidencia" });
        }
        
        console.log(`Coincidencia ${id} marcada como leída correctamente`);
        res.json(coincidenciaActualizada);
      } catch (error) {
        console.error("Error al marcar coincidencia como leída:", error);
        next(error);
      }
    });
  });
  
  // Nuevo endpoint para descartar
  app.post("/api/coincidencias/:id/descartar", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const { notasRevision } = req.body;
        
        console.log(`Descartando coincidencia ${id}`);
        const coincidenciaActualizada = await storage.updateCoincidenciaEstado(
          id,
          "Descartado",
          req.user!.id,
          notasRevision
        );
        
        if (!coincidenciaActualizada) {
          return res.status(404).json({ error: "No se pudo descartar la coincidencia" });
        }
        
        console.log(`Coincidencia ${id} descartada correctamente`);
        res.json(coincidenciaActualizada);
      } catch (error) {
        console.error("Error al descartar coincidencia:", error);
        next(error);
      }
    });
  });
  
  app.get("/api/coincidencias/excel/:excelDataId", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const excelDataId = parseInt(req.params.excelDataId);
        if (isNaN(excelDataId)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const coincidencias = await storage.getCoincidenciasByExcelDataId(excelDataId);
        
        // Enriquecer las coincidencias con la información de la orden y señalamientos
        const coincidenciasEnriquecidas = await Promise.all(coincidencias.map(async (coincidencia) => {
          try {
            // El excelData ya lo tenemos por el ID
            const excelData = await storage.getExcelDataById(excelDataId);
            
            // Obtener información de la tienda
            let storeName = "";
            if (excelData && excelData.storeCode) {
              const store = await storage.getStoreByCode(excelData.storeCode);
              if (store) {
                storeName = store.name;
              }
            }
            
            // Obtener datos de señalamientos si corresponde
            let nombrePersona = undefined;
            let descripcionObjeto = undefined;
            let interesado = undefined;
            let notas = undefined;
            if (coincidencia.tipoCoincidencia === "Persona" && coincidencia.idSenalPersona) {
              const persona = await storage.getSenalPersona(coincidencia.idSenalPersona);
              if (persona) {
                nombrePersona = persona.nombre;
                interesado = persona.interesado;
                notas = persona.notas;
              }
            } else if (coincidencia.tipoCoincidencia === "Objeto" && coincidencia.idSenalObjeto) {
              const objeto = await storage.getSenalObjeto(coincidencia.idSenalObjeto);
              if (objeto) {
                descripcionObjeto = objeto.descripcion;
                interesado = objeto.interesado;
                notas = objeto.notas;
              }
            }
            
            // Enriquecer la coincidencia con la información obtenida
            return {
              ...coincidencia,
              nombrePersona,
              descripcionObjeto,
              interesado,
              notas,
              ordenInfo: excelData ? {
                storeCode: excelData.storeCode || "",
                storeName: storeName,
                orderNumber: excelData.orderNumber || "",
                orderDate: excelData.orderDate || "",
                customerName: excelData.customerName || ""
              } : {
                storeCode: "",
                storeName: "",
                orderNumber: "",
                orderDate: "",
                customerName: ""
              }
            };
          } catch (error) {
            console.error(`Error al enriquecer coincidencia ${coincidencia.id}:`, error);
            // Si hay error, devolver la coincidencia original con datos vacíos para ordenInfo
            return {
              ...coincidencia,
              ordenInfo: {
                storeCode: "",
                storeName: "",
                orderNumber: "",
                orderDate: "",
                customerName: ""
              }
            };
          }
        }));
        
        res.json(coincidenciasEnriquecidas);
      } catch (error) {
        console.error(`Error al obtener coincidencias para excelDataId ${req.params.excelDataId}:`, error);
        next(error);
      }
    });
  });
  
  app.get("/api/coincidencias/noleidas/count", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const count = await storage.getNumeroCoincidenciasNoLeidas();
        res.json({ count });
      } catch (error) {
        console.error("Error al obtener número de coincidencias no leídas:", error);
        next(error);
      }
    });
  });
  
  // Endpoint para eliminar una coincidencia
  app.delete("/api/coincidencias/:id", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        const result = await storage.deleteCoincidencia(id);
        if (result) {
          console.log(`Coincidencia ${id} eliminada correctamente`);
          return res.json({ success: true, message: `Coincidencia ${id} eliminada correctamente` });
        } else {
          console.log(`No se encontró la coincidencia ${id} para eliminar`);
          return res.status(404).json({ success: false, error: "No se encontró la coincidencia" });
        }
      } catch (error) {
        console.error("Error al eliminar coincidencia:", error);
        next(error);
      }
    });
  });
  
  // Endpoint para eliminar múltiples coincidencias en un lote
  app.post("/api/coincidencias/eliminar-lote", (req, res, next) => {
    req.authorize(["SuperAdmin", "Admin"])(req, res, async () => {
      try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: "Se requiere un array de IDs válido" 
          });
        }
        
        console.log(`Solicitud para eliminar coincidencias en lote: [${ids.join(', ')}]`);
        
        const result = await storage.deleteCoincidenciasPorLote(ids);
        
        console.log(`${result.borradas} de ${result.total} coincidencias eliminadas correctamente`);
        return res.json({ 
          success: true, 
          message: `${result.borradas} de ${result.total} coincidencias eliminadas correctamente`,
          borradas: result.borradas,
          total: result.total,
          deletedCount: result.borradas // Añadir para mantener compatibilidad con el frontend
        });
      } catch (error) {
        console.error("Error al eliminar coincidencias en lote:", error);
        next(error);
      }
    });
  });
  
  // 4. Endpoint para detectar coincidencias manualmente (para pruebas)
  app.post("/api/coincidencias/detectar/:excelDataId", (req, res, next) => {
    req.authorize(["SuperAdmin"])(req, res, async () => {
      try {
        const excelDataId = parseInt(req.params.excelDataId);
        if (isNaN(excelDataId)) {
          return res.status(400).json({ error: "ID inválido" });
        }
        
        // Ejecutar detección de coincidencias
        await storage.detectarCoincidencias(excelDataId);
        
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
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.mimetype === 'text/plain') {
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
