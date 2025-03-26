import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  FileSpreadsheet, 
  Eye, 
  UploadCloud, 
  Database
} from "lucide-react";
import FileUploadModal from "@/components/FileUploadModal";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

// Definición del tipo específico para Store
type StoreType = "Excel" | "PDF";

interface Store {
  id: number;
  code: string;
  name: string;
  type: StoreType;
  location: string;
  active: boolean;
}

interface ExcelData {
  id: number;
  storeCode: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerContact: string;
  itemDetails: string;
  metals: string;
  engravings: string;
  stones: string;
  carats: string;
  price: string;
  pawnTicket: string;
  saleDate: string | null;
  fileActivityId: number;
}

export default function ExcelStoresPage() {
  const { toast } = useToast();
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showStoreDataDialog, setShowStoreDataDialog] = useState(false);
  const [storeData, setStoreData] = useState<ExcelData[]>([]);
  
  // Búsqueda por código, nombre o ubicación
  const [codeFilter, setCodeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Fetch excel stores
  const { data: stores = [], isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'Excel' }],
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
  
  // Fetch store data
  const { 
    isLoading: isLoadingStoreData, 
    refetch: fetchStoreData,
  } = useQuery<ExcelData[]>({
    queryKey: ['/api/excel-data', { storeCode: selectedStore?.code }],
    enabled: false, // Don't fetch automatically
  });
  
  // Handle view store data
  const handleViewStoreData = (store: Store) => {
    setSelectedStore(store);
    
    // Perform the fetch
    fetchStoreData()
      .then(({ data }) => {
        if (data) {
          setStoreData(data);
          setShowStoreDataDialog(true);
        }
      })
      .catch((error: Error) => {
        toast({
          title: "Error al cargar datos",
          description: error.message,
          variant: "destructive",
        });
      });
  };
  
  // Estados para las filas expandibles
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>({});
  const [storeActivities, setStoreActivities] = useState<{ [key: string]: any[] }>({});
  const [loadingActivities, setLoadingActivities] = useState<{ [key: string]: boolean }>({});
  
  // Manejar la visualización de archivos de una tienda
  const handleViewStoreFiles = async (store: Store) => {
    // Marcar como cargando
    setLoadingActivities(prev => ({ ...prev, [store.code]: true }));
    
    try {
      // Cargar actividades de la tienda
      const response = await fetch(`/api/file-activities?storeCode=${store.code}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar los archivos');
      }
      
      const data = await response.json();
      setStoreActivities(prev => ({ ...prev, [store.code]: data }));
      
      // Mostrar/ocultar la fila expandida
      setExpandedRows(prev => ({
        ...prev,
        [store.id]: !prev[store.id]
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al cargar los archivos",
        variant: "destructive",
      });
    } finally {
      setLoadingActivities(prev => ({ ...prev, [store.code]: false }));
    }
  };
  
  // Data columns for stores
  const storeColumns: ColumnDef<Store>[] = [
    {
      accessorKey: "code",
      header: "Código",
      enableGlobalFilter: true
    },
    {
      accessorKey: "name",
      header: "Nombre",
      enableGlobalFilter: true
    },
    {
      accessorKey: "location",
      header: "Ubicación",
      enableGlobalFilter: true
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => {
        const active = row.original.active;
        return (
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Activa" : "Inactiva"}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const store = row.original;
        const isExpanded = expandedRows[store.id] || false;
        const isLoading = loadingActivities[store.code] || false;
        
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => handleViewStoreData(store)}
              title="Ver datos"
            >
              <Database className="h-4 w-4" />
              <span className="sr-only">Ver datos</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => handleViewStoreFiles(store)}
              title="Ver archivos"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span className="sr-only">Ver archivos</span>
            </Button>
          </div>
        );
      }
    }
  ];
  
  // Data columns for store data
  const dataColumns: ColumnDef<ExcelData>[] = [
    {
      accessorKey: "orderNumber",
      header: "Orden #",
    },
    {
      accessorKey: "orderDate",
      header: "Fecha",
      cell: ({ row }) => {
        const date = new Date(row.original.orderDate);
        return format(date, "dd/MM/yyyy");
      }
    },
    {
      accessorKey: "customerName",
      header: "Cliente",
    },
    {
      accessorKey: "customerContact",
      header: "Contacto",
    },
    {
      accessorKey: "itemDetails",
      header: "Artículo",
    },
    {
      accessorKey: "price",
      header: "Precio",
    },
    {
      accessorKey: "pawnTicket",
      header: "Boleta",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        return (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0"
            title="Ver detalles" 
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Ver detalles</span>
          </Button>
        );
      }
    }
  ];
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Tiendas Excel</h1>
        </div>
        
        {/* Modal de Carga de Archivos */}
        <FileUploadModal 
          isOpen={showFileUploadModal}
          onClose={() => setShowFileUploadModal(false)}
          storesByType={(stores?.filter(store => store.type === "Excel") || []) as any[]}
          fileType="Excel"
        />
        
        {/* Búsqueda de tiendas */}
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
        
        {/* Listado de tiendas Excel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <FileSpreadsheet className="mr-2 h-5 w-5" />
                Tiendas con datos Excel
              </CardTitle>
              <CardDescription>
                Seleccione una tienda para ver sus registros importados. Actualmente hay {filteredStores.filter(s => s.type === "Excel")?.length || 0} tiendas configuradas.
              </CardDescription>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowFileUploadModal(true)}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Cargar Archivos
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingStores ? (
              <div className="py-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* Tabla de tiendas */}
                <DataTable 
                  columns={storeColumns} 
                  data={filteredStores.filter(store => store.type === "Excel") || []} 
                />
                
                {/* Mostrar actividades de archivos para las tiendas expandidas */}
                {Object.entries(expandedRows).map(([storeId, expanded]) => {
                  if (!expanded) return null;
                  
                  const store = stores?.find(s => s.id === parseInt(storeId));
                  if (!store) return null;
                  
                  const activities = storeActivities[store.code] || [];
                  
                  return (
                    <div key={storeId} className="mt-4 ml-4 mr-4 bg-gray-50 p-4 rounded-md border">
                      <h3 className="text-lg font-medium mb-2">Archivos de {store.name} ({store.code})</h3>
                      
                      {activities.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No hay archivos disponibles para esta tienda</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-2">Nombre del archivo</th>
                                <th className="text-left py-2 px-2">Fecha</th>
                                <th className="text-left py-2 px-2">Estado</th>
                                <th className="text-left py-2 px-2">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activities.map((activity: any) => (
                                <tr key={activity.id} className="border-b hover:bg-gray-100">
                                  <td className="py-2 px-2">{activity.filename}</td>
                                  <td className="py-2 px-2">{new Date(activity.processingDate).toLocaleString()}</td>
                                  <td className="py-2 px-2">
                                    <Badge variant={
                                      activity.status === 'Processed' ? 'default' :
                                      activity.status === 'Processing' ? 'secondary' :
                                      activity.status === 'Pending' ? 'outline' : 'destructive'
                                    }>
                                      {activity.status === 'Processed' ? 'Procesado' :
                                      activity.status === 'Processing' ? 'Procesando' :
                                      activity.status === 'Pending' ? 'Pendiente' : 'Error'}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-2">
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        title="Descargar"
                                        onClick={() => window.open(`/api/file-activities/${activity.id}/download`)}
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
                    Registros importados de archivos Excel
                  </DialogDescription>
                </DialogHeader>
                
                {isLoadingStoreData ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : storeData.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No hay datos disponibles para esta tienda</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[60vh]">
                    <DataTable
                      columns={dataColumns}
                      data={storeData}
                      searchKey="customerName"
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
    </div>
  );
}