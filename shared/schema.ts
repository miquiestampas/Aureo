import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, doublePrecision } from "drizzle-orm/pg-core";
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
  location: text("location"), // Campo antiguo (mantenido para compatibilidad)
  district: text("district"), // Nuevo campo DISTRITO
  locality: text("locality"), // Nuevo campo LOCALIDAD
  active: boolean("active").notNull().default(true),
  // Nuevos campos
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  cif: text("cif"), // CIF (Código de Identificación Fiscal)
  businessName: text("business_name"), // Razón social
  ownerName: text("owner_name"), // Nombre del propietario
  ownerIdNumber: text("owner_id_number"), // DNI del propietario
  startDate: date("start_date"), // Fecha inicio actividad
  endDate: date("end_date"), // Fecha cese para las no activas
  notes: text("notes"), // Anotaciones adicionales
});

export const insertStoreSchema = createInsertSchema(stores).pick({
  code: true,
  name: true,
  type: true,
  location: true,
  district: true,
  locality: true,
  active: true,
  address: true,
  phone: true,
  email: true,
  cif: true,
  businessName: true,
  ownerName: true,
  ownerIdNumber: true,
  startDate: true,
  endDate: true,
  notes: true,
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
  status: text("status", { enum: ["Pending", "Processing", "Processed", "Failed", "PendingStoreAssignment"] }).notNull(),
  processingDate: timestamp("processing_date").notNull().defaultNow(),
  processedBy: text("processed_by").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  // Campo para almacenar el código de tienda detectado pero pendiente de confirmar
  detectedStoreCode: text("detected_store_code"),
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
  detectedStoreCode: true,
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

// Persona de interés (Watchlist)
export const watchlistPersons = pgTable("watchlist_persons", {
  id: serial("id").primaryKey(),
  fullName: text("fullname").notNull(),
  identificationNumber: text("identificationnumber"), // Número de identificación como DUI, pasaporte, etc.
  phone: text("phone"),
  notes: text("notes"),
  riskLevel: text("risklevel", { enum: ["Alto", "Medio", "Bajo"] }).notNull().default("Medio"),
  status: text("status", { enum: ["Activo", "Inactivo"] }).notNull().default("Activo"),
  createdAt: timestamp("createdat").notNull().defaultNow(),
  createdBy: integer("createdby").notNull(), // ID del usuario que agregó el registro
  lastUpdated: timestamp("lastupdated"),
});

export const insertWatchlistPersonSchema = createInsertSchema(watchlistPersons).pick({
  fullName: true,
  identificationNumber: true,
  phone: true,
  notes: true,
  riskLevel: true,
  status: true,
  createdBy: true,
});

export type InsertWatchlistPerson = z.infer<typeof insertWatchlistPersonSchema>;
export type WatchlistPerson = typeof watchlistPersons.$inferSelect;

// Objeto de interés (Watchlist de artículos)
export const watchlistItems = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  itemType: text("itemtype").notNull(), // Tipo de joya, electrónico, etc.
  description: text("description").notNull(),
  serialNumber: text("serialnumber"),
  identificationMarks: text("identificationmarks"), // Marcas distintivas, grabados, etc.
  model: text("model"),
  brand: text("brand"),
  notes: text("notes"),
  riskLevel: text("risklevel", { enum: ["Alto", "Medio", "Bajo"] }).notNull().default("Medio"),
  status: text("status", { enum: ["Activo", "Inactivo"] }).notNull().default("Activo"),
  createdAt: timestamp("createdat").notNull().defaultNow(),
  createdBy: integer("createdby").notNull(), // ID del usuario que agregó el registro
  lastUpdated: timestamp("lastupdated"),
});

export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).pick({
  itemType: true,
  description: true,
  serialNumber: true,
  identificationMarks: true,
  model: true,
  brand: true,
  notes: true,
  riskLevel: true,
  status: true,
  createdBy: true,
});

export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItems.$inferSelect;

// Alertas generadas
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  alertType: text("alert_type", { enum: ["Persona", "Objeto"] }).notNull(),
  excelDataId: integer("excel_data_id").notNull(), // ID del registro de excelData que generó la alerta
  watchlistPersonId: integer("watchlist_person_id"), // ID de la persona en watchlist (si es alerta de persona)
  watchlistItemId: integer("watchlist_item_id"), // ID del objeto en watchlist (si es alerta de objeto)
  matchConfidence: integer("match_confidence").notNull(), // Porcentaje de confianza en la coincidencia (0-100)
  status: text("status", { enum: ["Nueva", "Revisada", "Falsa"] }).notNull().default("Nueva"),
  reviewedBy: integer("reviewed_by"), // ID del usuario que revisó la alerta
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAlertSchema = createInsertSchema(alerts).pick({
  alertType: true,
  excelDataId: true,
  watchlistPersonId: true,
  watchlistItemId: true,
  matchConfidence: true,
  status: true,
  reviewedBy: true,
  reviewNotes: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Historial de búsquedas
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  searchType: text("search_type", { enum: ["Cliente", "Artículo", "Orden", "General"] }).notNull(),
  searchTerms: text("search_terms").notNull(),
  searchDate: timestamp("search_date").notNull().defaultNow(),
  resultCount: integer("result_count").notNull(),
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).pick({
  userId: true,
  searchType: true,
  searchTerms: true,
  resultCount: true,
});

export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;

// Nuevo modelo para señalamientos/alertas sobre personas
export const senalPersonas = pgTable("senal_personas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre"),  // Ya no es notNull para permitir registros con solo DNI
  documentoId: text("documento_id"),  // DNI, NIE, pasaporte
  notas: text("notas"),
  estado: text("estado", { enum: ["Activo", "Inactivo"] }).notNull().default("Activo"),
  creadoPor: integer("creado_por").notNull(), // ID del usuario creador
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  modificadoPor: integer("modificado_por"), // ID del usuario que modificó
  modificadoEn: timestamp("modificado_en"),
});

export const insertSenalPersonaSchema = createInsertSchema(senalPersonas).pick({
  nombre: true,
  documentoId: true,
  notas: true,
  estado: true,
  creadoPor: true,
  modificadoPor: true,
});

export type InsertSenalPersona = z.infer<typeof insertSenalPersonaSchema>;
export type SenalPersona = typeof senalPersonas.$inferSelect;

// Nuevo modelo para señalamientos/alertas sobre objetos
export const senalObjetos = pgTable("senal_objetos", {
  id: serial("id").primaryKey(),
  descripcion: text("descripcion"),  // Ya no es notNull para permitir registros con otros campos
  grabacion: text("grabacion"),  // Grabados específicos
  notas: text("notas"),
  estado: text("estado", { enum: ["Activo", "Inactivo"] }).notNull().default("Activo"),
  creadoPor: integer("creado_por").notNull(), // ID del usuario creador
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  modificadoPor: integer("modificado_por"), // ID del usuario que modificó
  modificadoEn: timestamp("modificado_en"),
});

export const insertSenalObjetoSchema = createInsertSchema(senalObjetos).pick({
  descripcion: true,
  grabacion: true,
  notas: true,
  estado: true,
  creadoPor: true,
  modificadoPor: true,
});

export type InsertSenalObjeto = z.infer<typeof insertSenalObjetoSchema>;
export type SenalObjeto = typeof senalObjetos.$inferSelect;

// Modelo para coincidencias detectadas entre señalamientos y registros
export const coincidencias = pgTable("coincidencias", {
  id: serial("id").primaryKey(),
  tipoCoincidencia: text("tipo_coincidencia", { enum: ["Persona", "Objeto"] }).notNull(),
  idSenalPersona: integer("id_senal_persona"),
  idSenalObjeto: integer("id_senal_objeto"),
  idExcelData: integer("id_excel_data").notNull(),
  puntuacionCoincidencia: integer("puntuacion_coincidencia").notNull(), // 0-100
  tipoMatch: text("tipo_match", { enum: ["Exacto", "Parcial"] }).notNull(),
  campoCoincidente: text("campo_coincidente").notNull(), // nombre, documento, descripcion, grabacion
  valorCoincidente: text("valor_coincidente").notNull(), // El valor que coincidió
  estado: text("estado", { enum: ["NoLeido", "Leido", "Descartado"] }).notNull().default("NoLeido"),
  revisadoPor: integer("revisado_por"), // ID del usuario que revisó
  notasRevision: text("notas_revision"),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  revisadoEn: timestamp("revisado_en"),
});

export const insertCoincidenciaSchema = createInsertSchema(coincidencias).pick({
  tipoCoincidencia: true,
  idSenalPersona: true,
  idSenalObjeto: true,
  idExcelData: true,
  puntuacionCoincidencia: true,
  tipoMatch: true,
  campoCoincidente: true,
  valorCoincidente: true,
  estado: true,
  revisadoPor: true,
  notasRevision: true,
});

export type InsertCoincidencia = z.infer<typeof insertCoincidenciaSchema>;
export type Coincidencia = typeof coincidencias.$inferSelect;
