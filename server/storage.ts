import { 
  users, stores, systemConfigs, fileActivities, excelData, pdfDocuments,
  type User, type InsertUser, type Store, type InsertStore, 
  type SystemConfig, type InsertSystemConfig, type FileActivity, 
  type InsertFileActivity, type ExcelData, type InsertExcelData,
  type PdfDocument, type InsertPdfDocument
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
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
  getRecentFileActivities(limit: number): Promise<FileActivity[]>;
  getFileActivitiesByStore(storeCode: string): Promise<FileActivity[]>;
  
  // ExcelData methods
  createExcelData(data: InsertExcelData): Promise<ExcelData>;
  getExcelDataByStore(storeCode: string): Promise<ExcelData[]>;
  searchExcelData(query: string, filters?: any): Promise<ExcelData[]>;
  getExcelDataById(id: number): Promise<ExcelData | undefined>;
  
  // PdfDocument methods
  createPdfDocument(doc: InsertPdfDocument): Promise<PdfDocument>;
  getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private stores: Map<number, Store>;
  private systemConfigs: Map<string, SystemConfig>;
  private fileActivities: Map<number, FileActivity>;
  private excelData: Map<number, ExcelData>;
  private pdfDocuments: Map<number, PdfDocument>;
  
  sessionStore: any; // Using any to bypass type issues with express-session
  
  private userId: number;
  private storeId: number;
  private configId: number;
  private activityId: number;
  private excelDataId: number;
  private pdfDocumentId: number;

  constructor() {
    this.users = new Map();
    this.stores = new Map();
    this.systemConfigs = new Map();
    this.fileActivities = new Map();
    this.excelData = new Map();
    this.pdfDocuments = new Map();
    
    this.userId = 1;
    this.storeId = 1;
    this.configId = 1;
    this.activityId = 1;
    this.excelDataId = 1;
    this.pdfDocumentId = 1;
    
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
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
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
  
  async getRecentFileActivities(limit: number): Promise<FileActivity[]> {
    return await db
      .select()
      .from(fileActivities)
      .orderBy(desc(fileActivities.processingDate))
      .limit(limit);
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
  
  // Nuevos métodos de ExcelData para búsqueda
  async searchExcelData(query: string, filters?: any): Promise<ExcelData[]> {
    const searchQuery = `%${query}%`;
    let baseQuery = db
      .select()
      .from(excelData);
      
    // Aplicar búsqueda por texto en múltiples campos
    baseQuery = baseQuery.where(
      or(
        like(excelData.customerName, searchQuery),
        like(excelData.customerContact, searchQuery),
        like(excelData.orderNumber, searchQuery),
        like(excelData.itemDetails, searchQuery),
        like(excelData.metals, searchQuery),
        like(excelData.engravings, searchQuery),
        like(excelData.pawnTicket, searchQuery)
      )
    );
    
    // Aplicar filtros adicionales si están presentes
    if (filters) {
      if (filters.storeCode) {
        baseQuery = baseQuery.where(eq(excelData.storeCode, filters.storeCode));
      }
      
      if (filters.dateFrom && filters.dateTo) {
        baseQuery = baseQuery.where(
          and(
            gte(excelData.orderDate, filters.dateFrom),
            lte(excelData.orderDate, filters.dateTo)
          )
        );
      }
    }
    
    return await baseQuery.orderBy(desc(excelData.orderDate));
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
    let query = db.select().from(watchlistPersons);
    
    if (!includeInactive) {
      query = query.where(eq(watchlistPersons.status, "Activo"));
    }
    
    return await query.orderBy(desc(watchlistPersons.createdAt));
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
    return await db
      .select()
      .from(watchlistPersons)
      .where(
        and(
          eq(watchlistPersons.status, "Activo"),
          or(
            like(watchlistPersons.fullName, searchQuery),
            like(watchlistPersons.identificationNumber, searchQuery),
            like(watchlistPersons.phone, searchQuery)
          )
        )
      )
      .orderBy(desc(watchlistPersons.createdAt));
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
    let query = db.select().from(alerts);
    
    if (status) {
      query = query.where(eq(alerts.status, status));
    }
    
    return await query
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
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
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.excelDataId, excelDataId))
      .orderBy(desc(alerts.createdAt));
  }
  
  // Search History methods
  async addSearchHistory(searchHistory: InsertSearchHistory): Promise<SearchHistory> {
    const [history] = await db
      .insert(searchHistory)
      .values(searchHistory)
      .returning();
    return history;
  }
  
  async getRecentSearches(userId: number, limit: number = 10): Promise<SearchHistory[]> {
    return await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.searchDate))
      .limit(limit);
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
