import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSocketStore } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Download,
  FileSearch,
  Eye,
  Calendar,
  Search,
  Store as StoreIcon,
  Filter
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import PdfViewer from "@/components/PdfViewer";

interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
}

interface PdfDocument {
  id: number;
  storeCode: string;
  documentType: string;
  title: string;
  path: string;
  uploadDate: string;
  fileSize: number;
  fileActivityId: number;
}

export default function PdfStoresPage() {
  const { toast } = useToast();
  const { recentEvents } = useSocketStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ id: number, title: string, storeCode: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState<string | null>(null);

  // Fetch all PDF stores
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'PDF' }],
  });
  
  // Fetch PDF documents for selected store
  const { data: pdfDocuments, refetch: refetchPdfDocs } = useQuery<PdfDocument[]>({
    queryKey: [`/api/pdf-documents`, { storeCode: storeFilter }],
    enabled: true, // Always fetch documents, filter client-side
  });
  
  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !selectedStore) return;
      
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("storeCode", selectedStore);
      
      const response = await fetch("/api/upload/pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Error al subir archivo");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Archivo subido exitosamente",
        description: "El archivo ha sido puesto en cola para su procesamiento.",
      });
      setUploadDialogOpen(false);
      setUploadFile(null);
      
      // Refetch file activity data after successful upload
      setTimeout(() => {
        refetchPdfDocs();
        queryClient.invalidateQueries({ queryKey: ['/api/file-activities'] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la subida",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };
  
  // Handle file upload
  const handleUpload = () => {
    if (!uploadFile) {
      toast({
        title: "No hay archivo seleccionado",
        description: "Por favor seleccione un archivo para subir",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate();
  };
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Refetch data when receiving socket events
  useEffect(() => {
    if (recentEvents.length > 0) {
      const lastEvent = recentEvents[0];
      
      if (lastEvent.type === 'fileProcessingStatus' && 
          lastEvent.data.status === 'Processed') {
        refetchPdfDocs();
      }
    }
  }, [recentEvents, refetchPdfDocs]);

  // Store columns for the store table
  const storeColumns: ColumnDef<Store>[] = [
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => {
        return (
          <div className="flex items-center">
            <StoreIcon className="h-4 w-4 mr-2 text-primary" />
            <span>{row.original.name}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "location",
      header: "Ubicación",
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => {
        return row.original.active ? (
          <Badge className="bg-green-500">Activo</Badge>
        ) : (
          <Badge variant="outline">Inactivo</Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        return (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setStoreFilter(row.original.code)}
            className={storeFilter === row.original.code ? "bg-primary text-white hover:bg-primary-focus" : ""}
          >
            <FileSearch className="h-4 w-4 mr-2" />
            Ver documentos
          </Button>
        );
      }
    }
  ];
  
  // Data columns for the document table
  const documentColumns: ColumnDef<PdfDocument>[] = [
    {
      accessorKey: "title",
      header: "Título del Documento",
    },
    {
      accessorKey: "documentType",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.documentType || "Desconocido";
        return (
          <div className="flex items-center">
            <span>{type}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "storeCode",
      header: "Tienda",
      cell: ({ row }) => {
        const store = stores?.find(s => s.code === row.original.storeCode);
        return (
          <div className="flex items-center">
            <StoreIcon className="h-4 w-4 mr-2 text-primary" />
            <span>{store?.name || row.original.storeCode}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "uploadDate",
      header: "Fecha de subida",
      cell: ({ row }) => {
        const date = new Date(row.original.uploadDate);
        return format(date, "d MMM yyyy, HH:mm");
      }
    },
    {
      accessorKey: "fileSize",
      header: "Tamaño",
      cell: ({ row }) => {
        return formatFileSize(row.original.fileSize);
      }
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="Ver documento"
              onClick={() => handleViewPdf(row.original)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">Ver documento</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="Descargar documento"
              onClick={() => handleDownloadPdf(row.original.id)}
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Descargar documento</span>
            </Button>
          </div>
        );
      }
    }
  ];
  
  // Handle view PDF
  const handleViewPdf = (document: PdfDocument) => {
    setSelectedDocument({
      id: document.id,
      title: document.title || `Documento-${document.id}`,
      storeCode: document.storeCode
    });
    setViewerOpen(true);
  };

  // Handle download PDF
  const handleDownloadPdf = async (documentId: number) => {
    try {
      // Crear un enlace invisible, configurarlo para descargar y hacer clic en él
      const response = await fetch(`/api/pdf-documents/${documentId}/view`);
      if (!response.ok) {
        throw new Error("Error al descargar el documento");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `documento-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error descargando PDF:", error);
      toast({
        title: "Error al descargar",
        description: "No se pudo descargar el documento PDF.",
        variant: "destructive",
      });
    }
  };
  
  // Filter documents based on store filter and search term
  const filteredDocuments = pdfDocuments?.filter(doc => {
    const matchesStore = storeFilter ? doc.storeCode === storeFilter : true;
    const matchesSearch = searchTerm.trim() === '' ? true : 
      (doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      doc.documentType?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStore && matchesSearch;
  });

  // Clear filters function
  const clearFilters = () => {
    setSearchTerm("");
    setStoreFilter(null);
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Tiendas PDF</h1>
          
          <div className="flex space-x-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Archivo PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Subir Documento PDF</DialogTitle>
                  <DialogDescription>
                    Suba un documento PDF para la tienda seleccionada.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="store">Seleccionar Tienda</Label>
                    <Select 
                      onValueChange={(value) => setSelectedStore(value)}
                      value={selectedStore || undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar una tienda" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.filter(store => store.type === "PDF").map(store => (
                          <SelectItem key={store.id} value={store.code}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="file">Archivo PDF</Label>
                    <Input 
                      id="file" 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleFileChange}
                    />
                    <p className="text-sm text-gray-500">
                      Sólo se aceptan archivos PDF.
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedStore || !uploadFile || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? "Subiendo..." : "Subir"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Stores Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <StoreIcon className="h-5 w-5 mr-2" />
              Tiendas PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stores?.filter(store => store.type === "PDF").length ? (
              <DataTable
                columns={storeColumns}
                data={stores.filter(store => store.type === "PDF")}
                searchKey="name"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <StoreIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay tiendas disponibles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No se encontraron tiendas PDF en el sistema.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Documents Section */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <CardTitle>
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-red-500" />
                  Documentos PDF
                  {storeFilter && (
                    <Badge className="ml-2 bg-primary" variant="secondary">
                      {stores?.find(s => s.code === storeFilter)?.name || storeFilter}
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar documentos..."
                    className="pl-8 w-full sm:w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {(searchTerm || storeFilter) && (
                  <Button variant="ghost" onClick={clearFilters} className="h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDocuments?.length ? (
              <DataTable
                columns={documentColumns}
                data={filteredDocuments}
                searchKey="title"
                showColumnToggle={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay documentos disponibles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {storeFilter ? 
                    `No se encontraron documentos PDF para la tienda seleccionada.` : 
                    `No se encontraron documentos PDF en el sistema.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <PdfViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          documentId={selectedDocument.id}
          storeCode={selectedDocument.storeCode}
          documentName={selectedDocument.title}
        />
      )}
    </div>
  );
}