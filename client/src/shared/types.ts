// Tipos compartidos en toda la aplicación

export interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
}

export interface ExcelData {
  id: number;
  storeCode: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerContact: string;
  customerAddress?: string; // Añadido: dirección del cliente
  customerLocation?: string; // Añadido: provincia/país del cliente
  itemDetails: string;
  metals: string;
  engravings: string;
  stones: string;
  carats: string;
  price: string;
  pawnTicket: string;
  saleDate: string | null;
  fileActivityId: number;
  itemWeight?: string; // Añadido: peso del artículo
}

export interface ExcelSearchResults {
  results: ExcelData[];
  count: number;
  searchType: string;
}