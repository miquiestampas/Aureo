import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("User"),
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
export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // Excel o PDF
  district: text("district"), // Campo DISTRITO
  locality: text("locality"), // Campo LOCALIDAD
  active: integer("active").notNull().default(1), // 1 = true, 0 = false
  createdAt: text("created_at").notNull().default(String(new Date().toISOString())), // Fecha de grabación en el sistema
  // Campos adicionales
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  cif: text("cif"), // CIF (Código de Identificación Fiscal)
  businessName: text("business_name"), // Razón social
  ownerName: text("owner_name"), // Nombre del propietario
  ownerIdNumber: text("owner_id_number"), // DNI del propietario
  startDate: text("start_date"), // Fecha inicio actividad
  endDate: text("end_date"), // Fecha cese para las no activas
  notes: text("notes"), // Anotaciones adicionales
});

export const insertStoreSchema = createInsertSchema(stores).pick({
  code: true,
  name: true,
  type: true,
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
export const systemConfigs = sqliteTable("system_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
export const fileActivities = sqliteTable("file_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  storeCode: text("store_code").notNull(),
  fileType: text("file_type").notNull(), // "Excel" o "PDF"
  status: text("status").notNull(), // "Pending", "Processing", "Processed", "Failed", "PendingStoreAssignment"
  processingDate: text("processing_date").notNull().default(String(new Date().toISOString())),
  processedBy: text("processed_by").notNull(),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // Guardado como JSON stringificado
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
export const excelData = sqliteTable("excel_data", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeCode: text("store_code").notNull(),
  orderNumber: text("order_number").notNull(),
  orderDate: text("order_date").notNull(), // ISO date string
  customerName: text("customer_name"),
  customerContact: text("customer_contact"),
  country: text("country"),
  itemDetails: text("item_details"),
  metals: text("metals"),
  engravings: text("engravings"),
  stones: text("stones"),
  carats: text("carats"),
  price: text("price"),
  pawnTicket: text("pawn_ticket"),
  saleDate: text("sale_date"), // ISO date string
  fileActivityId: integer("file_activity_id").notNull(),
});

export const insertExcelDataSchema = createInsertSchema(excelData).pick({
  storeCode: true,
  orderNumber: true,
  orderDate: true,
  customerName: true,
  customerContact: true,
  country: true,
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
export const pdfDocuments = sqliteTable("pdf_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeCode: text("store_code").notNull(),
  documentType: text("document_type"),
  title: text("title"),
  path: text("path").notNull(),
  uploadDate: text("upload_date").notNull().default(String(new Date().toISOString())),
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
export const watchlistPersons = sqliteTable("watchlist_persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("fullname").notNull(),
  identificationNumber: text("identificationnumber"), // Número de identificación como DUI, pasaporte, etc.
  phone: text("phone"),
  notes: text("notes"),
  riskLevel: text("risklevel").notNull().default("Medio"), // "Alto", "Medio", "Bajo"
  status: text("status").notNull().default("Activo"), // "Activo", "Inactivo"
  createdAt: text("createdat").notNull().default(String(new Date().toISOString())),
  createdBy: integer("createdby").notNull(), // ID del usuario que agregó el registro
  lastUpdated: text("lastupdated"),
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
export const watchlistItems = sqliteTable("watchlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemType: text("itemtype").notNull(), // Tipo de joya, electrónico, etc.
  description: text("description").notNull(),
  serialNumber: text("serialnumber"),
  identificationMarks: text("identificationmarks"), // Marcas distintivas, grabados, etc.
  model: text("model"),
  brand: text("brand"),
  notes: text("notes"),
  riskLevel: text("risklevel").notNull().default("Medio"), // "Alto", "Medio", "Bajo"
  status: text("status").notNull().default("Activo"), // "Activo", "Inactivo"
  createdAt: text("createdat").notNull().default(String(new Date().toISOString())),
  createdBy: integer("createdby").notNull(), // ID del usuario que agregó el registro
  lastUpdated: text("lastupdated"),
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
export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertType: text("alert_type").notNull(), // "Persona", "Objeto"
  excelDataId: integer("excel_data_id").notNull(), // ID del registro de excelData que generó la alerta
  watchlistPersonId: integer("watchlist_person_id"), // ID de la persona en watchlist (si es alerta de persona)
  watchlistItemId: integer("watchlist_item_id"), // ID del objeto en watchlist (si es alerta de objeto)
  matchConfidence: integer("match_confidence").notNull(), // Porcentaje de confianza en la coincidencia (0-100)
  status: text("status").notNull().default("Nueva"), // "Nueva", "Revisada", "Falsa"
  reviewedBy: integer("reviewed_by"), // ID del usuario que revisó la alerta
  reviewNotes: text("review_notes"),
  createdAt: text("created_at").notNull().default(String(new Date().toISOString())),
  resolvedAt: text("resolved_at"),
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
export const searchHistory = sqliteTable("search_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  searchType: text("search_type").notNull(), // "Cliente", "Artículo", "Orden", "General"
  searchTerms: text("search_terms").notNull(),
  searchDate: text("search_date").notNull().default(String(new Date().toISOString())),
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
export const senalPersonas = sqliteTable("senal_personas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre"),  // Ya no es notNull para permitir registros con solo DNI
  documentoId: text("documento_id"),  // DNI, NIE, pasaporte
  notas: text("notas"),
  estado: text("estado").notNull().default("Activo"), // "Activo", "Inactivo"
  creadoPor: integer("creado_por").notNull(), // ID del usuario creador
  creadoEn: text("creado_en").notNull().default(String(new Date().toISOString())),
  modificadoPor: integer("modificado_por"), // ID del usuario que modificó
  modificadoEn: text("modificado_en"),
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
export const senalObjetos = sqliteTable("senal_objetos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  descripcion: text("descripcion"),  // Ya no es notNull para permitir registros con otros campos
  grabacion: text("grabacion"),  // Grabados específicos
  notas: text("notas"),
  estado: text("estado").notNull().default("Activo"), // "Activo", "Inactivo"
  creadoPor: integer("creado_por").notNull(), // ID del usuario creador
  creadoEn: text("creado_en").notNull().default(String(new Date().toISOString())),
  modificadoPor: integer("modificado_por"), // ID del usuario que modificó
  modificadoEn: text("modificado_en"),
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
export const coincidencias = sqliteTable("coincidencias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tipoCoincidencia: text("tipo_coincidencia").notNull(), // "Persona", "Objeto"
  idSenalPersona: integer("id_senal_persona"),
  idSenalObjeto: integer("id_senal_objeto"),
  idExcelData: integer("id_excel_data").notNull(),
  puntuacionCoincidencia: integer("puntuacion_coincidencia").notNull(), // 0-100
  tipoMatch: text("tipo_match").notNull(), // "Exacta", "Alta", "Media", "Baja"
  campoCoincidente: text("campo_coincidente").notNull(), // nombre, documento, descripcion, grabacion
  valorCoincidente: text("valor_coincidente").notNull(), // El valor que coincidió
  estado: text("estado").notNull().default("NoLeido"), // "NoLeido", "Leido", "Descartado"
  revisadoPor: integer("revisado_por"), // ID del usuario que revisó
  notasRevision: text("notas_revision"),
  creadoEn: text("creado_en").notNull().default(String(new Date().toISOString())),
  revisadoEn: text("revisado_en"),
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