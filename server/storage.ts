import { 
  users, stores, systemConfigs, fileActivities, excelData, pdfDocuments,
  watchlistPersons, watchlistItems, alerts, searchHistory,
  senalPersonas, senalObjetos, coincidencias,
  type User, type InsertUser, type Store, type InsertStore, 
  type SystemConfig, type InsertSystemConfig, type FileActivity, 
  type InsertFileActivity, type ExcelData, type InsertExcelData,
  type PdfDocument, type InsertPdfDocument,
  type WatchlistPerson, type InsertWatchlistPerson,
  type WatchlistItem, type InsertWatchlistItem,
  type Alert, type InsertAlert,
  type SearchHistory, type InsertSearchHistory,
  type SenalPersona, type InsertSenalPersona,
  type SenalObjeto, type InsertSenalObjeto,
  type Coincidencia, type InsertCoincidencia
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
// No necesitamos connectPg para SQLite
import { db, sqlite } from "./db";
import { eq, desc, like, or, and, gte, lte, inArray, sql } from "drizzle-orm";
// SQLite no necesita pool

const MemoryStore = createMemoryStore(session);
// SQLite usa MemoryStore para las sesiones

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
  searchPdfDocuments(params: { storeCodes: string[], dateFrom?: string, dateTo?: string }): Promise<PdfDocument[]>;
  getPdfDocument(id: number): Promise<PdfDocument | undefined>;
  getPdfDocumentByActivityId(activityId: number): Promise<PdfDocument | undefined>;
  updatePdfDocumentPath(fileActivityId: number, newPath: string): Promise<boolean>;
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
  
  // Señalamientos de Personas
  createSenalPersona(persona: InsertSenalPersona): Promise<SenalPersona>;
  getSenalPersonas(incluirInactivos?: boolean): Promise<SenalPersona[]>;
  getSenalPersona(id: number): Promise<SenalPersona | undefined>;
  updateSenalPersona(id: number, persona: Partial<SenalPersona>): Promise<SenalPersona | undefined>;
  deleteSenalPersona(id: number, userId: number): Promise<boolean>;
  searchSenalPersonas(query: string): Promise<SenalPersona[]>;
  
  // Señalamientos de Objetos
  createSenalObjeto(objeto: InsertSenalObjeto): Promise<SenalObjeto>;
  getSenalObjetos(incluirInactivos?: boolean): Promise<SenalObjeto[]>;
  getSenalObjeto(id: number): Promise<SenalObjeto | undefined>;
  updateSenalObjeto(id: number, objeto: Partial<SenalObjeto>): Promise<SenalObjeto | undefined>;
  deleteSenalObjeto(id: number, userId: number): Promise<boolean>;
  searchSenalObjetos(query: string): Promise<SenalObjeto[]>;
  
  // Coincidencias
  createCoincidencia(coincidencia: InsertCoincidencia): Promise<Coincidencia>;
  getCoincidencias(estado?: "NoLeido" | "Leido" | "Descartado", limit?: number): Promise<Coincidencia[]>;
  getCoincidencia(id: number): Promise<Coincidencia | undefined>;
  updateCoincidenciaEstado(id: number, estado: "NoLeido" | "Leido" | "Descartado", revisadoPor: number, notasRevision?: string): Promise<Coincidencia | undefined>;
  getCoincidenciasByExcelDataId(excelDataId: number): Promise<Coincidencia[]>;
  getNumeroCoincidenciasNoLeidas(): Promise<number>;
  detectarCoincidencias(excelDataId: number): Promise<{ nuevasCoincidencias: number }>;

  // Database cleaning methods
  purgeExcelStores(): Promise<{ count: number }>;
  purgePdfStores(): Promise<{ count: number }>;
  purgeAllStores(): Promise<{ count: number }>;
  purgeExcelData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }>;
  purgePdfData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }>;
  purgeFileActivities(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }>;
  purgeAllData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }>;
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
  private senalPersonas: Map<number, SenalPersona>;
  private senalObjetos: Map<number, SenalObjeto>;
  private coincidencias: Map<number, Coincidencia>;
  
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
  private senalPersonaId: number;
  private senalObjetoId: number;
  private coincidenciaId: number;

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
    this.senalPersonas = new Map();
    this.senalObjetos = new Map();
    this.coincidencias = new Map();
    
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
    this.senalPersonaId = 1;
    this.senalObjetoId = 1;
    this.coincidenciaId = 1;
    
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
  
  async searchPdfDocuments(params: { 
    storeCodes: string[], 
    dateFrom?: string, 
    dateTo?: string 
  }): Promise<PdfDocument[]> {
    let results = Array.from(this.pdfDocuments.values())
      .filter(doc => params.storeCodes.includes(doc.storeCode));
    
    // Filtrar por rango de fechas si se proporciona
    if (params.dateFrom || params.dateTo) {
      results = results.filter(doc => {
        const uploadDate = new Date(doc.uploadDate);
        
        if (params.dateFrom && params.dateTo) {
          return uploadDate >= params.dateFrom && uploadDate <= params.dateTo;
        } else if (params.dateFrom) {
          return uploadDate >= params.dateFrom;
        } else if (params.dateTo) {
          return uploadDate <= params.dateTo;
        }
        
        return true;
      });
    }
    
    // Ordenar por fecha (más reciente primero)
    return results.sort((a, b) => {
      const dateA = new Date(a.uploadDate).getTime();
      const dateB = new Date(b.uploadDate).getTime();
      return dateB - dateA;
    });
  }
  
  async getPdfDocument(id: number): Promise<PdfDocument | undefined> {
    return this.pdfDocuments.get(id);
  }
  
  async getPdfDocumentByActivityId(activityId: number): Promise<PdfDocument | undefined> {
    // Buscar todos los documentos PDF con ese fileActivityId y devolver el primero
    const pdfDocs = Array.from(this.pdfDocuments.values())
      .filter(doc => doc.fileActivityId === activityId);
    
    // Si hay documentos, devolver el primero
    if (pdfDocs.length > 0) {
      return pdfDocs[0];
    }
    
    return undefined;
  }
  
  async updatePdfDocumentPath(fileActivityId: number, newPath: string): Promise<boolean> {
    // Buscar todos los documentos PDF con ese fileActivityId
    const pdfDocsToUpdate = Array.from(this.pdfDocuments.values())
      .filter(doc => doc.fileActivityId === fileActivityId);
    
    // Si no hay documentos, no se pudo actualizar
    if (pdfDocsToUpdate.length === 0) {
      return false;
    }
    
    // Actualizar cada documento encontrado con la nueva ruta
    for (const doc of pdfDocsToUpdate) {
      const updatedDoc = { ...doc, path: newPath };
      this.pdfDocuments.set(doc.id, updatedDoc);
    }
    
    return true;
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
  
  // Métodos para señalamientos de personas
  async createSenalPersona(persona: InsertSenalPersona): Promise<SenalPersona> {
    const id = this.senalPersonaId++;
    const now = new Date();
    
    const senalPersona: SenalPersona = {
      ...persona,
      id,
      estado: persona.estado || "Activo",
      nivelRiesgo: persona.nivelRiesgo || "Medio",
      creadoEn: persona.creadoEn || now,
      modificadoEn: null,
      modificadoPor: null
    };
    
    this.senalPersonas.set(id, senalPersona);
    return senalPersona;
  }
  
  async getSenalPersonas(incluirInactivos: boolean = false): Promise<SenalPersona[]> {
    let personas = Array.from(this.senalPersonas.values());
    
    if (!incluirInactivos) {
      personas = personas.filter(persona => persona.estado === "Activo");
    }
    
    return personas.sort((a, b) => {
      // Ordenar por nivel de riesgo (Alto > Medio > Bajo)
      const riskLevelOrder = { "Alto": 0, "Medio": 1, "Bajo": 2 };
      const riskComparison = riskLevelOrder[a.nivelRiesgo] - riskLevelOrder[b.nivelRiesgo];
      
      if (riskComparison !== 0) return riskComparison;
      
      // Si el nivel de riesgo es el mismo, ordenar por fecha de creación (más reciente primero)
      const dateA = new Date(a.creadoEn).getTime();
      const dateB = new Date(b.creadoEn).getTime();
      return dateB - dateA;
    });
  }
  
  async getSenalPersona(id: number): Promise<SenalPersona | undefined> {
    return this.senalPersonas.get(id);
  }
  
  async updateSenalPersona(id: number, updates: Partial<SenalPersona>): Promise<SenalPersona | undefined> {
    const persona = this.senalPersonas.get(id);
    if (!persona) return undefined;
    
    const updatedPersona = {
      ...persona,
      ...updates,
      modificadoEn: new Date()
    };
    
    this.senalPersonas.set(id, updatedPersona);
    return updatedPersona;
  }
  
  async deleteSenalPersona(id: number, userId: number): Promise<boolean> {
    const persona = this.senalPersonas.get(id);
    
    // Solo permitir eliminar si la persona que creó el registro es la misma que intenta eliminarlo,
    // o si el usuario tiene rol de SuperAdmin (esto se verificará en la ruta)
    if (!persona || (persona.creadoPor !== userId)) {
      return false;
    }
    
    return this.senalPersonas.delete(id);
  }
  
  async searchSenalPersonas(query: string): Promise<SenalPersona[]> {
    if (!query || query.trim() === "") {
      return this.getSenalPersonas();
    }
    
    const searchTerm = query.toLowerCase();
    
    return (await this.getSenalPersonas()).filter(persona => {
      return (
        (persona.nombre && persona.nombre.toLowerCase().includes(searchTerm)) ||
        (persona.documentoId && persona.documentoId.toLowerCase().includes(searchTerm)) ||
        (persona.notas && persona.notas.toLowerCase().includes(searchTerm))
      );
    });
  }
  
  // Métodos para señalamientos de objetos
  async createSenalObjeto(objeto: InsertSenalObjeto): Promise<SenalObjeto> {
    const id = this.senalObjetoId++;
    const now = new Date();
    
    const senalObjeto: SenalObjeto = {
      ...objeto,
      id,
      estado: objeto.estado || "Activo",
      nivelRiesgo: objeto.nivelRiesgo || "Medio",
      creadoEn: objeto.creadoEn || now,
      modificadoEn: null,
      modificadoPor: null
    };
    
    this.senalObjetos.set(id, senalObjeto);
    return senalObjeto;
  }
  
  async getSenalObjetos(incluirInactivos: boolean = false): Promise<SenalObjeto[]> {
    let objetos = Array.from(this.senalObjetos.values());
    
    if (!incluirInactivos) {
      objetos = objetos.filter(objeto => objeto.estado === "Activo");
    }
    
    return objetos.sort((a, b) => {
      // Ordenar por nivel de riesgo (Alto > Medio > Bajo)
      const riskLevelOrder = { "Alto": 0, "Medio": 1, "Bajo": 2 };
      const riskComparison = riskLevelOrder[a.nivelRiesgo] - riskLevelOrder[b.nivelRiesgo];
      
      if (riskComparison !== 0) return riskComparison;
      
      // Si el nivel de riesgo es el mismo, ordenar por fecha de creación (más reciente primero)
      const dateA = new Date(a.creadoEn).getTime();
      const dateB = new Date(b.creadoEn).getTime();
      return dateB - dateA;
    });
  }
  
  async getSenalObjeto(id: number): Promise<SenalObjeto | undefined> {
    return this.senalObjetos.get(id);
  }
  
  async updateSenalObjeto(id: number, updates: Partial<SenalObjeto>): Promise<SenalObjeto | undefined> {
    const objeto = this.senalObjetos.get(id);
    if (!objeto) return undefined;
    
    const updatedObjeto = {
      ...objeto,
      ...updates,
      modificadoEn: new Date()
    };
    
    this.senalObjetos.set(id, updatedObjeto);
    return updatedObjeto;
  }
  
  async deleteSenalObjeto(id: number, userId: number): Promise<boolean> {
    const objeto = this.senalObjetos.get(id);
    
    // Solo permitir eliminar si la persona que creó el registro es la misma que intenta eliminarlo,
    // o si el usuario tiene rol de SuperAdmin (esto se verificará en la ruta)
    if (!objeto || (objeto.creadoPor !== userId)) {
      return false;
    }
    
    return this.senalObjetos.delete(id);
  }
  
  async searchSenalObjetos(query: string): Promise<SenalObjeto[]> {
    if (!query || query.trim() === "") {
      return this.getSenalObjetos();
    }
    
    const searchTerm = query.toLowerCase();
    
    return (await this.getSenalObjetos()).filter(objeto => {
      return (
        (objeto.descripcion && objeto.descripcion.toLowerCase().includes(searchTerm)) ||
        (objeto.grabacion && objeto.grabacion.toLowerCase().includes(searchTerm)) ||
        (objeto.notas && objeto.notas.toLowerCase().includes(searchTerm))
      );
    });
  }
  
  // Métodos para coincidencias
  async createCoincidencia(coincidencia: InsertCoincidencia): Promise<Coincidencia> {
    const id = this.coincidenciaId++;
    const now = new Date();
    
    const nuevaCoincidencia: Coincidencia = {
      ...coincidencia,
      id,
      estado: "NoLeido",
      creadoEn: now,
      revisadoEn: null,
      revisadoPor: null,
      notasRevision: null
    };
    
    this.coincidencias.set(id, nuevaCoincidencia);
    return nuevaCoincidencia;
  }
  
  async getCoincidencias(estado?: "NoLeido" | "Leido" | "Descartado", limit: number = 50): Promise<Coincidencia[]> {
    let coincidencias = Array.from(this.coincidencias.values());
    
    if (estado) {
      coincidencias = coincidencias.filter(coincidencia => coincidencia.estado === estado);
    }
    
    return coincidencias
      .sort((a, b) => {
        // Ordenar por fecha de creación (más reciente primero)
        const dateA = new Date(a.creadoEn).getTime();
        const dateB = new Date(b.creadoEn).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }
  
  async getCoincidencia(id: number): Promise<Coincidencia | undefined> {
    return this.coincidencias.get(id);
  }
  
  async updateCoincidenciaEstado(
    id: number, 
    estado: "NoLeido" | "Leido" | "Descartado", 
    revisadoPor: number, 
    notasRevision?: string
  ): Promise<Coincidencia | undefined> {
    const coincidencia = this.coincidencias.get(id);
    if (!coincidencia) return undefined;
    
    const updatedCoincidencia = {
      ...coincidencia,
      estado,
      revisadoPor,
      revisadoEn: new Date(),
      ...(notasRevision && { notasRevision })
    };
    
    this.coincidencias.set(id, updatedCoincidencia);
    return updatedCoincidencia;
  }
  
  async getCoincidenciasByExcelDataId(excelDataId: number): Promise<Coincidencia[]> {
    return Array.from(this.coincidencias.values())
      .filter(coincidencia => coincidencia.idExcelData === excelDataId)
      .sort((a, b) => {
        // Ordenar primero por no leídos y luego por fecha
        if (a.estado === "NoLeido" && b.estado !== "NoLeido") return -1;
        if (a.estado !== "NoLeido" && b.estado === "NoLeido") return 1;
        
        // Si ambos tienen el mismo estado, ordenar por fecha
        const dateA = new Date(a.creadoEn).getTime();
        const dateB = new Date(b.creadoEn).getTime();
        return dateB - dateA;
      });
  }
  
  async getNumeroCoincidenciasNoLeidas(): Promise<number> {
    return Array.from(this.coincidencias.values())
      .filter(coincidencia => coincidencia.estado === "NoLeido")
      .length;
  }
  
  async detectarCoincidencias(excelDataId: number): Promise<{ nuevasCoincidencias: number }> {
    // Implementación simplificada para la versión en memoria
    // En una implementación real, aquí iría el algoritmo de similitud
    console.log(`[MemStorage] Detectando coincidencias para excelDataId: ${excelDataId}`);
    return { nuevasCoincidencias: 0 };
  }
  
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
    // En SQLite usamos MemoryStore para las sesiones
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
  
  async searchPdfDocuments(params: { 
    storeCodes: string[], 
    dateFrom?: string, 
    dateTo?: string 
  }): Promise<PdfDocument[]> {
    let query = db
      .select()
      .from(pdfDocuments)
      .where(inArray(pdfDocuments.storeCode, params.storeCodes));
    
    // Filtrar por rango de fechas si se proporciona
    if (params.dateFrom && params.dateTo) {
      query = query.where(
        and(
          gte(pdfDocuments.uploadDate, params.dateFrom),
          lte(pdfDocuments.uploadDate, params.dateTo)
        )
      );
    } else if (params.dateFrom) {
      query = query.where(gte(pdfDocuments.uploadDate, params.dateFrom));
    } else if (params.dateTo) {
      query = query.where(lte(pdfDocuments.uploadDate, params.dateTo));
    }
    
    // Ordenar por fecha (más reciente primero)
    query = query.orderBy(desc(pdfDocuments.uploadDate));
    
    const results = await query;
    return results;
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
  
  async purgeExcelData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }> {
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
  
  async purgePdfData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }> {
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
  
  async purgeFileActivities(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }> {
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
  
  async purgeAllData(dateRange?: { from: string | null, to: string | null }): Promise<{ count: number }> {
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
    try {
      console.log("Creando actividad de archivo:", JSON.stringify(insertActivity));
      
      // Asegurarse de que processingDate sea un string en formato ISO
      const cleanedActivity = {
        ...insertActivity,
        // Si la fecha de procesamiento no existe, la creamos
        processingDate: insertActivity.processingDate 
          ? (typeof insertActivity.processingDate === 'string' 
             ? insertActivity.processingDate 
             : (insertActivity.processingDate instanceof Date 
                ? insertActivity.processingDate.toISOString() 
                : new Date().toISOString()))
          : new Date().toISOString()
      };
      
      console.log("Actividad de archivo limpia para SQLite:", JSON.stringify(cleanedActivity));
      
      const [activity] = await db.insert(fileActivities).values(cleanedActivity).returning();
      return activity;
    } catch (error) {
      console.error("Error al crear actividad de archivo:", error);
      throw error;
    }
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
    try {
      // Para cada cambio de estado, actualizamos la fecha de procesamiento
      const now = new Date().toISOString(); // Convertimos a string para SQLite
      
      const updateValues: Partial<FileActivity> = { 
        status: status as "Pending" | "Processing" | "Processed" | "Failed",
        processingDate: now
      };
      
      if (errorMessage) {
        updateValues.errorMessage = errorMessage;
      }
      
      console.log(`Actualizando estado de actividad ${id} a ${status}:`, JSON.stringify(updateValues));
      
      const [updatedActivity] = await db
        .update(fileActivities)
        .set(updateValues)
        .where(eq(fileActivities.id, id))
        .returning();
        
      return updatedActivity;
    } catch (error) {
      console.error(`Error al actualizar estado de actividad ${id} a ${status}:`, error);
      throw error;
    }
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
      
      // Procesar las fechas para garantizar compatibilidad con SQLite
      const processedUpdates: Partial<FileActivity> = { ...updates };
      
      // Si hay una fecha de procesamiento, convertirla a string ISO
      if (updates.processingDate) {
        if (updates.processingDate instanceof Date) {
          processedUpdates.processingDate = updates.processingDate.toISOString();
        } else if (typeof updates.processingDate !== 'string') {
          processedUpdates.processingDate = new Date().toISOString();
        }
      }
      
      console.log(`Actualizando actividad de archivo ${id}:`, JSON.stringify(processedUpdates));
      
      // Actualizar la actividad con los nuevos valores
      const [updatedActivity] = await db
        .update(fileActivities)
        .set(processedUpdates)
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
  
  async updatePdfDocumentPath(fileActivityId: number, newPath: string): Promise<boolean> {
    try {
      const result = await db
        .update(pdfDocuments)
        .set({ path: newPath })
        .where(eq(pdfDocuments.fileActivityId, fileActivityId))
        .returning({ id: pdfDocuments.id });
      
      // Si al menos un documento fue actualizado, consideramos éxito
      return result.length > 0;
    } catch (error) {
      console.error(`Error al actualizar la ruta del documento PDF para activityId ${fileActivityId}:`, error);
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
    console.log("Buscando actividades pendientes de asignación de tienda...");
    
    // Verificar también actividades con storeCode = 'PENDIENTE'
    try {
      const pendingActivities = await db
        .select()
        .from(fileActivities)
        .where(
          or(
            eq(fileActivities.status, 'PendingStoreAssignment'),
            eq(fileActivities.storeCode, 'PENDIENTE')
          )
        )
        .orderBy(desc(fileActivities.processingDate));
      
      console.log(`Encontradas ${pendingActivities.length} actividades pendientes de asignación de tienda`);
      return pendingActivities;
    } catch (error) {
      console.error("Error al buscar actividades pendientes de asignación:", error);
      return [];
    }
  }
  
  async getFileActivitiesByStore(storeCode: string): Promise<FileActivity[]> {
    // Obtener todas las activities para hacer una búsqueda flexible
    try {
      console.log(`Buscando actividades para tienda con código: "${storeCode}"`);
      
      // Primero intentamos una búsqueda exacta
      const exactActivities = await db
        .select()
        .from(fileActivities)
        .where(eq(fileActivities.storeCode, storeCode))
        .orderBy(desc(fileActivities.processingDate));
        
      if (exactActivities.length > 0) {
        console.log(`Se encontraron ${exactActivities.length} actividades con código exacto`);
        return exactActivities;
      }
      
      // Si no hay resultados, hacemos una búsqueda más flexible
      console.log("No se encontraron actividades con código exacto, intentando búsqueda flexible");
      
      // Normalizar el código de tienda (eliminar espacios)
      const normalizedStoreCode = storeCode.replace(/\s+/g, '');
      
      // Obtener todas las actividades y filtrar por similaridad
      const allActivities = await db
        .select()
        .from(fileActivities)
        .orderBy(desc(fileActivities.processingDate));
        
      // Filtrar aquellas cuyo código sin espacios coincida
      const matchingActivities = allActivities.filter(activity => {
        const activityStoreCodeNormalized = activity.storeCode.replace(/\s+/g, '');
        return activityStoreCodeNormalized === normalizedStoreCode;
      });
      
      console.log(`Se encontraron ${matchingActivities.length} actividades con búsqueda flexible`);
      return matchingActivities;
    } catch (error) {
      console.error("Error al buscar actividades por tienda:", error);
      return [];
    }
  }
  
  // ExcelData methods
  async createExcelData(insertData: InsertExcelData): Promise<ExcelData> {
    try {
      // Verificar que todas las propiedades están en el formato esperado por SQLite
      console.log("Inserting Excel data:", JSON.stringify(insertData));
      
      // Si hay un problema con algún campo, convertirlo a string - SQLite solo acepta strings, números, etc.
      // Esto es especialmente importante para las fechas que deben estar en formato string (ISO)
      const cleanedData = {
        ...insertData,
        // Asegurarse de que orderDate es string
        orderDate: typeof insertData.orderDate === 'string' 
          ? insertData.orderDate 
          : (insertData.orderDate instanceof Date ? insertData.orderDate.toISOString() : new Date().toISOString()),
        
        // Asegurarse de que saleDate es string o null
        saleDate: insertData.saleDate 
          ? (typeof insertData.saleDate === 'string' 
             ? insertData.saleDate 
             : (insertData.saleDate instanceof Date ? insertData.saleDate.toISOString() : null))
          : null
      };
      
      console.log("Cleaned Excel data for SQLite:", JSON.stringify(cleanedData));
      
      const [data] = await db.insert(excelData).values(cleanedData).returning();
      return data;
    } catch (error) {
      console.error("Error al insertar datos de Excel:", error);
      throw error;
    }
  }
  
  async getExcelDataByStore(storeCode: string): Promise<ExcelData[]> {
    try {
      console.log(`Buscando datos de Excel para tienda con código: "${storeCode}"`);
      
      // Primero intentamos una búsqueda exacta
      const exactData = await db
        .select()
        .from(excelData)
        .where(eq(excelData.storeCode, storeCode))
        .orderBy(desc(excelData.orderDate));
        
      if (exactData.length > 0) {
        console.log(`Se encontraron ${exactData.length} registros de Excel con código exacto`);
        return exactData;
      }
      
      // Si no hay resultados, hacemos una búsqueda más flexible
      console.log("No se encontraron datos de Excel con código exacto, intentando búsqueda flexible");
      
      // Normalizar el código de tienda (eliminar espacios)
      const normalizedStoreCode = storeCode.replace(/\s+/g, '');
      
      // Obtener todas las actividades y filtrar por similaridad
      const allData = await db
        .select()
        .from(excelData)
        .orderBy(desc(excelData.orderDate));
        
      // Filtrar aquellas cuyo código sin espacios coincida
      const matchingData = allData.filter(item => {
        const itemStoreCodeNormalized = item.storeCode.replace(/\s+/g, '');
        return itemStoreCodeNormalized === normalizedStoreCode;
      });
      
      console.log(`Se encontraron ${matchingData.length} registros de Excel con búsqueda flexible`);
      return matchingData;
    } catch (error) {
      console.error("Error al buscar datos de Excel por tienda:", error);
      return [];
    }
  }
  
  // PdfDocument methods
  async createPdfDocument(insertDoc: InsertPdfDocument): Promise<PdfDocument> {
    try {
      // Verificar que todas las propiedades están en el formato esperado por SQLite
      console.log("Inserting PDF document:", JSON.stringify(insertDoc));
      
      // Si hay un problema con algún campo, convertirlo a string - SQLite solo acepta strings, números, etc.
      // Esto es especialmente importante para las fechas que deben estar en formato string (ISO)
      const cleanedData = {
        ...insertDoc,
        // Asegurarse de que uploadDate es string
        uploadDate: typeof insertDoc.uploadDate === 'string' 
          ? insertDoc.uploadDate 
          : (insertDoc.uploadDate instanceof Date ? insertDoc.uploadDate.toISOString() : new Date().toISOString()),
      };
      
      console.log("Cleaned PDF document data for SQLite:", JSON.stringify(cleanedData));
      
      const [doc] = await db.insert(pdfDocuments).values(cleanedData).returning();
      return doc;
    } catch (error) {
      console.error("Error al insertar documento PDF:", error);
      throw error;
    }
  }
  
  async getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]> {
    try {
      console.log(`Buscando documentos PDF para tienda con código: "${storeCode}"`);
      
      // Primero intentamos una búsqueda exacta
      const exactDocs = await db
        .select()
        .from(pdfDocuments)
        .where(eq(pdfDocuments.storeCode, storeCode))
        .orderBy(desc(pdfDocuments.uploadDate));
        
      if (exactDocs.length > 0) {
        console.log(`Se encontraron ${exactDocs.length} documentos PDF con código exacto`);
        return exactDocs;
      }
      
      // Si no hay resultados, hacemos una búsqueda más flexible
      console.log("No se encontraron documentos PDF con código exacto, intentando búsqueda flexible");
      
      // Normalizar el código de tienda (eliminar espacios)
      const normalizedStoreCode = storeCode.replace(/\s+/g, '');
      
      // Obtener todas las actividades y filtrar por similaridad
      const allDocs = await db
        .select()
        .from(pdfDocuments)
        .orderBy(desc(pdfDocuments.uploadDate));
        
      // Filtrar aquellas cuyo código sin espacios coincida
      const matchingDocs = allDocs.filter(doc => {
        const docStoreCodeNormalized = doc.storeCode.replace(/\s+/g, '');
        return docStoreCodeNormalized === normalizedStoreCode;
      });
      
      console.log(`Se encontraron ${matchingDocs.length} documentos PDF con búsqueda flexible`);
      return matchingDocs;
    } catch (error) {
      console.error("Error al buscar documentos PDF por tienda:", error);
      return [];
    }
  }
  
  async getPdfDocument(id: number): Promise<PdfDocument | undefined> {
    const [document] = await db
      .select()
      .from(pdfDocuments)
      .where(eq(pdfDocuments.id, id));
    return document;
  }
  
  async getPdfDocumentByActivityId(activityId: number): Promise<PdfDocument | undefined> {
    const [document] = await db
      .select()
      .from(pdfDocuments)
      .where(eq(pdfDocuments.fileActivityId, activityId))
      .limit(1);
    return document;
  }
  
  // Métodos de ExcelData para búsqueda
  async searchExcelData(query: string, filters?: any): Promise<ExcelData[]> {
    console.log("DatabaseStorage.searchExcelData - Parámetros:", { query, filters });
    
    try {
      // Si no hay términos de búsqueda ni filtros, devolver los 100 registros más recientes
      if (!query && (!filters || Object.keys(filters).length === 0)) {
        console.log("Búsqueda simple: retornando los 100 registros más recientes");
        const results = await db
          .select()
          .from(excelData)
          .orderBy(desc(excelData.orderDate))
          .limit(100);
        return results;
      }
      
      // Determinar si es una búsqueda simple (sólo query sin filtros) o avanzada
      const isSimpleSearch = query && (!filters || Object.keys(filters).length === 0);
      console.log("Tipo de búsqueda:", isSimpleSearch ? "Simple" : "Avanzada");
      
      // Condiciones para construir el query
      const conditions: SQL<unknown>[] = [];
      
      // Procesar la consulta general si existe
      if (query && query.trim() !== '') {
        const searchTerm = query.trim();
        const isNumericQuery = !isNaN(Number(searchTerm));
        
        // Condiciones de texto para la búsqueda
        const textCondition = or(
          like(excelData.customerName, `%${searchTerm}%`),
          like(excelData.customerContact, `%${searchTerm}%`),
          like(excelData.orderNumber, `%${searchTerm}%`),
          like(excelData.itemDetails, `%${searchTerm}%`),
          like(excelData.metals, `%${searchTerm}%`),
          like(excelData.engravings, `%${searchTerm}%`),
          like(excelData.stones, `%${searchTerm}%`),
          like(excelData.pawnTicket, `%${searchTerm}%`)
        );
        
        conditions.push(textCondition);
        
        // Si es numérico, agregar condiciones adicionales para comparaciones exactas
        if (isNumericQuery) {
          const numericValue = Number(searchTerm);
          
          // Solo agregar condición de precio si el valor es mayor que cero
          if (numericValue > 0) {
            conditions.push(
              sql`(${excelData.price} IS NOT NULL AND TRIM(${excelData.price}) != '' AND CAST(${excelData.price} AS REAL) = ${numericValue})`
            );
          }
          
          // Condiciones exactas para campos numéricos
          conditions.push(eq(excelData.orderNumber, searchTerm));
          conditions.push(eq(excelData.customerContact, searchTerm));
        }
      }
      
      // Aplicar filtros adicionales si se proporcionan
      if (filters) {
        // Filtro por tienda
        if (filters.storeCode && filters.storeCode !== "all") {
          conditions.push(eq(excelData.storeCode, filters.storeCode));
        }
        
        // Filtros específicos por campo de texto
        if (filters.customerName) {
          conditions.push(like(excelData.customerName, `%${filters.customerName}%`));
        }
        
        if (filters.customerContact) {
          conditions.push(like(excelData.customerContact, `%${filters.customerContact}%`));
        }
        
        if (filters.orderNumber) {
          conditions.push(like(excelData.orderNumber, `%${filters.orderNumber}%`));
        }
        
        if (filters.itemDetails) {
          conditions.push(like(excelData.itemDetails, `%${filters.itemDetails}%`));
        }
        
        if (filters.metals) {
          conditions.push(like(excelData.metals, `%${filters.metals}%`));
        }
        
        if (filters.engravings) {
          conditions.push(like(excelData.engravings, `%${filters.engravings}%`));
        }
        
        if (filters.stones) {
          conditions.push(like(excelData.stones, `%${filters.stones}%`));
        }
        
        // Filtros de fecha
        if (filters.fromDate) {
          const fromDate = filters.fromDate instanceof Date 
            ? filters.fromDate.toISOString() 
            : new Date(filters.fromDate).toISOString();
          conditions.push(gte(excelData.orderDate, fromDate));
        }
        
        if (filters.toDate) {
          const toDate = filters.toDate instanceof Date 
            ? filters.toDate.toISOString() 
            : new Date(filters.toDate).toISOString();
          conditions.push(lte(excelData.orderDate, toDate));
        }
        
        // Filtros de precio para SQLite
        if (filters.priceExact && !isNaN(parseFloat(filters.priceExact))) {
          const price = parseFloat(filters.priceExact);
          conditions.push(
            sql`(${excelData.price} IS NOT NULL AND TRIM(${excelData.price}) != '' AND CAST(${excelData.price} AS REAL) = ${price})`
          );
        } else {
          if (filters.priceMin && !isNaN(parseFloat(filters.priceMin))) {
            const minPrice = parseFloat(filters.priceMin);
            const operator = filters.priceIncludeEqual ? '>=' : '>';
            conditions.push(
              sql`(${excelData.price} IS NOT NULL AND TRIM(${excelData.price}) != '' AND CAST(${excelData.price} AS REAL) ${sql.raw(operator)} ${minPrice})`
            );
          }
          
          if (filters.priceMax && !isNaN(parseFloat(filters.priceMax))) {
            const maxPrice = parseFloat(filters.priceMax);
            const operator = filters.priceIncludeEqual ? '<=' : '<';
            conditions.push(
              sql`(${excelData.price} IS NOT NULL AND TRIM(${excelData.price}) != '' AND CAST(${excelData.price} AS REAL) ${sql.raw(operator)} ${maxPrice})`
            );
          }
        }
      }
      
      // Construir consulta completa con drizzle
      let dbQuery = db.select().from(excelData);
      
      // Aplicar condiciones OR o AND según sea apropiado
      if (isSimpleSearch && conditions.length > 0) {
        // Para búsqueda simple, usamos OR entre todas las condiciones
        dbQuery = dbQuery.where(or(...conditions));
      } else if (conditions.length > 0) {
        // Para búsqueda avanzada, usamos AND entre todas las condiciones
        dbQuery = dbQuery.where(and(...conditions));
      }
      
      // Ordenar por fecha de orden descendente
      dbQuery = dbQuery.orderBy(desc(excelData.orderDate));
      
      // Ejecutar la consulta
      console.log("Ejecutando búsqueda con Drizzle ORM");
      const results = await dbQuery;
      
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
  
  // Implementación de métodos para señalamientos de personas
  async createSenalPersona(persona: InsertSenalPersona): Promise<SenalPersona> {
    try {
      const now = new Date();
      
      const [nuevaPersona] = await db
        .insert(senalPersonas)
        .values({
          ...persona,
          creadoEn: now,
          modificadoEn: null,
        })
        .returning();
        
      return nuevaPersona;
    } catch (error) {
      console.error("Error al crear señalamiento de persona:", error);
      throw error;
    }
  }
  
  async getSenalPersonas(incluirInactivos: boolean = false): Promise<SenalPersona[]> {
    try {
      let query = db.select().from(senalPersonas);
      
      if (!incluirInactivos) {
        query = query.where(eq(senalPersonas.estado, "Activo"));
      }
      
      const personas = await query.orderBy(
        // Ordenar primero por nivel de riesgo (Alto > Medio > Bajo)
        sql`CASE 
          WHEN ${senalPersonas.nivelRiesgo} = 'Alto' THEN 1 
          WHEN ${senalPersonas.nivelRiesgo} = 'Medio' THEN 2 
          WHEN ${senalPersonas.nivelRiesgo} = 'Bajo' THEN 3
        END`,
        // Luego por fecha de creación (más reciente primero)
        desc(senalPersonas.creadoEn)
      );
      
      return personas;
    } catch (error) {
      console.error("Error al obtener señalamientos de personas:", error);
      return [];
    }
  }
  
  async getSenalPersona(id: number): Promise<SenalPersona | undefined> {
    try {
      const [persona] = await db
        .select()
        .from(senalPersonas)
        .where(eq(senalPersonas.id, id));
        
      return persona;
    } catch (error) {
      console.error(`Error al obtener señalamiento de persona con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateSenalPersona(id: number, updates: Partial<SenalPersona>): Promise<SenalPersona | undefined> {
    try {
      const now = new Date();
      
      // Evitar actualizar campos no permitidos
      const { id: _id, creadoEn, ...validUpdates } = updates;
      
      const [persona] = await db
        .update(senalPersonas)
        .set({
          ...validUpdates,
          modificadoEn: now,
        })
        .where(eq(senalPersonas.id, id))
        .returning();
        
      return persona;
    } catch (error) {
      console.error(`Error al actualizar señalamiento de persona con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteSenalPersona(id: number, userId: number): Promise<boolean> {
    try {
      // Primero verificar si el usuario es el creador
      const [persona] = await db
        .select()
        .from(senalPersonas)
        .where(eq(senalPersonas.id, id));
        
      if (!persona || (persona.creadoPor !== userId)) {
        // La verificación de rol SuperAdmin se hace en la ruta
        return false;
      }
      
      // Eliminar las coincidencias asociadas primero
      await db
        .delete(coincidencias)
        .where(eq(coincidencias.idSenalPersona, id));
      
      // Ahora eliminar el señalamiento
      const result = await db
        .delete(senalPersonas)
        .where(eq(senalPersonas.id, id));
        
      return true;
    } catch (error) {
      console.error(`Error al eliminar señalamiento de persona con ID ${id}:`, error);
      return false;
    }
  }
  
  async searchSenalPersonas(query: string): Promise<SenalPersona[]> {
    try {
      if (!query || query.trim() === "") {
        return this.getSenalPersonas();
      }
      
      const searchTerm = query.toLowerCase();
      
      const personas = await db
        .select()
        .from(senalPersonas)
        .where(
          or(
            sql`LOWER(${senalPersonas.nombre}) LIKE ${'%' + searchTerm + '%'}`,
            sql`LOWER(${senalPersonas.documentoId}) LIKE ${'%' + searchTerm + '%'}`,
            sql`LOWER(${senalPersonas.notas}) LIKE ${'%' + searchTerm + '%'}`
          )
        )
        .orderBy(
          sql`CASE 
            WHEN ${senalPersonas.nivelRiesgo} = 'Alto' THEN 1 
            WHEN ${senalPersonas.nivelRiesgo} = 'Medio' THEN 2 
            WHEN ${senalPersonas.nivelRiesgo} = 'Bajo' THEN 3
          END`,
          desc(senalPersonas.creadoEn)
        );
        
      return personas;
    } catch (error) {
      console.error("Error al buscar señalamientos de personas:", error);
      return [];
    }
  }
  
  // Implementación de métodos para señalamientos de objetos
  async createSenalObjeto(objeto: InsertSenalObjeto): Promise<SenalObjeto> {
    try {
      const now = new Date();
      
      const [nuevoObjeto] = await db
        .insert(senalObjetos)
        .values({
          ...objeto,
          creadoEn: now,
          modificadoEn: null,
        })
        .returning();
        
      return nuevoObjeto;
    } catch (error) {
      console.error("Error al crear señalamiento de objeto:", error);
      throw error;
    }
  }
  
  async getSenalObjetos(incluirInactivos: boolean = false): Promise<SenalObjeto[]> {
    try {
      let query = db.select().from(senalObjetos);
      
      if (!incluirInactivos) {
        query = query.where(eq(senalObjetos.estado, "Activo"));
      }
      
      const objetos = await query.orderBy(
        // Ordenar primero por nivel de riesgo (Alto > Medio > Bajo)
        sql`CASE 
          WHEN ${senalObjetos.nivelRiesgo} = 'Alto' THEN 1 
          WHEN ${senalObjetos.nivelRiesgo} = 'Medio' THEN 2 
          WHEN ${senalObjetos.nivelRiesgo} = 'Bajo' THEN 3
        END`,
        // Luego por fecha de creación (más reciente primero)
        desc(senalObjetos.creadoEn)
      );
      
      return objetos;
    } catch (error) {
      console.error("Error al obtener señalamientos de objetos:", error);
      return [];
    }
  }
  
  async getSenalObjeto(id: number): Promise<SenalObjeto | undefined> {
    try {
      const [objeto] = await db
        .select()
        .from(senalObjetos)
        .where(eq(senalObjetos.id, id));
        
      return objeto;
    } catch (error) {
      console.error(`Error al obtener señalamiento de objeto con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateSenalObjeto(id: number, updates: Partial<SenalObjeto>): Promise<SenalObjeto | undefined> {
    try {
      const now = new Date();
      
      // Evitar actualizar campos no permitidos
      const { id: _id, creadoEn, ...validUpdates } = updates;
      
      const [objeto] = await db
        .update(senalObjetos)
        .set({
          ...validUpdates,
          modificadoEn: now,
        })
        .where(eq(senalObjetos.id, id))
        .returning();
        
      return objeto;
    } catch (error) {
      console.error(`Error al actualizar señalamiento de objeto con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteSenalObjeto(id: number, userId: number): Promise<boolean> {
    try {
      // Primero verificar si el usuario es el creador
      const [objeto] = await db
        .select()
        .from(senalObjetos)
        .where(eq(senalObjetos.id, id));
        
      if (!objeto || (objeto.creadoPor !== userId)) {
        // La verificación de rol SuperAdmin se hace en la ruta
        return false;
      }
      
      // Eliminar las coincidencias asociadas primero
      await db
        .delete(coincidencias)
        .where(eq(coincidencias.idSenalObjeto, id));
      
      // Ahora eliminar el señalamiento
      const result = await db
        .delete(senalObjetos)
        .where(eq(senalObjetos.id, id));
        
      return true;
    } catch (error) {
      console.error(`Error al eliminar señalamiento de objeto con ID ${id}:`, error);
      return false;
    }
  }
  
  async searchSenalObjetos(query: string): Promise<SenalObjeto[]> {
    try {
      if (!query || query.trim() === "") {
        return this.getSenalObjetos();
      }
      
      const searchTerm = query.toLowerCase();
      
      const objetos = await db
        .select()
        .from(senalObjetos)
        .where(
          or(
            sql`LOWER(${senalObjetos.descripcion}) LIKE ${'%' + searchTerm + '%'}`,
            sql`LOWER(${senalObjetos.grabacion}) LIKE ${'%' + searchTerm + '%'}`,
            sql`LOWER(${senalObjetos.notas}) LIKE ${'%' + searchTerm + '%'}`
          )
        )
        .orderBy(
          sql`CASE 
            WHEN ${senalObjetos.nivelRiesgo} = 'Alto' THEN 1 
            WHEN ${senalObjetos.nivelRiesgo} = 'Medio' THEN 2 
            WHEN ${senalObjetos.nivelRiesgo} = 'Bajo' THEN 3
          END`,
          desc(senalObjetos.creadoEn)
        );
        
      return objetos;
    } catch (error) {
      console.error("Error al buscar señalamientos de objetos:", error);
      return [];
    }
  }
  
  // Métodos para coincidencias
  async createCoincidencia(coincidencia: InsertCoincidencia): Promise<Coincidencia> {
    try {
      const now = new Date();
      
      const [nuevaCoincidencia] = await db
        .insert(coincidencias)
        .values({
          ...coincidencia,
          creadoEn: now,
          revisadoEn: null,
        })
        .returning();
        
      return nuevaCoincidencia;
    } catch (error) {
      console.error("Error al crear coincidencia:", error);
      throw error;
    }
  }
  
  async getCoincidencias(estado?: "NoLeido" | "Leido" | "Descartado", limit: number = 50): Promise<Coincidencia[]> {
    try {
      let query = db.select().from(coincidencias);
      
      if (estado) {
        query = query.where(eq(coincidencias.estado, estado));
      }
      
      const resultado = await query
        .orderBy(desc(coincidencias.creadoEn))
        .limit(limit);
        
      return resultado;
    } catch (error) {
      console.error("Error al obtener coincidencias:", error);
      return [];
    }
  }
  
  async getCoincidencia(id: number): Promise<Coincidencia | undefined> {
    try {
      const [coincidencia] = await db
        .select()
        .from(coincidencias)
        .where(eq(coincidencias.id, id));
        
      return coincidencia;
    } catch (error) {
      console.error(`Error al obtener coincidencia con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateCoincidenciaEstado(
    id: number, 
    estado: "NoLeido" | "Leido" | "Descartado", 
    revisadoPor: number, 
    notasRevision?: string
  ): Promise<Coincidencia | undefined> {
    try {
      const now = new Date();
      
      const [coincidencia] = await db
        .update(coincidencias)
        .set({
          estado,
          revisadoPor,
          revisadoEn: now,
          ...(notasRevision && { notasRevision }),
        })
        .where(eq(coincidencias.id, id))
        .returning();
        
      return coincidencia;
    } catch (error) {
      console.error(`Error al actualizar estado de coincidencia con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getCoincidenciasByExcelDataId(excelDataId: number): Promise<Coincidencia[]> {
    try {
      const coincidenciasResult = await db
        .select()
        .from(coincidencias)
        .where(eq(coincidencias.idExcelData, excelDataId))
        .orderBy(
          // Ordenar primero por no leídos y luego por fecha
          sql`CASE 
            WHEN ${coincidencias.estado} = 'NoLeido' THEN 1 
            WHEN ${coincidencias.estado} = 'Leido' THEN 2 
            WHEN ${coincidencias.estado} = 'Descartado' THEN 3
          END`,
          desc(coincidencias.creadoEn)
        );
        
      return coincidenciasResult;
    } catch (error) {
      console.error(`Error al obtener coincidencias para excelDataId ${excelDataId}:`, error);
      return [];
    }
  }
  
  async getNumeroCoincidenciasNoLeidas(): Promise<number> {
    try {
      const resultado = await db
        .select({ count: sql`COUNT(*)` })
        .from(coincidencias)
        .where(eq(coincidencias.estado, "NoLeido"));
        
      return Number(resultado[0]?.count || 0);
    } catch (error) {
      console.error("Error al obtener número de coincidencias no leídas:", error);
      return 0;
    }
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
    try {
      // Usar la API de Drizzle en lugar de SQL directo
      let query = db.select().from(watchlistPersons);
      
      // Filtrar por status si es necesario
      if (!includeInactive) {
        query = query.where(eq(watchlistPersons.status, 'Activo'));
      }
      
      // Ordenar por fecha de creación descendente
      query = query.orderBy(desc(watchlistPersons.createdAt));
      
      // Ejecutar la consulta
      const results = await query;
      
      return results;
    } catch (error) {
      console.error("Error obteniendo personas de la lista de vigilancia:", error);
      return [];
    }
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
        lastUpdated: new Date() // Usar objeto Date directamente, no convertir a string
      })
      .where(eq(watchlistPersons.id, id))
      .returning();
    return !!updated;
  }
  
  async searchWatchlistPersons(query: string): Promise<WatchlistPerson[]> {
    try {
      const searchTerm = `%${query}%`;
      
      // Usar la API de Drizzle en lugar de SQL directo
      const results = await db
        .select()
        .from(watchlistPersons)
        .where(
          and(
            eq(watchlistPersons.status, 'Activo'),
            or(
              like(watchlistPersons.fullName, searchTerm),
              like(watchlistPersons.identificationNumber, searchTerm),
              like(watchlistPersons.phone, searchTerm)
            )
          )
        )
        .orderBy(desc(watchlistPersons.createdAt));
      
      return results;
    } catch (error) {
      console.error("Error buscando personas en lista de vigilancia:", error);
      return [];
    }
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
      lastUpdated: new Date() // Usar objeto Date directamente, no convertir a string
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
        lastUpdated: new Date() // Usar objeto Date directamente, no convertir a string
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
      
      // Ejecutar la consulta SQL directa con sqlite
      const stmt = sqlite.prepare(sql);
      const result = stmt.all(...params);
      return result as Alert[];
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
      resolvedAt: new Date() // Usar objeto Date directamente, no convertir a string
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
      const stmt = sqlite.prepare(
        `INSERT INTO search_history (user_id, search_type, search_terms, search_date, result_count, filters) 
         VALUES (?, ?, ?, datetime('now'), ?, ?) RETURNING *`
      );
      
      const result = stmt.get(
        searchHistory.userId, 
        searchHistory.searchType, 
        searchHistory.searchTerms, 
        searchHistory.resultCount,
        searchHistory.filters || null
      );
      
      if (result) {
        return result as SearchHistory;
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
      // Usar SQL directo con sqlite
      const stmt = sqlite.prepare(
        `SELECT * FROM search_history WHERE user_id = ? ORDER BY search_date DESC LIMIT ?`
      );
      
      const results = stmt.all(userId, limit);
      
      if (results && Array.isArray(results)) {
        return results.map(row => {
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
  
  // Métodos para gestionar Señalamientos de Personas
  async createSenalPersona(persona: InsertSenalPersona): Promise<SenalPersona> {
    try {
      const now = new Date(); // No convertir a string, dejarlo como objeto Date
      const values = {
        ...persona,
        creadoEn: now
      };
      
      const [newPersona] = await db
        .insert(senalPersonas)
        .values(values)
        .returning();
      
      return newPersona;
    } catch (error) {
      console.error("Error al crear señalamiento de persona:", error);
      throw error;
    }
  }
  
  async getSenalPersonas(incluirInactivos: boolean = false): Promise<SenalPersona[]> {
    try {
      let query = db.select().from(senalPersonas);
      
      if (!incluirInactivos) {
        query = query.where(eq(senalPersonas.estado, "Activo"));
      }
      
      const personas = await query.orderBy(desc(senalPersonas.creadoEn));
      return personas;
    } catch (error) {
      console.error("Error al obtener señalamientos de personas:", error);
      return [];
    }
  }
  
  async getSenalPersona(id: number): Promise<SenalPersona | undefined> {
    try {
      const [persona] = await db
        .select()
        .from(senalPersonas)
        .where(eq(senalPersonas.id, id));
      
      return persona;
    } catch (error) {
      console.error(`Error al obtener señalamiento de persona con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateSenalPersona(id: number, updates: Partial<SenalPersona>): Promise<SenalPersona | undefined> {
    try {
      const updateData = {
        ...updates,
        modificadoEn: new Date() // No convertir a string, dejarlo como objeto Date
      };
      
      const [updated] = await db
        .update(senalPersonas)
        .set(updateData)
        .where(eq(senalPersonas.id, id))
        .returning();
      
      return updated;
    } catch (error) {
      console.error(`Error al actualizar señalamiento de persona con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteSenalPersona(id: number, userId: number): Promise<boolean> {
    try {
      // En lugar de eliminar, marcamos como inactivo
      const [updated] = await db
        .update(senalPersonas)
        .set({
          estado: "Inactivo",
          modificadoPor: userId,
          modificadoEn: new Date() // No convertir a string, dejarlo como objeto Date
        })
        .where(eq(senalPersonas.id, id))
        .returning();
      
      return !!updated;
    } catch (error) {
      console.error(`Error al eliminar señalamiento de persona con ID ${id}:`, error);
      return false;
    }
  }
  
  async searchSenalPersonas(query: string): Promise<SenalPersona[]> {
    try {
      const searchQuery = `%${query}%`;
      
      const personas = await db
        .select()
        .from(senalPersonas)
        .where(
          and(
            eq(senalPersonas.estado, "Activo"),
            or(
              like(senalPersonas.nombre, searchQuery),
              like(senalPersonas.documentoId, searchQuery)
            )
          )
        )
        .orderBy(desc(senalPersonas.creadoEn));
      
      return personas;
    } catch (error) {
      console.error("Error al buscar señalamientos de personas:", error);
      return [];
    }
  }
  
  // Métodos para gestionar Señalamientos de Objetos
  async createSenalObjeto(objeto: InsertSenalObjeto): Promise<SenalObjeto> {
    try {
      // No establecemos creadoEn manualmente ya que el esquema tiene defaultNow()
      const [newObjeto] = await db
        .insert(senalObjetos)
        .values(objeto)
        .returning();
      
      return newObjeto;
    } catch (error) {
      console.error("Error al crear señalamiento de objeto:", error);
      throw error;
    }
  }
  
  async getSenalObjetos(incluirInactivos: boolean = false): Promise<SenalObjeto[]> {
    try {
      let query = db.select().from(senalObjetos);
      
      if (!incluirInactivos) {
        query = query.where(eq(senalObjetos.estado, "Activo"));
      }
      
      const objetos = await query.orderBy(desc(senalObjetos.creadoEn));
      return objetos;
    } catch (error) {
      console.error("Error al obtener señalamientos de objetos:", error);
      return [];
    }
  }
  
  async getSenalObjeto(id: number): Promise<SenalObjeto | undefined> {
    try {
      const [objeto] = await db
        .select()
        .from(senalObjetos)
        .where(eq(senalObjetos.id, id));
      
      return objeto;
    } catch (error) {
      console.error(`Error al obtener señalamiento de objeto con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateSenalObjeto(id: number, updates: Partial<SenalObjeto>): Promise<SenalObjeto | undefined> {
    try {
      const updateData = {
        ...updates,
        modificadoEn: new Date() // No convertir a string, dejarlo como objeto Date
      };
      
      const [updated] = await db
        .update(senalObjetos)
        .set(updateData)
        .where(eq(senalObjetos.id, id))
        .returning();
      
      return updated;
    } catch (error) {
      console.error(`Error al actualizar señalamiento de objeto con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteSenalObjeto(id: number, userId: number): Promise<boolean> {
    try {
      // En lugar de eliminar, marcamos como inactivo
      const [updated] = await db
        .update(senalObjetos)
        .set({
          estado: "Inactivo",
          modificadoPor: userId,
          modificadoEn: new Date() // No convertir a string, dejarlo como objeto Date
        })
        .where(eq(senalObjetos.id, id))
        .returning();
      
      return !!updated;
    } catch (error) {
      console.error(`Error al eliminar señalamiento de objeto con ID ${id}:`, error);
      return false;
    }
  }
  
  async searchSenalObjetos(query: string): Promise<SenalObjeto[]> {
    try {
      const searchQuery = `%${query}%`;
      
      const objetos = await db
        .select()
        .from(senalObjetos)
        .where(
          and(
            eq(senalObjetos.estado, "Activo"),
            or(
              like(senalObjetos.descripcion, searchQuery),
              like(senalObjetos.grabacion, searchQuery)
            )
          )
        )
        .orderBy(desc(senalObjetos.creadoEn));
      
      return objetos;
    } catch (error) {
      console.error("Error al buscar señalamientos de objetos:", error);
      return [];
    }
  }
  
  // Métodos para gestionar Coincidencias
  async createCoincidencia(coincidencia: InsertCoincidencia): Promise<Coincidencia> {
    try {
      // No establecemos creadoEn manualmente ya que el esquema tiene defaultNow()
      const [newCoincidencia] = await db
        .insert(coincidencias)
        .values(coincidencia)
        .returning();
      
      return newCoincidencia;
    } catch (error) {
      console.error("Error al crear coincidencia:", error);
      throw error;
    }
  }
  
  async getCoincidencias(estado?: "NoLeido" | "Leido" | "Descartado", limit: number = 50): Promise<Coincidencia[]> {
    try {
      let query = db.select().from(coincidencias);
      
      if (estado) {
        query = query.where(eq(coincidencias.estado, estado));
      }
      
      const resultados = await query
        .orderBy(desc(coincidencias.creadoEn))
        .limit(limit);
      
      return resultados;
    } catch (error) {
      console.error("Error al obtener coincidencias:", error);
      return [];
    }
  }
  
  async getCoincidencia(id: number): Promise<Coincidencia | undefined> {
    try {
      const [coincidencia] = await db
        .select()
        .from(coincidencias)
        .where(eq(coincidencias.id, id));
      
      return coincidencia;
    } catch (error) {
      console.error(`Error al obtener coincidencia con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async updateCoincidenciaEstado(
    id: number,
    estado: "NoLeido" | "Leido" | "Descartado",
    userId: number,
    notas?: string
  ): Promise<Coincidencia | undefined> {
    try {
      const updateData: Partial<Coincidencia> = {
        estado,
        revisadoPor: userId,
        revisadoEn: new Date() // Usar objeto Date directamente, no convertir a string
      };
      
      if (notas) {
        updateData.notasRevision = notas;
      }
      
      const [updated] = await db
        .update(coincidencias)
        .set(updateData)
        .where(eq(coincidencias.id, id))
        .returning();
      
      return updated;
    } catch (error) {
      console.error(`Error al actualizar estado de coincidencia con ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getCoincidenciasByExcelDataId(excelDataId: number): Promise<Coincidencia[]> {
    try {
      const resultados = await db
        .select()
        .from(coincidencias)
        .where(eq(coincidencias.idExcelData, excelDataId))
        .orderBy(desc(coincidencias.creadoEn));
      
      return resultados;
    } catch (error) {
      console.error(`Error al obtener coincidencias para excelDataId ${excelDataId}:`, error);
      return [];
    }
  }
  
  async getNumeroCoincidenciasNoLeidas(): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(coincidencias)
        .where(eq(coincidencias.estado, "NoLeido"));
      
      return result[0]?.count ?? 0;
    } catch (error) {
      console.error("Error al obtener número de coincidencias no leídas:", error);
      return 0;
    }
  }
  
  // Método para detectar coincidencias con algoritmo de similitud
  async detectarCoincidencias(excelDataId: number): Promise<{ nuevasCoincidencias: number }> {
    try {
      console.log(`Detectando coincidencias para registro Excel ID: ${excelDataId}`);
      let nuevasCoincidencias = 0;
      
      // 1. Obtener el registro de Excel
      const excelData = await this.getExcelDataById(excelDataId);
      if (!excelData) {
        console.log(`No se encontró el registro de Excel con ID ${excelDataId}`);
        return { nuevasCoincidencias: 0 };
      }
      
      // 2. Obtener todos los señalamientos activos
      const personas = await this.getSenalPersonas(false);
      const objetos = await this.getSenalObjetos(false);
      
      console.log(`Comparando con ${personas.length} señalamientos de personas y ${objetos.length} señalamientos de objetos`);
      
      // 3. Buscar coincidencias con personas (por nombre o documento)
      if (excelData.customerName) {
        for (const persona of personas) {
          const puntuacion = this.calcularPuntuacionSimilitud(
            excelData.customerName.toLowerCase(),
            persona.nombre.toLowerCase()
          );
          
          if (puntuacion >= 70) { // 70% o más de similitud
            // Crear registro de coincidencia
            await this.createCoincidencia({
              tipoCoincidencia: "Persona",
              idSenalPersona: persona.id,
              idExcelData: excelData.id,
              puntuacionCoincidencia: puntuacion,
              tipoMatch: puntuacion >= 95 ? "Exacto" : "Parcial",
              campoCoincidente: "nombre",
              valorCoincidente: excelData.customerName,
              estado: "NoLeido"
            });
            
            console.log(`Coincidencia de PERSONA detectada: ${persona.nombre} con ${excelData.customerName}, puntuación: ${puntuacion}`);
          }
        }
      }
      
      // 4. Buscar coincidencias con objetos por grabaciones
      if (excelData.engravings) {
        for (const objeto of objetos) {
          if (objeto.grabacion) {
            const puntuacion = this.calcularPuntuacionSimilitud(
              excelData.engravings.toLowerCase(),
              objeto.grabacion.toLowerCase()
            );
            
            if (puntuacion >= 70) { // 70% o más de similitud
              // Crear registro de coincidencia
              await this.createCoincidencia({
                tipoCoincidencia: "Objeto",
                idSenalObjeto: objeto.id,
                idExcelData: excelData.id,
                puntuacionCoincidencia: puntuacion,
                tipoMatch: puntuacion >= 95 ? "Exacto" : "Parcial",
                campoCoincidente: "grabacion",
                valorCoincidente: excelData.engravings,
                estado: "NoLeido"
              });
              
              console.log(`Coincidencia de OBJETO por grabación detectada: ${objeto.grabacion} con ${excelData.engravings}, puntuación: ${puntuacion}`);
            }
          }
        }
      }
      
      // 5. Buscar coincidencias con objetos por descripción
      if (excelData.itemDetails) {
        for (const objeto of objetos) {
          const puntuacion = this.calcularPuntuacionSimilitud(
            excelData.itemDetails.toLowerCase(),
            objeto.descripcion.toLowerCase()
          );
          
          if (puntuacion >= 70) { // 70% o más de similitud
            // Crear registro de coincidencia
            await this.createCoincidencia({
              tipoCoincidencia: "Objeto",
              idSenalObjeto: objeto.id,
              idExcelData: excelData.id,
              puntuacionCoincidencia: puntuacion,
              tipoMatch: puntuacion >= 95 ? "Exacto" : "Parcial",
              campoCoincidente: "descripcion",
              valorCoincidente: excelData.itemDetails,
              estado: "NoLeido"
            });
            
            console.log(`Coincidencia de OBJETO por descripción detectada: ${objeto.descripcion} con ${excelData.itemDetails}, puntuación: ${puntuacion}`);
          }
        }
      }
      
      // Contar cuántas coincidencias nuevas se encontraron
      const coincidenciasActuales = await this.getCoincidenciasByExcelDataId(excelDataId);
      nuevasCoincidencias = coincidenciasActuales.length;
      
      return { nuevasCoincidencias };
    } catch (error) {
      console.error(`Error al detectar coincidencias para excelDataId ${excelDataId}:`, error);
      return { nuevasCoincidencias: 0 };
    }
  }
  
  // Función para calcular similitud entre dos cadenas (algoritmo de Levenshtein normalizado)
  private calcularPuntuacionSimilitud(cadena1: string, cadena2: string): number {
    // Normalizar las cadenas (eliminar espacios extra, acentos, etc.)
    cadena1 = this.normalizarTexto(cadena1);
    cadena2 = this.normalizarTexto(cadena2);
    
    // Verificar si es una coincidencia exacta
    if (cadena1 === cadena2) {
      return 100;
    }
    
    // Calcular distancia de Levenshtein
    const distancia = this.calcularDistanciaLevenshtein(cadena1, cadena2);
    
    // Normalizar la puntuación (100 - porcentaje de diferencia)
    const longitudMaxima = Math.max(cadena1.length, cadena2.length);
    if (longitudMaxima === 0) return 100; // Ambas cadenas vacías
    
    const puntuacion = 100 - Math.round((distancia / longitudMaxima) * 100);
    
    return puntuacion;
  }
  
  private normalizarTexto(texto: string): string {
    // Convertir a minúsculas y eliminar espacios extra
    let resultado = texto.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Eliminar acentos
    resultado = resultado.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Eliminar caracteres especiales
    resultado = resultado.replace(/[^\w\s]/gi, '');
    
    return resultado;
  }
  
  private calcularDistanciaLevenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    
    // Inicialización de la matriz
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Cálculo de la distancia
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const costo = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // eliminación
          matrix[i][j - 1] + 1,      // inserción
          matrix[i - 1][j - 1] + costo // sustitución
        );
      }
    }
    
    return matrix[b.length][a.length];
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
