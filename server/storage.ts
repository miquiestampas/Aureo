import { 
  users, stores, systemConfigs, fileActivities, excelData, pdfDocuments,
  type User, type InsertUser, type Store, type InsertStore, 
  type SystemConfig, type InsertSystemConfig, type FileActivity, 
  type InsertFileActivity, type ExcelData, type InsertExcelData,
  type PdfDocument, type InsertPdfDocument
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
  
  // PdfDocument methods
  createPdfDocument(doc: InsertPdfDocument): Promise<PdfDocument>;
  getPdfDocumentsByStore(storeCode: string): Promise<PdfDocument[]>;
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

export const storage = new MemStorage();
