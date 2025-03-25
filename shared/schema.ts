import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["SuperAdmin", "Admin", "User"] }).notNull().default("User"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Store model
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: ["Excel", "PDF"] }).notNull(),
  location: text("location"),
  active: boolean("active").notNull().default(true),
});

export const insertStoreSchema = createInsertSchema(stores).pick({
  code: true,
  name: true,
  type: true,
  location: true,
  active: true,
});

export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof stores.$inferSelect;

// System Config model
export const systemConfigs = pgTable("system_configs", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

export const insertSystemConfigSchema = createInsertSchema(systemConfigs).pick({
  key: true,
  value: true,
  description: true,
});

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfigs.$inferSelect;

// FileActivity model for tracking processed files
export const fileActivities = pgTable("file_activities", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  storeCode: text("store_code").notNull(),
  fileType: text("file_type", { enum: ["Excel", "PDF"] }).notNull(),
  status: text("status", { enum: ["Pending", "Processing", "Processed", "Failed"] }).notNull(),
  processingDate: timestamp("processing_date").notNull().defaultNow(),
  processedBy: text("processed_by").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
});

export const insertFileActivitySchema = createInsertSchema(fileActivities).pick({
  filename: true,
  storeCode: true,
  fileType: true,
  status: true,
  processingDate: true,
  processedBy: true,
  errorMessage: true,
  metadata: true,
});

export type InsertFileActivity = z.infer<typeof insertFileActivitySchema>;
export type FileActivity = typeof fileActivities.$inferSelect;

// Excel data model for processed excel files
export const excelData = pgTable("excel_data", {
  id: serial("id").primaryKey(),
  storeCode: text("store_code").notNull(),
  orderNumber: text("order_number").notNull(),
  orderDate: timestamp("order_date").notNull(),
  customerName: text("customer_name"),
  customerContact: text("customer_contact"),
  itemDetails: text("item_details"),
  metals: text("metals"),
  engravings: text("engravings"),
  stones: text("stones"),
  carats: text("carats"),
  price: text("price"),
  pawnTicket: text("pawn_ticket"),
  saleDate: timestamp("sale_date"),
  fileActivityId: integer("file_activity_id").notNull(),
});

export const insertExcelDataSchema = createInsertSchema(excelData).pick({
  storeCode: true,
  orderNumber: true,
  orderDate: true,
  customerName: true,
  customerContact: true,
  itemDetails: true,
  metals: true,
  engravings: true,
  stones: true,
  carats: true,
  price: true,
  pawnTicket: true,
  saleDate: true,
  fileActivityId: true,
});

export type InsertExcelData = z.infer<typeof insertExcelDataSchema>;
export type ExcelData = typeof excelData.$inferSelect;

// PDF document model for processed PDF files
export const pdfDocuments = pgTable("pdf_documents", {
  id: serial("id").primaryKey(),
  storeCode: text("store_code").notNull(),
  documentType: text("document_type"),
  title: text("title"),
  path: text("path").notNull(),
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
  fileSize: integer("file_size"),
  fileActivityId: integer("file_activity_id").notNull(),
});

export const insertPdfDocumentSchema = createInsertSchema(pdfDocuments).pick({
  storeCode: true,
  documentType: true,
  title: true,
  path: true,
  uploadDate: true,
  fileSize: true,
  fileActivityId: true,
});

export type InsertPdfDocument = z.infer<typeof insertPdfDocumentSchema>;
export type PdfDocument = typeof pdfDocuments.$inferSelect;
