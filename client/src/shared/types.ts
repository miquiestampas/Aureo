// Tipos compartidos para toda la aplicación

// Tipo para representar una Tienda
export interface Store {
  id: number;
  code: string;
  name: string;
  location: string;
  type: string;
  active: boolean;
  // Campos adicionales
  openingDate?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// Tipo para datos de Excel
export interface ExcelData {
  id: number;
  orderNumber: string;
  storeCode: string;
  customerName: string;
  customerContact?: string;
  itemDetails: string;
  orderDate: string;
  price: string;
  documentId?: string;
  metals?: string;
  stones?: string;
  engravings?: string;
  archived?: boolean;
}

// Respuesta de búsqueda en los datos de Excel
export interface ExcelSearchResults {
  count: number;
  results: ExcelData[];
}

// Alertas
export interface Alert {
  id: number;
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
  viewed: boolean;
}

// Usuarios
export interface User {
  id: number;
  username: string;
  name: string;
  role: "admin" | "user" | "viewer";
  active: boolean;
}

// Documentos PDF
export interface PdfDocument {
  id: number;
  filename: string;
  storeCode: string;
  processingDate: string;
  size: number;
  path: string;
}

// Actividad de procesamiento de archivos
export interface FileActivity {
  id: number;
  fileType: "excel" | "pdf";
  filename: string;
  storeCode: string;
  processingDate: string;
  status: "success" | "error" | "processing";
  errorMessage?: string;
  fileId?: number;
}

// Señalamientos de personas
export interface SenalPersona {
  id: number;
  nombre: string;
  identificacion: string;
  fechaNacimiento?: string;
  nacionalidad?: string;
  motivo: string;
  interesado?: string;
  notas?: string;
  fechaCreacion: string;
}

// Señalamientos de objetos
export interface SenalObjeto {
  id: number;
  tipo: string;
  descripcion: string;
  procedencia?: string;
  propietario?: string;
  motivo: string;
  interesado?: string;
  notas?: string;
  fechaCreacion: string;
}

// Coincidencias con señalamientos
export interface Coincidencia {
  id: number;
  tipo: "persona" | "objeto";
  excelDataId: number;
  senalId: number;
  similarity: number;
  createdAt: string;
  viewed: boolean;
  excelData?: ExcelData;
  senal?: SenalPersona | SenalObjeto;
  interesado?: string;
  notas?: string;
}

// Estadísticas de tienda
export interface StoreStats {
  totalDocuments: number;
  lastActivity?: string;
  documentsLast30Days: number;
  alertsCount: number;
  storeId: number;
}

// Estadísticas avanzadas de tienda
export interface StoreAdvancedStats {
  monthlyCounts: Array<{month: string, count: number}>;
  averagePrice?: number;
  topCustomers: Array<{name: string, count: number}>;
  storeId: number;
}