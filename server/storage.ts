import { 
  users, stores, systemConfigs, fileActivities, excelData, pdfDocuments,
  watchlistPersons, watchlistItems, alerts, searchHistory,
  type User, type InsertUser, type Store, type InsertStore, 
  type SystemConfig, type InsertSystemConfig, type FileActivity, 
  type InsertFileActivity, type ExcelData, type InsertExcelData,
  type PdfDocument, type InsertPdfDocument,
  type WatchlistPerson, type InsertWatchlistPerson,
  type WatchlistItem, type InsertWatchlistItem,
  type Alert, type InsertAlert,
  type SearchHistory, type InsertSearchHistory
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, desc, like, or, and, gte, lte, inArray, sql } from "drizzle-orm";
import { pool } from "./db";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Extend the interface with CRUD methods
export interface IStorage {
  // Session store
  sessionStore: any; // Using any to bypass type issues with express-session
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Store methods
  getStore(id: number): Promise<Store | undefined>;
  getStoreByCode(code: string): Promise<Store | undefined>;
  getStores(): Promise<Store[]>;
  getStoresByType(type: 'Excel' | 'PDF'): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, store: Partial<Store>): Promise<Store | undefined>;
  deleteStore(id: number): Promise<boolean>;
  
  // SystemConfig methods
  getConfig(key: string): Promise<SystemConfig | undefined>;
  getAllConfigs(): Promise<SystemConfig[]>;
  setConfig(config: InsertSystemConfig): Promise<SystemConfig>;
  updateConfig(key: string, value: string): Promise<SystemConfig | undefined>;
  
  // FileActivity methods
  createFileActivity(activity: InsertFileActivity): Promise<FileActivity>;
  getFileActivity(id: number): Promise<FileActivity | undefined>;
  updateFileActivityStatus(id: number, status: string, errorMessage?: string): Promise<FileActivity | undefined>;
  updateFileActivity(id: number, updates: Partial<FileActivity>): Promise<FileActivity | undefined>;
  getRecentFileActivities(limit: number): Promise<FileActivity[]>;
  getFileActivitiesByStore(storeCode: string): Promise<FileActivity[]>;
  getPendingStoreAssignmentActivities(): Promise<FileActivity[]>;
  deleteFileActivity(id: number): Promise<boolean>;
  
  // ExcelData methods
  createExcelData(data: InsertExcelData): Promise<ExcelData>;
  getExcelDataByStore(storeCode: string): Promise<ExcelData[]>;
  searchExcelData(query: string, filters?: any): Promise<ExcelData[]>;
  getExcelDataById(id: number): Promise<ExcelData | undefined>;
  deleteExcelDataByActivityId(activityId: number): Promise<boolean>;
  
  // PdfDocument methods
  createPdfDocument(doc: InsertPdfDocument): Promise<PdfDocument>;
  getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]>;
  getPdfDocument(id: number): Promise<PdfDocument | undefined>;
  deletePdfDocumentsByActivityId(activityId: number): Promise<boolean>;
  
  // Watchlist Person methods
  createWatchlistPerson(person: InsertWatchlistPerson): Promise<WatchlistPerson>;
  getWatchlistPersons(includeInactive?: boolean): Promise<WatchlistPerson[]>;
  getWatchlistPerson(id: number): Promise<WatchlistPerson | undefined>;
  updateWatchlistPerson(id: number, person: Partial<WatchlistPerson>): Promise<WatchlistPerson | undefined>;
  deleteWatchlistPerson(id: number): Promise<boolean>;
  searchWatchlistPersons(query: string): Promise<WatchlistPerson[]>;
  
  // Watchlist Item methods
  createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  getWatchlistItems(includeInactive?: boolean): Promise<WatchlistItem[]>;
  getWatchlistItem(id: number): Promise<WatchlistItem | undefined>;
  updateWatchlistItem(id: number, item: Partial<WatchlistItem>): Promise<WatchlistItem | undefined>;
  deleteWatchlistItem(id: number): Promise<boolean>;
  searchWatchlistItems(query: string): Promise<WatchlistItem[]>;
  
  // Alert methods
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlerts(status?: string, limit?: number): Promise<Alert[]>;
  getAlert(id: number): Promise<Alert | undefined>;
  updateAlertStatus(id: number, status: string, reviewedBy: number, notes?: string): Promise<Alert | undefined>;
  getAlertsByExcelDataId(excelDataId: number): Promise<Alert[]>;
  
  // Search History methods
  addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory>;
  getRecentSearches(userId: number, limit?: number): Promise<SearchHistory[]>;

  // Database cleaning methods
  purgeExcelStores(): Promise<{ count: number }>;
  purgePdfStores(): Promise<{ count: number }>;
  purgeAllStores(): Promise<{ count: number }>;
  purgeExcelData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }>;
  purgePdfData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }>;
  purgeFileActivities(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }>;
  purgeAllData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }>;
  purgeEntireDatabase(): Promise<{ tablesAffected: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private stores: Map<number, Store>;
  private systemConfigs: Map<string, SystemConfig>;
  private fileActivities: Map<number, FileActivity>;
  private excelData: Map<number, ExcelData>;
  private pdfDocuments: Map<number, PdfDocument>;
  private watchlistPersons: Map<number, WatchlistPerson>;
  private watchlistItems: Map<number, WatchlistItem>;
  private alerts: Map<number, Alert>;
  private searchHistories: Map<number, SearchHistory>;
  
  sessionStore: any; // Using any to bypass type issues with express-session
  
  private userId: number;
  private storeId: number;
  private configId: number;
  private activityId: number;
  private excelDataId: number;
  private pdfDocumentId: number;
  private watchlistPersonId: number;
  private watchlistItemId: number;
  private alertId: number;
  private searchHistoryId: number;

  constructor() {
    this.users = new Map();
    this.stores = new Map();
    this.systemConfigs = new Map();
    this.fileActivities = new Map();
    this.excelData = new Map();
    this.pdfDocuments = new Map();
    this.watchlistPersons = new Map();
    this.watchlistItems = new Map();
    this.alerts = new Map();
    this.searchHistories = new Map();
    
    this.userId = 1;
    this.storeId = 1;
    this.configId = 1;
    this.activityId = 1;
    this.excelDataId = 1;
    this.pdfDocumentId = 1;
    this.watchlistPersonId = 1;
    this.watchlistItemId = 1;
    this.alertId = 1;
    this.searchHistoryId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Create default super admin user
    this.createUser({
      username: "117020",
      password: "SuperAdmin", // This will be hashed in auth.ts
      name: "Administrador del Sistema",
      role: "SuperAdmin"
    });
    
    // Create default system configurations
    this.setConfig({
      key: "EXCEL_WATCH_DIR",
      value: "./data/excel",
      description: "Directory to watch for Excel files"
    });
    
    this.setConfig({
      key: "PDF_WATCH_DIR",
      value: "./data/pdf",
      description: "Directory to watch for PDF files"
    });
    
    this.setConfig({
      key: "FILE_PROCESSING_ENABLED",
      value: "true",
      description: "Enable or disable file processing"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userUpdate };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
  
  // Store methods
  async getStore(id: number): Promise<Store | undefined> {
    return this.stores.get(id);
  }
  
  async getStoreByCode(code: string): Promise<Store | undefined> {
    return Array.from(this.stores.values()).find(
      (store) => store.code === code
    );
  }
  
  async getStores(): Promise<Store[]> {
    return Array.from(this.stores.values());
  }
  
  async getStoresByType(type: 'Excel' | 'PDF'): Promise<Store[]> {
    return Array.from(this.stores.values()).filter(
      (store) => store.type === type
    );
  }
  
  async createStore(insertStore: InsertStore): Promise<Store> {
    const id = this.storeId++;
    const store: Store = { ...insertStore, id };
    this.stores.set(id, store);
    return store;
  }
  
  async updateStore(id: number, storeUpdate: Partial<Store>): Promise<Store | undefined> {
    const store = this.stores.get(id);
    if (!store) return undefined;
    
    const updatedStore = { ...store, ...storeUpdate };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }
  
  async deleteStore(id: number): Promise<boolean> {
    return this.stores.delete(id);
  }
  
  // SystemConfig methods
  async getConfig(key: string): Promise<SystemConfig | undefined> {
    return this.systemConfigs.get(key);
  }
  
  async getAllConfigs(): Promise<SystemConfig[]> {
    return Array.from(this.systemConfigs.values());
  }
  
  async setConfig(insertConfig: InsertSystemConfig): Promise<SystemConfig> {
    const id = this.configId++;
    const config: SystemConfig = { ...insertConfig, id };
    this.systemConfigs.set(config.key, config);
    return config;
  }
  
  async updateConfig(key: string, value: string): Promise<SystemConfig | undefined> {
    const config = this.systemConfigs.get(key);
    if (!config) return undefined;
    
    const updatedConfig = { ...config, value };
    this.systemConfigs.set(key, updatedConfig);
    return updatedConfig;
  }
  
  // FileActivity methods
  async createFileActivity(insertActivity: InsertFileActivity): Promise<FileActivity> {
    const id = this.activityId++;
    const activity: FileActivity = { ...insertActivity, id };
    this.fileActivities.set(id, activity);
    return activity;
  }
  
  async getFileActivity(id: number): Promise<FileActivity | undefined> {
    return this.fileActivities.get(id);
  }
  
  async updateFileActivityStatus(
    id: number, 
    status: string, 
    errorMessage?: string
  ): Promise<FileActivity | undefined> {
    const activity = this.fileActivities.get(id);
    if (!activity) return undefined;
    
    const updatedActivity = { 
      ...activity, 
      status, 
      ...(errorMessage && { errorMessage })
    };
    
    this.fileActivities.set(id, updatedActivity);
    return updatedActivity;
  }

  async updateFileActivity(
    id: number,
    updates: Partial<FileActivity>
  ): Promise<FileActivity | undefined> {
    const activity = this.fileActivities.get(id);
    if (!activity) return undefined;
    
    const updatedActivity = { 
      ...activity, 
      ...updates
    };
    
    this.fileActivities.set(id, updatedActivity);
    return updatedActivity;
  }
  
  async getRecentFileActivities(limit: number): Promise<FileActivity[]> {
    return Array.from(this.fileActivities.values())
      .sort((a, b) => {
        const dateA = new Date(a.processingDate).getTime();
        const dateB = new Date(b.processingDate).getTime();
        return dateB - dateA; // Sort in descending order (newest first)
      })
      .slice(0, limit);
  }
  
  async getFileActivitiesByStore(storeCode: string): Promise<FileActivity[]> {
    return Array.from(this.fileActivities.values())
      .filter(activity => activity.storeCode === storeCode)
      .sort((a, b) => {
        const dateA = new Date(a.processingDate).getTime();
        const dateB = new Date(b.processingDate).getTime();
        return dateB - dateA; // Sort in descending order (newest first)
      });
  }
  
  async getPendingStoreAssignmentActivities(): Promise<FileActivity[]> {
    return Array.from(this.fileActivities.values())
      .filter(activity => activity.status === 'PendingStoreAssignment')
      .sort((a, b) => {
        const dateA = new Date(a.processingDate).getTime();
        const dateB = new Date(b.processingDate).getTime();
        return dateB - dateA; // Sort in descending order (newest first)
      });
  }
  
  // ExcelData methods
  async createExcelData(insertData: InsertExcelData): Promise<ExcelData> {
    const id = this.excelDataId++;
    const data: ExcelData = { ...insertData, id };
    this.excelData.set(id, data);
    return data;
  }
  
  async getExcelDataByStore(storeCode: string): Promise<ExcelData[]> {
    return Array.from(this.excelData.values())
      .filter(data => data.storeCode === storeCode)
      .sort((a, b) => {
        const dateA = new Date(a.orderDate).getTime();
        const dateB = new Date(b.orderDate).getTime();
        return dateB - dateA; // Sort in descending order (newest first)
      });
  }
  
  // PdfDocument methods
  async createPdfDocument(insertDoc: InsertPdfDocument): Promise<PdfDocument> {
    const id = this.pdfDocumentId++;
    const doc: PdfDocument = { ...insertDoc, id };
    this.pdfDocuments.set(id, doc);
    return doc;
  }
  
  async getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]> {
    return Array.from(this.pdfDocuments.values())
      .filter(doc => doc.storeCode === storeCode)
      .sort((a, b) => {
        const dateA = new Date(a.uploadDate).getTime();
        const dateB = new Date(b.uploadDate).getTime();
        return dateB - dateA; // Sort in descending order (newest first)
      });
  }
  
  async getPdfDocument(id: number): Promise<PdfDocument | undefined> {
    return this.pdfDocuments.get(id);
  }
  
  async deleteFileActivity(id: number): Promise<boolean> {
    return this.fileActivities.delete(id);
  }
  
  async deleteExcelDataByActivityId(activityId: number): Promise<boolean> {
    // Buscar todos los registros de Excel con ese activityId
    const excelRecordsToDelete = Array.from(this.excelData.values())
      .filter(data => data.fileActivityId === activityId);
    
    // Eliminar cada registro encontrado
    for (const record of excelRecordsToDelete) {
      this.excelData.delete(record.id);
    }
    
    return true;
  }
  
  async deletePdfDocumentsByActivityId(activityId: number): Promise<boolean> {
    // Buscar todos los documentos PDF con ese activityId
    const pdfDocsToDelete = Array.from(this.pdfDocuments.values())
      .filter(doc => doc.fileActivityId === activityId);
    
    // Eliminar cada documento encontrado
    for (const doc of pdfDocsToDelete) {
      this.pdfDocuments.delete(doc.id);
    }
    
    return true;
  }
  
  // Implementación de nuevos métodos para cumplir con la interfaz
  
  // Excel Data Search and Lookup
  async searchExcelData(query: string, filters?: any): Promise<ExcelData[]> {
    console.log("searchExcelData llamado con:", { query, filters });
    const excelRecords = Array.from(this.excelData.values());
    console.log(`Total de registros disponibles: ${excelRecords.length}`);
    
    // Primera etapa de filtrado: prefiltrar por campos específicos si están presentes
    let prefilteredRecords = excelRecords;
    
    if (filters) {
      // Filtro por campos específicos de la búsqueda avanzada
      
      // Filtro por tienda (siempre aplicar primero este filtro si existe)
      if (filters.storeCode) {
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.storeCode === filters.storeCode
        );
        console.log(`Filtrado por tienda ${filters.storeCode}: ${prefilteredRecords.length} registros`);
      }
      
      // Filtro por número de orden
      if (filters.orderNumber) {
        const orderNumberSearch = filters.orderNumber.toLowerCase();
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.orderNumber && record.orderNumber.toLowerCase().includes(orderNumberSearch)
        );
        console.log(`Filtrado por número de orden: ${prefilteredRecords.length} registros`);
      }
      
      // Filtro por nombre del cliente
      if (filters.customerName) {
        const customerNameSearch = filters.customerName.toLowerCase();
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.customerName && record.customerName.toLowerCase().includes(customerNameSearch)
        );
        console.log(`Filtrado por nombre del cliente: ${prefilteredRecords.length} registros`);
      }
      
      // Filtro por contacto del cliente
      if (filters.customerContact) {
        const customerContactSearch = filters.customerContact.toLowerCase();
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.customerContact && record.customerContact.toLowerCase().includes(customerContactSearch)
        );
        console.log(`Filtrado por contacto del cliente: ${prefilteredRecords.length} registros`);
      }
      
      // Filtro por detalles del artículo
      if (filters.itemDetails) {
        const itemDetailsSearch = filters.itemDetails.toLowerCase();
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.itemDetails && record.itemDetails.toLowerCase().includes(itemDetailsSearch)
        );
        console.log(`Filtrado por detalles del artículo: ${prefilteredRecords.length} registros`);
      }
      
      // Filtro por metales
      if (filters.metals) {
        const metalsSearch = filters.metals.toLowerCase();
        prefilteredRecords = prefilteredRecords.filter(record => 
          record.metals && record.metals.toLowerCase().includes(metalsSearch)
        );
        console.log(`Filtrado por metales: ${prefilteredRecords.length} registros`);
      }
    }
    
    // Segunda etapa: aplicar búsqueda general por texto si hay una consulta
    let filteredBySearch = prefilteredRecords;
    
    if (query && query.trim() !== '') {
      const searchTerms = query.toLowerCase();
      
      filteredBySearch = prefilteredRecords.filter(record => {
        // Usar solo los campos de búsqueda especificados o todos por defecto
        if (filters && filters.searchType) {
          switch (filters.searchType) {
            case 'Cliente':
              return (
                (filters.searchCustomerName !== false && record.customerName && 
                record.customerName.toLowerCase().includes(searchTerms)) ||
                (filters.searchCustomerContact !== false && record.customerContact && 
                record.customerContact.toLowerCase().includes(searchTerms))
              );
            case 'Artículo':
              return (
                (filters.searchItemDetails !== false && record.itemDetails && 
                record.itemDetails.toLowerCase().includes(searchTerms)) ||
                (filters.searchMetals !== false && record.metals && 
                record.metals.toLowerCase().includes(searchTerms)) ||
                (filters.searchStones !== false && record.stones && 
                record.stones.toLowerCase().includes(searchTerms)) ||
                (filters.searchEngravings !== false && record.engravings && 
                record.engravings.toLowerCase().includes(searchTerms))
              );
            case 'Orden':
              return (
                (record.orderNumber && record.orderNumber.toLowerCase().includes(searchTerms)) ||
                (record.pawnTicket && record.pawnTicket.toLowerCase().includes(searchTerms))
              );
            case 'General':
            default:
              // Si es búsqueda general, usar todos los campos o los especificados
              return (
                (filters.searchCustomerName !== false && record.customerName && 
                record.customerName.toLowerCase().includes(searchTerms)) ||
                (filters.searchCustomerContact !== false && record.customerContact && 
                record.customerContact.toLowerCase().includes(searchTerms)) ||
                (record.orderNumber && record.orderNumber.toLowerCase().includes(searchTerms)) ||
                (filters.searchItemDetails !== false && record.itemDetails && 
                record.itemDetails.toLowerCase().includes(searchTerms)) ||
                (filters.searchMetals !== false && record.metals && 
                record.metals.toLowerCase().includes(searchTerms)) ||
                (filters.searchStones !== false && record.stones && 
                record.stones.toLowerCase().includes(searchTerms)) ||
                (filters.searchEngravings !== false && record.engravings && 
                record.engravings.toLowerCase().includes(searchTerms)) ||
                (record.pawnTicket && record.pawnTicket.toLowerCase().includes(searchTerms))
              );
          }
        } else {
          // Comportamiento por defecto (buscar en todos los campos)
          return (
            (record.customerName && record.customerName.toLowerCase().includes(searchTerms)) ||
            (record.customerContact && record.customerContact.toLowerCase().includes(searchTerms)) ||
            (record.orderNumber && record.orderNumber.toLowerCase().includes(searchTerms)) ||
            (record.itemDetails && record.itemDetails.toLowerCase().includes(searchTerms)) ||
            (record.metals && record.metals.toLowerCase().includes(searchTerms)) ||
            (record.engravings && record.engravings.toLowerCase().includes(searchTerms)) ||
            (record.pawnTicket && record.pawnTicket.toLowerCase().includes(searchTerms))
          );
        }
      });
      
      console.log(`Filtrado por términos de búsqueda '${searchTerms}': ${filteredBySearch.length} registros`);
    }
    
    // Tercera etapa: aplicar filtros de fechas y precios
    let result = filteredBySearch;
    
    if (filters) {
      // Filtro por rango de fechas
      if (filters.fromDate) {
        const fromDate = new Date(filters.fromDate).getTime();
        result = result.filter(record => {
          const recordDate = new Date(record.orderDate).getTime();
          return recordDate >= fromDate;
        });
        console.log(`Filtrado por fecha desde ${filters.fromDate}: ${result.length} registros`);
      }
      
      if (filters.toDate) {
        const toDate = new Date(filters.toDate).getTime();
        result = result.filter(record => {
          const recordDate = new Date(record.orderDate).getTime();
          return recordDate <= toDate;
        });
        console.log(`Filtrado por fecha hasta ${filters.toDate}: ${result.length} registros`);
      }
      
      // Filtro por precio
      if (filters.price) {
        const priceValue = parseFloat(filters.price);
        if (!isNaN(priceValue)) {
          switch (filters.priceOperator) {
            case ">":
              result = result.filter(record => {
                const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
                return !isNaN(recordPrice) && recordPrice > priceValue;
              });
              break;
            case "<":
              result = result.filter(record => {
                const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
                return !isNaN(recordPrice) && recordPrice < priceValue;
              });
              break;
            case ">=":
              result = result.filter(record => {
                const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
                return !isNaN(recordPrice) && recordPrice >= priceValue;
              });
              break;
            case "<=":
              result = result.filter(record => {
                const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
                return !isNaN(recordPrice) && recordPrice <= priceValue;
              });
              break;
            case "=":
            default:
              result = result.filter(record => {
                const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
                return !isNaN(recordPrice) && Math.abs(recordPrice - priceValue) < 0.01; // Comparación con tolerancia
              });
              break;
          }
          console.log(`Filtrado por precio ${filters.priceOperator} ${priceValue}: ${result.length} registros`);
        }
      }
      
      // Filtro por rango de precios (modo antiguo, mantener por compatibilidad)
      if (filters.priceMin) {
        const minPrice = parseFloat(filters.priceMin);
        if (!isNaN(minPrice)) {
          result = result.filter(record => {
            const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
            return !isNaN(recordPrice) && recordPrice >= minPrice;
          });
          console.log(`Filtrado por precio mínimo ${minPrice}: ${result.length} registros`);
        }
      }
      
      if (filters.priceMax) {
        const maxPrice = parseFloat(filters.priceMax);
        if (!isNaN(maxPrice)) {
          result = result.filter(record => {
            const recordPrice = parseFloat(record.price.replace(/[^0-9.-]+/g, ""));
            return !isNaN(recordPrice) && recordPrice <= maxPrice;
          });
          console.log(`Filtrado por precio máximo ${maxPrice}: ${result.length} registros`);
        }
      }
      
      // Filtrar artículos vendidos o no vendidos
      if (filters.includeArchived === false) {
        result = result.filter(record => !record.saleDate);
        console.log(`Filtrado por no vendidos: ${result.length} registros`);
      }
    }
    
    console.log(`Resultado final: ${result.length} registros`);
    
    // Ordenamos por fecha de orden, más reciente primero
    return result.sort((a, b) => {
      const dateA = new Date(a.orderDate).getTime();
      const dateB = new Date(b.orderDate).getTime();
      return dateB - dateA;
    });
  }
  
  async getExcelDataById(id: number): Promise<ExcelData | undefined> {
    return this.excelData.get(id);
  }
  
  // Watchlist Person methods
  async createWatchlistPerson(person: InsertWatchlistPerson): Promise<WatchlistPerson> {
    const id = this.watchlistPersonId++;
    const watchlistPerson: WatchlistPerson = { 
      ...person, 
      id,
      status: person.status || "Activo",
      riskLevel: person.riskLevel || "Medio",
      createdAt: new Date(),
      lastUpdated: null
    };
    this.watchlistPersons.set(id, watchlistPerson);
    return watchlistPerson;
  }
  
  async getWatchlistPersons(includeInactive: boolean = false): Promise<WatchlistPerson[]> {
    const persons = Array.from(this.watchlistPersons.values());
    
    if (!includeInactive) {
      return persons.filter(person => person.status === "Activo")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    return persons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getWatchlistPerson(id: number): Promise<WatchlistPerson | undefined> {
    return this.watchlistPersons.get(id);
  }
  
  async updateWatchlistPerson(id: number, personUpdate: Partial<WatchlistPerson>): Promise<WatchlistPerson | undefined> {
    const person = this.watchlistPersons.get(id);
    if (!person) return undefined;
    
    const updatedPerson = { 
      ...person, 
      ...personUpdate,
      lastUpdated: new Date()
    };
    
    this.watchlistPersons.set(id, updatedPerson);
    return updatedPerson;
  }
  
  async deleteWatchlistPerson(id: number): Promise<boolean> {
    // En lugar de eliminar, marcamos como inactivo
    const person = this.watchlistPersons.get(id);
    if (!person) return false;
    
    const updatedPerson = {
      ...person,
      status: "Inactivo",
      lastUpdated: new Date()
    };
    
    this.watchlistPersons.set(id, updatedPerson);
    return true;
  }
  
  async searchWatchlistPersons(query: string): Promise<WatchlistPerson[]> {
    const searchTerm = query.toLowerCase();
    
    return Array.from(this.watchlistPersons.values())
      .filter(person => 
        person.status === "Activo" && (
          (person.fullName && person.fullName.toLowerCase().includes(searchTerm)) ||
          (person.identificationNumber && person.identificationNumber.toLowerCase().includes(searchTerm)) ||
          (person.phone && person.phone.toLowerCase().includes(searchTerm))
        )
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Watchlist Item methods
  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.watchlistItemId++;
    const watchlistItem: WatchlistItem = { 
      ...item, 
      id,
      status: item.status || "Activo",
      riskLevel: item.riskLevel || "Medio",
      createdAt: new Date(),
      lastUpdated: null
    };
    this.watchlistItems.set(id, watchlistItem);
    return watchlistItem;
  }
  
  async getWatchlistItems(includeInactive: boolean = false): Promise<WatchlistItem[]> {
    const items = Array.from(this.watchlistItems.values());
    
    if (!includeInactive) {
      return items.filter(item => item.status === "Activo")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getWatchlistItem(id: number): Promise<WatchlistItem | undefined> {
    return this.watchlistItems.get(id);
  }
  
  async updateWatchlistItem(id: number, itemUpdate: Partial<WatchlistItem>): Promise<WatchlistItem | undefined> {
    const item = this.watchlistItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { 
      ...item, 
      ...itemUpdate,
      lastUpdated: new Date()
    };
    
    this.watchlistItems.set(id, updatedItem);
    return updatedItem;
  }
  
  async deleteWatchlistItem(id: number): Promise<boolean> {
    // En lugar de eliminar, marcamos como inactivo
    const item = this.watchlistItems.get(id);
    if (!item) return false;
    
    const updatedItem = {
      ...item,
      status: "Inactivo",
      lastUpdated: new Date()
    };
    
    this.watchlistItems.set(id, updatedItem);
    return true;
  }
  
  async searchWatchlistItems(query: string): Promise<WatchlistItem[]> {
    const searchTerm = query.toLowerCase();
    
    return Array.from(this.watchlistItems.values())
      .filter(item => 
        item.status === "Activo" && (
          (item.description && item.description.toLowerCase().includes(searchTerm)) ||
          (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm)) ||
          (item.model && item.model.toLowerCase().includes(searchTerm)) ||
          (item.brand && item.brand.toLowerCase().includes(searchTerm)) ||
          (item.identificationMarks && item.identificationMarks.toLowerCase().includes(searchTerm))
        )
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Alert methods
  async createAlert(alert: InsertAlert): Promise<Alert> {
    const id = this.alertId++;
    const newAlert: Alert = { 
      ...alert, 
      id,
      status: alert.status || "Nueva",
      createdAt: new Date(),
      resolvedAt: null
    };
    this.alerts.set(id, newAlert);
    return newAlert;
  }
  
  async getAlerts(status?: string, limit: number = 50): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());
    
    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }
    
    return alerts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  async getAlert(id: number): Promise<Alert | undefined> {
    return this.alerts.get(id);
  }
  
  async updateAlertStatus(
    id: number, 
    status: string, 
    reviewedBy: number,
    notes?: string
  ): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    
    const updatedAlert: Alert = { 
      ...alert, 
      status: status as "Nueva" | "Revisada" | "Falsa",
      reviewedBy,
      resolvedAt: new Date(),
      ...(notes && { reviewNotes: notes })
    };
    
    this.alerts.set(id, updatedAlert);
    return updatedAlert;
  }
  
  async getAlertsByExcelDataId(excelDataId: number): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.excelDataId === excelDataId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Search History methods
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    const id = this.searchHistoryId++;
    const history: SearchHistory = { 
      ...searchHistory, 
      id,
      searchDate: new Date()
    };
    this.searchHistories.set(id, history);
    return history;
  }
  
  async getRecentSearches(userId: number, limit: number = 10): Promise<SearchHistory[]> {
    return Array.from(this.searchHistories.values())
      .filter(history => history.userId === userId)
      .sort((a, b) => b.searchDate.getTime() - a.searchDate.getTime())
      .slice(0, limit);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // Métodos de purga de datos para superadministradores
  async purgeExcelStores(): Promise<{ count: number }> {
    try {
      // Obtener códigos de tiendas Excel
      const excelStores = await this.getStoresByType('Excel');
      const storeCodes = excelStores.map(store => store.code);
      
      // Primero eliminar datos relacionados
      let deletedCount = 0;
      if (storeCodes.length > 0) {
        // Eliminar datos de Excel
        const excelResult = await db.delete(excelData)
          .where(inArray(excelData.storeCode, storeCodes))
          .returning();
        deletedCount += excelResult.length;
        
        // Eliminar actividades de archivos
        const activityResult = await db.delete(fileActivities)
          .where(inArray(fileActivities.storeCode, storeCodes))
          .returning();
        deletedCount += activityResult.length;
        
        // Eliminar las tiendas
        const storeResult = await db.delete(stores)
          .where(inArray(stores.code, storeCodes))
          .returning();
        deletedCount += storeResult.length;
      }
      
      return { count: deletedCount };
    } catch (error) {
      console.error("Error eliminando tiendas Excel:", error);
      throw new Error("Error al eliminar tiendas Excel");
    }
  }
  
  async purgePdfStores(): Promise<{ count: number }> {
    try {
      // Obtener códigos de tiendas PDF
      const pdfStores = await this.getStoresByType('PDF');
      const storeCodes = pdfStores.map(store => store.code);
      
      // Primero eliminar datos relacionados
      let deletedCount = 0;
      if (storeCodes.length > 0) {
        // Eliminar documentos PDF
        const pdfResult = await db.delete(pdfDocuments)
          .where(inArray(pdfDocuments.storeCode, storeCodes))
          .returning();
        deletedCount += pdfResult.length;
        
        // Eliminar actividades de archivos
        const activityResult = await db.delete(fileActivities)
          .where(inArray(fileActivities.storeCode, storeCodes))
          .returning();
        deletedCount += activityResult.length;
        
        // Eliminar las tiendas
        const storeResult = await db.delete(stores)
          .where(inArray(stores.code, storeCodes))
          .returning();
        deletedCount += storeResult.length;
      }
      
      return { count: deletedCount };
    } catch (error) {
      console.error("Error eliminando tiendas PDF:", error);
      throw new Error("Error al eliminar tiendas PDF");
    }
  }
  
  async purgeAllStores(): Promise<{ count: number }> {
    try {
      // Primero eliminar datos relacionados
      const excelCount = await db.delete(excelData).returning().then(res => res.length);
      const pdfCount = await db.delete(pdfDocuments).returning().then(res => res.length);
      const activityCount = await db.delete(fileActivities).returning().then(res => res.length);
      const storeCount = await db.delete(stores).returning().then(res => res.length);
      
      const totalCount = excelCount + pdfCount + activityCount + storeCount;
      return { count: totalCount };
    } catch (error) {
      console.error("Error eliminando todas las tiendas:", error);
      throw new Error("Error al eliminar todas las tiendas");
    }
  }
  
  async purgeExcelData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }> {
    try {
      let query = db.delete(excelData);
      
      if (dateRange) {
        // Aplicar filtro de fechas si se proporciona
        if (dateRange.from) {
          query = query.where(gte(excelData.orderDate, dateRange.from));
        }
        if (dateRange.to) {
          query = query.where(lte(excelData.orderDate, dateRange.to));
        }
      }
      
      // Eliminar los registros y calcular el número
      const result = await query.returning();
      
      // También eliminar alertas asociadas con estos registros de Excel eliminados
      if (result.length > 0) {
        const excelIds = result.map(item => item.id);
        // Usar SQL directo para evitar problemas de nomenclatura de columnas
        await db.execute(sql`DELETE FROM "alerts" WHERE "exceldataid" IN (${sql.join(excelIds, sql`, `)})`);
      }
      
      return { count: result.length };
    } catch (error) {
      console.error("Error eliminando datos Excel:", error);
      throw new Error("Error al eliminar datos Excel");
    }
  }
  
  async purgePdfData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }> {
    try {
      let query = db.delete(pdfDocuments);
      
      if (dateRange) {
        // Aplicar filtro de fechas si se proporciona
        if (dateRange.from) {
          query = query.where(gte(pdfDocuments.uploadDate, dateRange.from));
        }
        if (dateRange.to) {
          query = query.where(lte(pdfDocuments.uploadDate, dateRange.to));
        }
      }
      
      // Eliminar los registros y calcular el número
      const result = await query.returning();
      return { count: result.length };
    } catch (error) {
      console.error("Error eliminando documentos PDF:", error);
      throw new Error("Error al eliminar documentos PDF");
    }
  }
  
  async purgeFileActivities(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }> {
    try {
      let query = db.delete(fileActivities);
      
      if (dateRange) {
        // Aplicar filtro de fechas si se proporciona
        if (dateRange.from) {
          query = query.where(gte(fileActivities.processingDate, dateRange.from));
        }
        if (dateRange.to) {
          query = query.where(lte(fileActivities.processingDate, dateRange.to));
        }
      }
      
      // Eliminar los registros y calcular el número
      const result = await query.returning();
      return { count: result.length };
    } catch (error) {
      console.error("Error eliminando actividades de archivos:", error);
      throw new Error("Error al eliminar actividades de archivos");
    }
  }
  
  async purgeAllData(dateRange?: { from: Date | null, to: Date | null }): Promise<{ count: number }> {
    try {
      // Eliminar todos los datos pero conservar las tiendas
      const excelCount = await this.purgeExcelData(dateRange);
      const pdfCount = await this.purgePdfData(dateRange);
      const activityCount = await this.purgeFileActivities(dateRange);
      
      // Eliminar también las alertas si no se eliminaron con los datos Excel
      let alertCount = 0;
      if (dateRange) {
        let query = db.delete(alerts);
        if (dateRange.from) {
          query = query.where(gte(alerts.createdAt, dateRange.from));
        }
        if (dateRange.to) {
          query = query.where(lte(alerts.createdAt, dateRange.to));
        }
        const result = await query.returning();
        alertCount = result.length;
      }
      
      const totalCount = excelCount.count + pdfCount.count + activityCount.count + alertCount;
      return { count: totalCount };
    } catch (error) {
      console.error("Error eliminando todos los datos:", error);
      throw new Error("Error al eliminar todos los datos");
    }
  }
  
  async purgeEntireDatabase(): Promise<{ tablesAffected: number }> {
    try {
      // Advertencia: Esto eliminará TODOS los datos de la base de datos
      // Primero eliminar tablas con dependencias
      await db.delete(alerts).execute();
      await db.delete(searchHistory).execute();
      await db.delete(excelData).execute();
      await db.delete(pdfDocuments).execute();
      await db.delete(fileActivities).execute();
      await db.delete(watchlistItems).execute();
      await db.delete(watchlistPersons).execute();
      await db.delete(stores).execute();
      await db.delete(systemConfigs).execute();
      
      // No eliminamos los usuarios para mantener el acceso al sistema
      
      // Crear las configuraciones predeterminadas nuevamente
      await this.setConfig({
        key: "EXCEL_WATCH_DIR",
        value: "./data/excel",
        description: "Directory to watch for Excel files"
      });
      
      await this.setConfig({
        key: "PDF_WATCH_DIR",
        value: "./data/pdf",
        description: "Directory to watch for PDF files"
      });
      
      await this.setConfig({
        key: "FILE_PROCESSING_ENABLED",
        value: "true",
        description: "Enable or disable file processing"
      });
      
      return { tablesAffected: 9 }; // 9 tablas afectadas
    } catch (error) {
      console.error("Error eliminando toda la base de datos:", error);
      throw new Error("Error al eliminar toda la base de datos");
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }
  
  // Store methods
  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }
  
  async getStoreByCode(code: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.code, code));
    return store;
  }
  
  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }
  
  async getStoresByType(type: 'Excel' | 'PDF'): Promise<Store[]> {
    return await db.select().from(stores).where(eq(stores.type, type));
  }
  
  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }
  
  async updateStore(id: number, storeUpdate: Partial<Store>): Promise<Store | undefined> {
    const [updatedStore] = await db
      .update(stores)
      .set(storeUpdate)
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }
  
  async deleteStore(id: number): Promise<boolean> {
    const result = await db.delete(stores).where(eq(stores.id, id));
    return result.rowCount > 0;
  }
  
  // SystemConfig methods
  async getConfig(key: string): Promise<SystemConfig | undefined> {
    const [config] = await db.select().from(systemConfigs).where(eq(systemConfigs.key, key));
    return config;
  }
  
  async getAllConfigs(): Promise<SystemConfig[]> {
    return await db.select().from(systemConfigs);
  }
  
  async setConfig(insertConfig: InsertSystemConfig): Promise<SystemConfig> {
    // Check if config exists
    const existingConfig = await this.getConfig(insertConfig.key);
    
    if (existingConfig) {
      return await this.updateConfig(insertConfig.key, insertConfig.value) as SystemConfig;
    }
    
    const [config] = await db.insert(systemConfigs).values(insertConfig).returning();
    return config;
  }
  
  async updateConfig(key: string, value: string): Promise<SystemConfig | undefined> {
    const [updatedConfig] = await db
      .update(systemConfigs)
      .set({ value })
      .where(eq(systemConfigs.key, key))
      .returning();
    return updatedConfig;
  }
  
  // FileActivity methods
  async createFileActivity(insertActivity: InsertFileActivity): Promise<FileActivity> {
    const [activity] = await db.insert(fileActivities).values(insertActivity).returning();
    return activity;
  }
  
  async getFileActivity(id: number): Promise<FileActivity | undefined> {
    const [activity] = await db.select().from(fileActivities).where(eq(fileActivities.id, id));
    return activity;
  }
  
  async updateFileActivityStatus(
    id: number, 
    status: string, 
    errorMessage?: string
  ): Promise<FileActivity | undefined> {
    const updateValues: Partial<FileActivity> = { 
      status: status as "Pending" | "Processing" | "Processed" | "Failed"
    };
    
    if (errorMessage) {
      updateValues.errorMessage = errorMessage;
    }
    
    const [updatedActivity] = await db
      .update(fileActivities)
      .set(updateValues)
      .where(eq(fileActivities.id, id))
      .returning();
    return updatedActivity;
  }
  
  async updateFileActivity(
    id: number,
    updates: Partial<FileActivity>
  ): Promise<FileActivity | undefined> {
    // Implementación del método para actualizar una actividad de archivo
    try {
      // Verificar que la actividad existe
      const activity = await this.getFileActivity(id);
      if (!activity) {
        console.warn(`No se encontró la actividad de archivo con ID ${id}`);
        return undefined;
      }
      
      // Actualizar la actividad con los nuevos valores
      const [updatedActivity] = await db
        .update(fileActivities)
        .set(updates)
        .where(eq(fileActivities.id, id))
        .returning();
      
      return updatedActivity;
    } catch (error) {
      console.error(`Error al actualizar la actividad de archivo ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteFileActivity(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(fileActivities)
        .where(eq(fileActivities.id, id))
        .returning({ id: fileActivities.id });
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error al eliminar la actividad de archivo ${id}:`, error);
      return false;
    }
  }
  
  async deleteExcelDataByActivityId(activityId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(excelData)
        .where(eq(excelData.fileActivityId, activityId))
        .returning({ id: excelData.id });
      
      return true; // Consideramos exitoso incluso si no hay registros, ya que el objetivo es eliminarlos
    } catch (error) {
      console.error(`Error al eliminar datos de Excel por activityId ${activityId}:`, error);
      return false;
    }
  }
  
  async deletePdfDocumentsByActivityId(activityId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(pdfDocuments)
        .where(eq(pdfDocuments.fileActivityId, activityId))
        .returning({ id: pdfDocuments.id });
      
      return true; // Consideramos exitoso incluso si no hay registros, ya que el objetivo es eliminarlos
    } catch (error) {
      console.error(`Error al eliminar documentos PDF por activityId ${activityId}:`, error);
      return false;
    }
  }
  
  async getRecentFileActivities(limit: number): Promise<FileActivity[]> {
    return await db
      .select()
      .from(fileActivities)
      .orderBy(desc(fileActivities.processingDate))
      .limit(limit);
  }
  
  async getPendingStoreAssignmentActivities(): Promise<FileActivity[]> {
    return await db
      .select()
      .from(fileActivities)
      .where(eq(fileActivities.status, 'PendingStoreAssignment'))
      .orderBy(desc(fileActivities.processingDate));
  }
  
  async getFileActivitiesByStore(storeCode: string): Promise<FileActivity[]> {
    return await db
      .select()
      .from(fileActivities)
      .where(eq(fileActivities.storeCode, storeCode))
      .orderBy(desc(fileActivities.processingDate));
  }
  
  // ExcelData methods
  async createExcelData(insertData: InsertExcelData): Promise<ExcelData> {
    const [data] = await db.insert(excelData).values(insertData).returning();
    return data;
  }
  
  async getExcelDataByStore(storeCode: string): Promise<ExcelData[]> {
    return await db
      .select()
      .from(excelData)
      .where(eq(excelData.storeCode, storeCode))
      .orderBy(desc(excelData.orderDate));
  }
  
  // PdfDocument methods
  async createPdfDocument(insertDoc: InsertPdfDocument): Promise<PdfDocument> {
    const [doc] = await db.insert(pdfDocuments).values(insertDoc).returning();
    return doc;
  }
  
  async getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]> {
    return await db
      .select()
      .from(pdfDocuments)
      .where(eq(pdfDocuments.storeCode, storeCode))
      .orderBy(desc(pdfDocuments.uploadDate));
  }
  
  async getPdfDocument(id: number): Promise<PdfDocument | undefined> {
    const [document] = await db
      .select()
      .from(pdfDocuments)
      .where(eq(pdfDocuments.id, id));
    return document;
  }
  
  // Métodos de ExcelData para búsqueda
  async searchExcelData(query: string, filters?: any): Promise<ExcelData[]> {
    console.log("DatabaseStorage.searchExcelData - Parámetros:", { query, filters });
    
    try {
      // Usaremos consultas literales en lugar de paramétricas para evitar problemas con los $N
      // Construiremos la consulta de forma segura escapando manualmente los valores
      
      // Función para escapar strings para SQL (prevenir inyección)
      function escapeSQLString(str: string) {
        if (str === null || str === undefined) return "NULL";
        return "'" + str.replace(/'/g, "''") + "'";
      }
      
      // Función para escapar patrones LIKE
      function escapeLikePattern(str: string) {
        if (str === null || str === undefined) return "NULL";
        // Escapar caracteres especiales en LIKE: %, _, [, ], ^, -
        const escaped = str.replace(/[%_[\]^-]/g, '\\$&');
        return "'%" + escaped.replace(/'/g, "''") + "%'";
      }
      
      let sqlConditions: string[] = [];
      
      // Determinar si es una búsqueda simple (sólo query sin filtros) o avanzada
      const isSimpleSearch = query && (!filters || Object.keys(filters).length === 0);
      console.log("Tipo de búsqueda:", isSimpleSearch ? "Simple" : "Avanzada");
      
      // Procesar la consulta general si existe
      if (query && query.trim() !== '') {
        const searchTermEscaped = escapeLikePattern(query.trim());
        const isNumericQuery = !isNaN(Number(query.trim()));
        
        // Siempre incluir condiciones de texto
        const textConditions = [
          `customer_name ILIKE ${searchTermEscaped}`,
          `customer_contact ILIKE ${searchTermEscaped}`,
          `order_number ILIKE ${searchTermEscaped}`,
          `item_details ILIKE ${searchTermEscaped}`,
          `metals ILIKE ${searchTermEscaped}`,
          `engravings ILIKE ${searchTermEscaped}`,
          `stones ILIKE ${searchTermEscaped}`,
          `pawn_ticket ILIKE ${searchTermEscaped}`
        ];
        
        // Si es numérico, añadir condiciones numéricas
        if (isNumericQuery) {
          const numericValue = Number(query.trim());
          const exactValue = escapeSQLString(query.trim());
          
          const numericConditions = [
            `order_number = ${exactValue}`,
            `customer_contact = ${exactValue}`
          ];
          
          // Añadir condición de precio sólo si el valor es mayor que cero
          if (numericValue > 0) {
            numericConditions.push(`(NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) = ${numericValue})`);
          }
          
          sqlConditions.push(`(${textConditions.join(' OR ')} OR ${numericConditions.join(' OR ')})`);
        } else {
          sqlConditions.push(`(${textConditions.join(' OR ')})`);
        }
      }
      
      // Aplicar filtros adicionales
      if (filters) {
        // Filtro por tienda
        if (filters.storeCode && filters.storeCode !== "all") {
          sqlConditions.push(`store_code = ${escapeSQLString(filters.storeCode)}`);
        }
        
        // Filtros específicos por campo de texto
        if (filters.customerName) {
          sqlConditions.push(`customer_name ILIKE ${escapeLikePattern(filters.customerName)}`);
        }
        
        if (filters.customerContact) {
          sqlConditions.push(`customer_contact ILIKE ${escapeLikePattern(filters.customerContact)}`);
        }
        
        if (filters.orderNumber) {
          sqlConditions.push(`order_number ILIKE ${escapeLikePattern(filters.orderNumber)}`);
        }
        
        if (filters.itemDetails) {
          sqlConditions.push(`item_details ILIKE ${escapeLikePattern(filters.itemDetails)}`);
        }
        
        if (filters.metals) {
          sqlConditions.push(`metals ILIKE ${escapeLikePattern(filters.metals)}`);
        }
        
        // Filtros de fecha
        if (filters.fromDate) {
          const fromDate = filters.fromDate instanceof Date 
            ? filters.fromDate.toISOString() 
            : new Date(filters.fromDate).toISOString();
          sqlConditions.push(`order_date >= ${escapeSQLString(fromDate)}`);
        }
        
        if (filters.toDate) {
          const toDate = filters.toDate instanceof Date 
            ? filters.toDate.toISOString() 
            : new Date(filters.toDate).toISOString();
          sqlConditions.push(`order_date <= ${escapeSQLString(toDate)}`);
        }
        
        // Filtros de precio - manejar todos los casos posibles
        if (filters.priceExact && !isNaN(parseFloat(filters.priceExact))) {
          const price = parseFloat(filters.priceExact);
          sqlConditions.push(`NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) = ${price}`);
        } else {
          if (filters.priceMin && !isNaN(parseFloat(filters.priceMin))) {
            const minPrice = parseFloat(filters.priceMin);
            if (filters.priceIncludeEqual) {
              sqlConditions.push(`NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) >= ${minPrice}`);
            } else {
              sqlConditions.push(`NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) > ${minPrice}`);
            }
          }
          
          if (filters.priceMax && !isNaN(parseFloat(filters.priceMax))) {
            const maxPrice = parseFloat(filters.priceMax);
            if (filters.priceIncludeEqual) {
              sqlConditions.push(`NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) <= ${maxPrice}`);
            } else {
              sqlConditions.push(`NULLIF(price, '') IS NOT NULL AND TRIM(price) != '' AND CAST(price AS DECIMAL) < ${maxPrice}`);
            }
          }
        }
      }
      
      // Construir la consulta completa
      let sql = 'SELECT * FROM excel_data';
      
      if (sqlConditions.length > 0) {
        sql += ' WHERE ' + sqlConditions.join(' AND ');
      }
      
      // Ordenar por fecha de orden descendente
      sql += ' ORDER BY order_date DESC';
      
      console.log("SQL Query:", sql);
      
      // Ejecutar la consulta SIN parámetros posicionales
      const result = await db.execute(sql);
      
      if (!result.rows || !Array.isArray(result.rows)) {
        console.log("No se encontraron resultados o formato de respuesta inesperado");
        return [];
      }
      
      // Mapear los resultados a objetos ExcelData
      const results = result.rows.map(row => {
        return {
          id: row.id,
          storeCode: row.store_code,
          orderNumber: row.order_number,
          orderDate: new Date(row.order_date),
          customerName: row.customer_name,
          customerContact: row.customer_contact,
          itemDetails: row.item_details,
          metals: row.metals,
          engravings: row.engravings,
          stones: row.stones,
          carats: row.carats,
          price: row.price,
          pawnTicket: row.pawn_ticket,
          saleDate: row.sale_date ? new Date(row.sale_date) : null,
          fileActivityId: row.file_activity_id
        } as ExcelData;
      });
      
      console.log(`DatabaseStorage.searchExcelData - Resultados: ${results.length}`);
      return results;
      
    } catch (error) {
      console.error("Error en la búsqueda de datos de Excel:", error);
      throw error; // Propagar el error para que sea manejado apropiadamente
    }
  }
  
  async getExcelDataById(id: number): Promise<ExcelData | undefined> {
    const [data] = await db
      .select()
      .from(excelData)
      .where(eq(excelData.id, id));
    return data;
  }
  
  // Watchlist Person methods
  async createWatchlistPerson(person: InsertWatchlistPerson): Promise<WatchlistPerson> {
    const [watchlistPerson] = await db
      .insert(watchlistPersons)
      .values(person)
      .returning();
    return watchlistPerson;
  }
  
  async getWatchlistPersons(includeInactive: boolean = false): Promise<WatchlistPerson[]> {
    // Usar SQL directo ya que hay problemas con la correspondencia de columnas
    const sql = includeInactive
      ? `SELECT * FROM watchlist_persons ORDER BY createdat DESC`
      : `SELECT * FROM watchlist_persons WHERE status = 'Activo' ORDER BY createdat DESC`;
    
    const result = await db.execute(sql);
    
    // Transformar el resultado en un array de WatchlistPerson
    if (result && result.rows && Array.isArray(result.rows)) {
      return result.rows.map(row => {
        return {
          id: row.id,
          fullName: row.fullname,
          identificationNumber: row.identificationnumber,
          phone: row.phone,
          notes: row.notes,
          riskLevel: row.risklevel,
          status: row.status,
          createdAt: row.createdat,
          createdBy: row.createdby,
          lastUpdated: row.lastupdated
        } as WatchlistPerson;
      });
    }
    
    // Si no hay resultados, devolver un array vacío
    return [];
  }
  
  async getWatchlistPerson(id: number): Promise<WatchlistPerson | undefined> {
    const [person] = await db
      .select()
      .from(watchlistPersons)
      .where(eq(watchlistPersons.id, id));
    return person;
  }
  
  async updateWatchlistPerson(id: number, personUpdate: Partial<WatchlistPerson>): Promise<WatchlistPerson | undefined> {
    // Actualizar la fecha de última modificación
    const updateData = {
      ...personUpdate,
      lastUpdated: new Date().toISOString()
    };
    
    const [updatedPerson] = await db
      .update(watchlistPersons)
      .set(updateData)
      .where(eq(watchlistPersons.id, id))
      .returning();
    return updatedPerson;
  }
  
  async deleteWatchlistPerson(id: number): Promise<boolean> {
    // En lugar de eliminar, marcamos como inactivo
    const [updated] = await db
      .update(watchlistPersons)
      .set({ 
        status: "Inactivo",
        lastUpdated: new Date().toISOString() 
      })
      .where(eq(watchlistPersons.id, id))
      .returning();
    return !!updated;
  }
  
  async searchWatchlistPersons(query: string): Promise<WatchlistPerson[]> {
    const searchQuery = `%${query}%`;
    // Usar SQL directo para evitar problemas con nombres de columnas
    const sql = `
      SELECT * FROM watchlist_persons
      WHERE status = 'Activo' AND (
        fullname ILIKE $1 OR
        identificationnumber ILIKE $1 OR
        phone ILIKE $1
      )
      ORDER BY createdat DESC
    `;
    
    const result = await db.execute(sql, [searchQuery]);
    
    // Transformar el resultado en un array de WatchlistPerson
    if (result && result.rows && Array.isArray(result.rows)) {
      return result.rows.map(row => {
        return {
          id: row.id,
          fullName: row.fullname,
          identificationNumber: row.identificationnumber,
          phone: row.phone,
          notes: row.notes,
          riskLevel: row.risklevel,
          status: row.status,
          createdAt: row.createdat,
          createdBy: row.createdby,
          lastUpdated: row.lastupdated
        } as WatchlistPerson;
      });
    }
    
    // Si no hay resultados, devolver un array vacío
    return [];
  }
  
  // Watchlist Item methods
  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [watchlistItem] = await db
      .insert(watchlistItems)
      .values(item)
      .returning();
    return watchlistItem;
  }
  
  async getWatchlistItems(includeInactive: boolean = false): Promise<WatchlistItem[]> {
    let query = db.select().from(watchlistItems);
    
    if (!includeInactive) {
      query = query.where(eq(watchlistItems.status, "Activo"));
    }
    
    return await query.orderBy(desc(watchlistItems.createdAt));
  }
  
  async getWatchlistItem(id: number): Promise<WatchlistItem | undefined> {
    const [item] = await db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.id, id));
    return item;
  }
  
  async updateWatchlistItem(id: number, itemUpdate: Partial<WatchlistItem>): Promise<WatchlistItem | undefined> {
    // Actualizar la fecha de última modificación
    const updateData = {
      ...itemUpdate,
      lastUpdated: new Date().toISOString()
    };
    
    const [updatedItem] = await db
      .update(watchlistItems)
      .set(updateData)
      .where(eq(watchlistItems.id, id))
      .returning();
    return updatedItem;
  }
  
  async deleteWatchlistItem(id: number): Promise<boolean> {
    // En lugar de eliminar, marcamos como inactivo
    const [updated] = await db
      .update(watchlistItems)
      .set({ 
        status: "Inactivo",
        lastUpdated: new Date().toISOString() 
      })
      .where(eq(watchlistItems.id, id))
      .returning();
    return !!updated;
  }
  
  async searchWatchlistItems(query: string): Promise<WatchlistItem[]> {
    const searchQuery = `%${query}%`;
    return await db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.status, "Activo"),
          or(
            like(watchlistItems.description, searchQuery),
            like(watchlistItems.serialNumber, searchQuery),
            like(watchlistItems.model, searchQuery),
            like(watchlistItems.brand, searchQuery),
            like(watchlistItems.identificationMarks, searchQuery)
          )
        )
      )
      .orderBy(desc(watchlistItems.createdAt));
  }
  
  // Alert methods
  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [newAlert] = await db
      .insert(alerts)
      .values(alert)
      .returning();
    return newAlert;
  }
  
  async getAlerts(status?: string, limit: number = 50): Promise<Alert[]> {
    try {
      // Usar SQL directo para evitar problemas con los nombres de las columnas
      let sql = `SELECT * FROM alerts`;
      const params: any[] = [];
      
      if (status) {
        sql += ` WHERE status = $1`;
        params.push(status);
      }
      
      sql += ` ORDER BY createdat DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      // Ejecutar la consulta SQL directa
      const result = await db.execute(sql, params);
      return result.rows as Alert[];
    } catch (error) {
      console.error("Error al obtener alertas:", error);
      // En caso de error, devolver array vacío para evitar que falle la aplicación
      return [];
    }
  }
  
  async getAlert(id: number): Promise<Alert | undefined> {
    const [alert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, id));
    return alert;
  }
  
  async updateAlertStatus(
    id: number, 
    status: string, 
    reviewedBy: number,
    notes?: string
  ): Promise<Alert | undefined> {
    const updateData: Partial<Alert> = { 
      status: status as "Nueva" | "Revisada" | "Falsa",
      reviewedBy,
      resolvedAt: new Date().toISOString()
    };
    
    if (notes) {
      updateData.reviewNotes = notes;
    }
    
    const [updatedAlert] = await db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, id))
      .returning();
    return updatedAlert;
  }
  
  async getAlertsByExcelDataId(excelDataId: number): Promise<Alert[]> {
    try {
      // Usar SQL directo para evitar problemas de nomenclatura
      const result = await db.execute(
        `SELECT * FROM "alerts" WHERE "excel_data_id" = $1 ORDER BY "createdat" DESC`,
        [excelDataId]
      );
      
      // Transformar el resultado en un array de Alert
      if (result && result.rows && Array.isArray(result.rows)) {
        return result.rows.map(row => {
          // Mapear los nombres de columnas de la base de datos a los nombres en el código
          return {
            id: row.id,
            alertType: row.alerttype, // Nota: en la BD es 'alerttype', en el esquema es 'alert_type'
            excelDataId: row.excel_data_id,
            watchlistPersonId: row.watchlist_person_id,
            watchlistItemId: row.watchlist_item_id,
            matchConfidence: row.match_confidence,
            status: row.status,
            reviewedBy: row.reviewed_by,
            reviewNotes: row.review_notes,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at
          } as Alert;
        });
      }
      
      // Si no hay resultados, devolver un array vacío
      return [];
    } catch (error) {
      console.error("Error al obtener alertas por excelDataId:", error);
      return [];
    }
  }
  
  // Search History methods
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    try {
      // Insertar directamente usando SQL para evitar problemas con TypeScript
      const result = await db.execute(
        `INSERT INTO search_history (user_id, search_type, search_terms, search_date, result_count, filters) 
         VALUES ($1, $2, $3, NOW(), $4, $5) RETURNING *`,
        [
          searchHistory.userId, 
          searchHistory.searchType, 
          searchHistory.searchTerms, 
          searchHistory.resultCount,
          searchHistory.filters || null
        ]
      );
      
      if (result && result.rows && result.rows[0]) {
        return result.rows[0] as SearchHistory;
      }
      
      throw new Error("No se pudo insertar el historial de búsqueda");
    } catch (error) {
      console.error("Error al guardar historial de búsqueda:", error);
      // Devolvemos un objeto vacío para evitar errores en cascada
      return {} as SearchHistory;
    }
  }
  
  async getRecentSearches(userId: number, limit: number = 10): Promise<SearchHistory[]> {
    try {
      // Usar SQL directo para evitar problemas de TypeScript
      const result = await db.execute(
        `SELECT * FROM "search_history" WHERE "user_id" = $1 ORDER BY "search_date" DESC LIMIT $2`,
        [userId, limit]
      );
      
      if (result && result.rows && Array.isArray(result.rows)) {
        return result.rows.map(row => {
          return {
            id: row.id,
            userId: row.user_id,
            searchType: row.search_type,
            searchTerms: row.search_terms,
            searchDate: row.search_date,
            resultCount: row.result_count,
            filters: row.filters
          } as SearchHistory;
        });
      }
      
      return [];
    } catch (error) {
      console.error("Error al obtener historial de búsquedas:", error);
      return [];
    }
  }
}

// Create initial data
async function initializeDatabase() {
  try {
    const storage = new DatabaseStorage();
    
    // Check if we already have a SuperAdmin user
    const existingAdmin = await storage.getUserByUsername("117020");
    
    if (!existingAdmin) {
      // Hash the password for our new user
      const hashedPassword = "09c0e483c2b36cea17e403cbf055362ff4f65b4f1ceabbff4fbf3459f9442ac5968feb27463e79b2486d2b723f068c115e8f8b2c8fc5abeb088b64e8ba8e7f22.c36e7a5ec3c69340f554985b50bd226f";
      
      // Create the super admin user
      await storage.createUser({
        username: "117020",
        password: hashedPassword,
        name: "Administrador del Sistema",
        role: "SuperAdmin"
      });
      
      console.log("Created default SuperAdmin user");
    }
    
    // Create default system configurations if they don't exist
    const excelWatchDir = await storage.getConfig("EXCEL_WATCH_DIR");
    if (!excelWatchDir) {
      await storage.setConfig({
        key: "EXCEL_WATCH_DIR",
        value: "./data/excel",
        description: "Directory to watch for Excel files"
      });
    }
    
    const pdfWatchDir = await storage.getConfig("PDF_WATCH_DIR");
    if (!pdfWatchDir) {
      await storage.setConfig({
        key: "PDF_WATCH_DIR",
        value: "./data/pdf",
        description: "Directory to watch for PDF files"
      });
    }
    
    const fileProcessingEnabled = await storage.getConfig("FILE_PROCESSING_ENABLED");
    if (!fileProcessingEnabled) {
      await storage.setConfig({
        key: "FILE_PROCESSING_ENABLED",
        value: "true",
        description: "Enable or disable file processing"
      });
    }
    
    console.log("Database initialization complete");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initialize the database and create a new instance of DatabaseStorage
initializeDatabase().catch(console.error);

export const storage = new DatabaseStorage();
