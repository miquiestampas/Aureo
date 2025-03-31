import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  AlertCircle,
  Calendar, 
  CalendarIcon, 
  FileText, 
  Download, 
  Eye, 
  Search,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StoreSelector } from "@/components/StoreSelector";

interface PdfDocument {
  id: number;
  path: string;
  storeCode: string;
  fileActivityId: number;
  documentType: string | null;
  title: string | null;
  uploadDate: string;
  fileSize: number | null;
  storeName?: string;
  storeLocation?: string;
  storeDistrict?: string;
  storeLocality?: string;
}

export default function PdfListingsPage() {
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [locality, setLocality] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [recentDocs, setRecentDocs] = useState<PdfDocument[]>([]);
  const { toast } = useToast();
  
  // Obtener información de la tienda seleccionada
  const { data: stores } = useQuery<any[]>({
    queryKey: ['/api/stores'],
  });
  
  // Consulta para obtener los 10 últimos documentos PDF por defecto
  const {
    data: recentPdfDocuments,
    isLoading: isLoadingRecent,
    error: recentError
  } = useQuery<PdfDocument[]>({
    queryKey: ["/api/pdf-documents/recent"],
    queryFn: async () => {
      const response = await fetch("/api/pdf-documents?recent=true&limit=10");
      if (!response.ok) {
        throw new Error("Error al cargar documentos PDF recientes");
      }
      return response.json();
    },
  });
  
  // Manejar cambio de tienda seleccionada
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    
    if (storeId && stores) {
      const selectedStore = stores.find(store => store.id.toString() === storeId);
      if (selectedStore) {
        setStoreCode(selectedStore.code);
        setStoreName(selectedStore.name);
      }
    } else {
      // Limpiar campos si no se selecciona ninguna tienda
      setStoreCode("");
      setStoreName("");
    }
  };

  // Construir los parámetros de búsqueda
  const buildSearchParams = () => {
    const params = new URLSearchParams();
    
    // Construir array de códigos de tienda para la búsqueda
    const storeCodes = storeCode ? [storeCode] : 
                      ["J28366AAKA5", "J28L11NKBH4", "J28L33VXBH2", "J28aa6", "J28JV", 
                      "JEXB33", "JEXB34", "JEXB35", "JEXB36", "JEXB37", "JEXB38"];
    
    // Agregar códigos de tienda
    params.append('storeCodes', JSON.stringify(storeCodes));
    
    // Agregar fechas si están presentes
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    
    return params.toString();
  };

  // Consulta de documentos PDF
  const {
    data: pdfDocuments,
    isLoading,
    error,
    refetch
  } = useQuery<PdfDocument[]>({
    queryKey: ["/api/pdf-documents/search", buildSearchParams()],
    queryFn: async () => {
      const response = await fetch(`/api/pdf-documents/search?${buildSearchParams()}`);
      if (!response.ok) {
        throw new Error("Error al buscar documentos PDF");
      }
      return response.json();
    },
    enabled: isSearching, // Solo realizar la consulta cuando se busca
  });

  // Filtrar documentos por criterios adicionales en el frontend
  const filterDocuments = (docs: PdfDocument[] | undefined) => {
    if (!docs) return [];
    
    return docs.filter(doc => {
      if (storeName && (!doc.storeName || !doc.storeName.toLowerCase().includes(storeName.toLowerCase()))) {
        return false;
      }
      if (location && (!doc.storeLocation || !doc.storeLocation.toLowerCase().includes(location.toLowerCase()))) {
        return false;
      }
      if (district && (!doc.storeDistrict || !doc.storeDistrict.toLowerCase().includes(district.toLowerCase()))) {
        return false;
      }
      if (locality && (!doc.storeLocality || !doc.storeLocality.toLowerCase().includes(locality.toLowerCase()))) {
        return false;
      }
      return true;
    });
  };

  // Documentos filtrados
  const filteredDocs = filterDocuments(pdfDocuments);

  // Manejar la búsqueda
  const handleSearch = () => {
    setIsSearching(true);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSelectedStoreId("");
    setStoreCode("");
    setStoreName("");
    setLocation("");
    setDistrict("");
    setLocality("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setIsSearching(false);
  };

  // Visualizar PDF
  const viewPdf = (id: number) => {
    window.open(`/api/file-activities/${id}/view`, "_blank");
  };

  // Descargar PDF
  const downloadPdf = (id: number, filename: string) => {
    window.open(`/api/file-activities/${id}/download`, "_blank");
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
    } catch (e) {
      return "Fecha desconocida";
    }
  };

  // Formatear tamaño de archivo
  const formatFileSize = (size: number | null) => {
    if (size === null) return "Desconocido";
    
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-8 max-w-7xl">
      <h1 className="text-3xl font-bold tracking-tight">Listados PDF</h1>
      
      {/* Sección de Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
          <CardDescription>
            Filtrar documentos PDF por tiendas y fechas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna 1: Tienda */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Selector de Tienda</label>
                <StoreSelector 
                  value={selectedStoreId}
                  onChange={handleStoreChange}
                  placeholder="Seleccione una tienda"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Código de Tienda</label>
                <Input 
                  placeholder="Código de tienda" 
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre de Tienda</label>
                <Input 
                  placeholder="Nombre de tienda" 
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </div>
            </div>
            
            {/* Columna 2: Ubicación */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Dirección</label>
                <Input 
                  placeholder="Dirección" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Distrito</label>
                  <Input 
                    placeholder="Distrito" 
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Localidad</label>
                  <Input 
                    placeholder="Localidad" 
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Columna 3: Fechas */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Desde</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full flex justify-start"
                      >
                        {dateFrom ? (
                          format(dateFrom, "dd/MM/yyyy")
                        ) : (
                          <span className="text-muted-foreground">Seleccione</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Hasta</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full flex justify-start"
                      >
                        {dateTo ? (
                          format(dateTo, "dd/MM/yyyy")
                        ) : (
                          <span className="text-muted-foreground">Seleccione</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1" 
                  onClick={handleSearch}
                  disabled={isLoading}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  disabled={isLoading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Sección de Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {isSearching && !isLoading && pdfDocuments ? 
              `${filteredDocs.length} documentos encontrados` : 
              "Utilice los filtros para buscar documentos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Estado de carga
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            // Estado de error
            <div className="text-center py-8 text-red-500">
              <p>Error al cargar documentos:</p>
              <p className="text-sm">{(error as Error).message}</p>
              <Button 
                variant="outline" 
                onClick={() => refetch()} 
                className="mt-4"
              >
                Reintentar
              </Button>
            </div>
          ) : isSearching && pdfDocuments ? (
            filteredDocs.length > 0 ? (
              // Tabla de resultados
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tienda</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="font-medium">{doc.storeCode}</div>
                          <div className="text-sm text-muted-foreground">{doc.storeName || '-'}</div>
                        </TableCell>
                        <TableCell>{doc.title || "Sin título"}</TableCell>
                        <TableCell>
                          <div>{doc.storeLocation || '-'}</div>
                          <div className="text-sm text-muted-foreground">
                            {[doc.storeDistrict, doc.storeLocality].filter(Boolean).join(', ') || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(doc.uploadDate)}</TableCell>
                        <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPdf(doc.fileActivityId)}
                              title="Ver documento"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadPdf(doc.fileActivityId, doc.title || "documento.pdf")}
                              title="Descargar documento"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Sin resultados
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>No se encontraron documentos con los criterios seleccionados</p>
              </div>
            )
          ) : isLoadingRecent ? (
            // Estado cargando documentos recientes
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : recentError ? (
            // Error al cargar documentos recientes
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Error al cargar documentos recientes</p>
              <p className="text-sm text-muted-foreground mt-2">{(recentError as Error).message}</p>
            </div>
          ) : recentPdfDocuments && recentPdfDocuments.length > 0 ? (
            // Mostrar documentos recientes
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium">Últimos 10 documentos procesados</h3>
                <p className="text-sm text-muted-foreground">Mostrando los documentos más recientes en el sistema</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tienda</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPdfDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="font-medium">{doc.storeCode}</div>
                          <div className="text-sm text-muted-foreground">{doc.storeName || '-'}</div>
                        </TableCell>
                        <TableCell>{doc.title || "Sin título"}</TableCell>
                        <TableCell>
                          <div>{doc.storeLocation || '-'}</div>
                          <div className="text-sm text-muted-foreground">
                            {[doc.storeDistrict, doc.storeLocality].filter(Boolean).join(', ') || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(doc.uploadDate)}</TableCell>
                        <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPdf(doc.fileActivityId)}
                              title="Ver documento"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadPdf(doc.fileActivityId, doc.title || "documento.pdf")}
                              title="Descargar documento"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            // Sin documentos recientes
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p>No se encontraron documentos recientes</p>
              <p className="text-sm mt-2">Use los filtros de búsqueda para encontrar documentos PDF</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}