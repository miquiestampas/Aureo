import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSocketStore } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
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
  Database,
  UploadCloud,
  Trash2
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import PdfViewer from "@/components/PdfViewer";
import FileUploadModal from "@/components/FileUploadModal";
import { Badge } from "@/components/ui/badge";

// Definición del tipo específico para Store
type StoreType = "Excel" | "PDF";

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
  const [showStoreDataDialog, setShowStoreDataDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ id: number, title: string, storeCode: string } | null>(null);
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [storeActivities, setStoreActivities] = useState<Record<string, any[]>>({});
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<PdfDocument[]>([]);
  const [isLoadingStoreData, setIsLoadingStoreData] = useState(false);
  
  // Búsqueda por código, nombre o ubicación
  const [codeFilter, setCodeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Fetch PDF stores
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'PDF' }],
  });
  
  // Filtrado de tiendas
  const filteredStores = stores.filter(store => {
    const matchesCode = store.code.toLowerCase().includes(codeFilter.toLowerCase());
    const matchesName = store.name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesLocation = store.location?.toLowerCase().includes(locationFilter.toLowerCase()) ?? false;
    
    return (
      (codeFilter === '' || matchesCode) && 
      (nameFilter === '' || matchesName) && 
      (locationFilter === '' || matchesLocation)
    );
  });
  
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
        // Refresh data if needed
        if (expandedStore && expandedStore === lastEvent.data.storeCode) {
          handleViewStoreFiles({ code: expandedStore } as Store);
        }
      }
    }
  }, [recentEvents]);
  
  // Columns for the store table
  const storeColumns: ColumnDef<Store>[] = [
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nombre",
    },
    {
      accessorKey: "location",
      header: "Ubicación",
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "destructive"}>
          {row.original.active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const store = row.original;
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="Ver documentos"
              onClick={() => handleViewStoreData(store)}
            >
              <Database className="h-4 w-4" />
              <span className="sr-only">Ver documentos</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="Subir archivo"
              onClick={() => handleUploadFile(store)}
            >
              <UploadCloud className="h-4 w-4" />
              <span className="sr-only">Subir archivo</span>
            </Button>
          </div>
        );
      },
    },
  ];
  
  // Columns for the data table
  const dataColumns: ColumnDef<PdfDocument>[] = [
    {
      accessorKey: "title",
      header: "Título del documento",
    },
    {
      accessorKey: "documentType",
      header: "Tipo",
    },
    {
      accessorKey: "uploadDate",
      header: "Fecha de subida",
      cell: ({ row }) => {
        const date = new Date(row.original.uploadDate);
        return format(date, "dd/MM/yyyy HH:mm");
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
  
  // Handle view PDF store data
  const handleViewStoreData = async (store: Store) => {
    setSelectedStore(store);
    setIsLoadingStoreData(true);
    
    try {
      const response = await fetch(`/api/pdf-documents?storeCode=${store.code}`);
      if (!response.ok) {
        throw new Error("Error al cargar los documentos");
      }
      
      const data = await response.json();
      setStoreData(data);
    } catch (error) {
      console.error("Error fetching store data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los documentos",
        variant: "destructive",
      });
      setStoreData([]);
    } finally {
      setIsLoadingStoreData(false);
      setShowStoreDataDialog(true);
    }
  };
  
  // Handle view store files
  const handleViewStoreFiles = async (store: Store) => {
    // Toggle expanded state if clicking the same store
    if (expandedStore === store.code) {
      setExpandedStore(null);
      return;
    }
    
    setExpandedStore(store.code);
    
    // Solo cargar los archivos si no se han cargado ya
    if (!storeActivities[store.code]) {
      try {
        const response = await fetch(`/api/file-activities?storeCode=${store.code}`);
        if (!response.ok) {
          throw new Error("Error al cargar los archivos");
        }
        
        const data = await response.json();
        setStoreActivities(prev => ({
          ...prev,
          [store.code]: data.filter((activity: any) => activity.fileType === "PDF")
        }));
      } catch (error) {
        console.error("Error fetching store files:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los archivos",
          variant: "destructive",
        });
      }
    }
  };
  
  // Handle upload file
  const handleUploadFile = (store: Store) => {
    setSelectedStore(store);
    setFileUploadModalOpen(true);
  };
  
  // Handle file upload success
  const handleUploadSuccess = () => {
    // Refresh the files list if the store was expanded
    if (expandedStore === selectedStore?.code) {
      handleViewStoreFiles(selectedStore);
    }
    
    // Reset selected store
    setSelectedStore(null);
  };
  
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

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Tiendas PDF</h1>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Buscar Tiendas</CardTitle>
            <CardDescription>Filtrar tiendas por código, nombre o ubicación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code-filter">Código</Label>
                <Input
                  id="code-filter"
                  placeholder="Filtrar por código..."
                  value={codeFilter}
                  onChange={(e) => setCodeFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name-filter">Nombre</Label>
                <Input
                  id="name-filter"
                  placeholder="Filtrar por nombre..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-filter">Ubicación</Label>
                <Input
                  id="location-filter"
                  placeholder="Filtrar por ubicación..."
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tiendas con datos PDF</CardTitle>
              <CardDescription>
                Lista de tiendas que utilizan archivos PDF
              </CardDescription>
            </div>
            <Button 
              onClick={() => {
                setSelectedStore(null);
                setFileUploadModalOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir PDF
            </Button>
          </CardHeader>
          <CardContent>
            {filteredStores.filter(store => store.type === "PDF").length === 0 ? (
              <div className="text-center py-10">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No hay tiendas PDF</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No se encontraron tiendas PDF con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {storeColumns.map((column) => (
                          <th
                            key={column.id || column.accessorKey?.toString()}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {typeof column.header === 'function' ? column.id : column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStores
                        .filter(store => store.type === "PDF")
                        .map((store) => (
                          <tr key={store.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {store.code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {store.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {store.location}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <Badge variant={store.active ? "default" : "destructive"}>
                                {store.active ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  title="Ver documentos"
                                  onClick={() => handleViewStoreData(store)}
                                >
                                  <Database className="h-4 w-4" />
                                  <span className="sr-only">Ver documentos</span>
                                </Button>

                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  title="Subir archivo"
                                  onClick={() => handleUploadFile(store)}
                                >
                                  <UploadCloud className="h-4 w-4" />
                                  <span className="sr-only">Subir archivo</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Expandable files section */}
                {filteredStores.filter(store => store.type === "PDF").map((store) => {
                  if (expandedStore !== store.code) return null;
                  
                  const activities = storeActivities[store.code] || [];
                  
                  return (
                    <div key={`files-${store.code}`} className="mt-4 rounded-md border p-4">
                      <h3 className="text-lg font-medium mb-2">Archivos de {store.name}</h3>
                      
                      {activities.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-muted-foreground">No hay archivos disponibles para esta tienda</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {activities.map((activity: any) => (
                                <tr key={activity.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {activity.filename}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <Badge 
                                      variant={
                                        activity.status === "Processed" ? "default" : 
                                        activity.status === "Failed" ? "destructive" : 
                                        "secondary"
                                      }
                                    >
                                      {activity.status === "Processed" ? "Procesado" : 
                                       activity.status === "Processing" ? "Procesando" :
                                       activity.status === "Failed" ? "Error" : activity.status}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(activity.processingDate).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        title="Descargar"
                                        onClick={() => {
                                          fetch(`/api/file-activities/${activity.id}/download`)
                                            .then(response => {
                                              if (!response.ok) {
                                                throw new Error('Error al descargar el archivo');
                                              }
                                              return response.blob();
                                            })
                                            .then(blob => {
                                              const url = window.URL.createObjectURL(blob);
                                              const a = document.createElement('a');
                                              a.style.display = 'none';
                                              a.href = url;
                                              a.download = activity.filename;
                                              document.body.appendChild(a);
                                              a.click();
                                              window.URL.revokeObjectURL(url);
                                              document.body.removeChild(a);
                                            })
                                            .catch(error => {
                                              toast({
                                                title: "Error",
                                                description: error instanceof Error ? error.message : "Error al descargar el archivo",
                                                variant: "destructive",
                                              });
                                            });
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                          <polyline points="7 10 12 15 17 10"></polyline>
                                          <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        <span className="sr-only">Descargar</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        title="Eliminar"
                                        onClick={() => {
                                          if (confirm(`¿Está seguro que desea eliminar el archivo ${activity.filename}?`)) {
                                            fetch(`/api/file-activities/${activity.id}`, {
                                              method: 'DELETE'
                                            })
                                            .then(response => {
                                              if (!response.ok) {
                                                throw new Error('Error al eliminar el archivo');
                                              }
                                              
                                              // Actualizar la lista eliminando la actividad
                                              setStoreActivities(prev => ({
                                                ...prev,
                                                [store.code]: prev[store.code].filter((item: any) => item.id !== activity.id)
                                              }));
                                              
                                              toast({
                                                title: "Archivo eliminado",
                                                description: "El archivo se ha eliminado correctamente",
                                              });
                                            })
                                            .catch(error => {
                                              toast({
                                                title: "Error",
                                                description: error instanceof Error ? error.message : "Error al eliminar el archivo",
                                                variant: "destructive",
                                              });
                                            });
                                          }
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                          <path d="M3 6h18"></path>
                                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        </svg>
                                        <span className="sr-only">Eliminar</span>
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                    </div>
                  );
                })}
              </>
            )}
            
            {/* Dialog for Store Data */}
            <Dialog open={showStoreDataDialog} onOpenChange={setShowStoreDataDialog}>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>
                    Datos de la tienda: {selectedStore?.name} ({selectedStore?.code})
                  </DialogTitle>
                  <DialogDescription>
                    Documentos PDF importados
                  </DialogDescription>
                </DialogHeader>
                
                {isLoadingStoreData ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : storeData.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No hay documentos disponibles para esta tienda</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[60vh]">
                    <DataTable
                      columns={dataColumns}
                      data={storeData}
                      searchKey="title"
                    />
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowStoreDataDialog(false)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
      
      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={fileUploadModalOpen}
        onClose={() => setFileUploadModalOpen(false)}
        storesByType={stores.filter(store => store.type === "PDF") as any}
        fileType="PDF"
      />
    </div>
  );
}
