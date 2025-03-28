import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
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
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  CalendarClock,
  Filter
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Definición del tipo para Store
type StoreType = "Excel" | "PDF";

interface Store {
  id: number;
  code: string;
  name: string;
  type: StoreType;
  location: string;
  district?: string;
  locality?: string;
  active: boolean;
}

interface FileActivity {
  id: number;
  filename: string;
  storeCode: string;
  fileType: "Excel" | "PDF";
  status: "Pending" | "Processing" | "Processed" | "Failed";
  processingDate: string;
  processedBy: string;
  errorMessage?: string;
}

interface StoreActivity {
  store: Store;
  lastActivity?: FileActivity;
  daysSinceLastActivity: number;
  status: "active" | "warning" | "danger" | "inactive";
}

export default function ActivityControlPage() {
  const { toast } = useToast();
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [localityFilter, setLocalityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeActivities, setStoreActivities] = useState<StoreActivity[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [storeActivityHistory, setStoreActivityHistory] = useState<FileActivity[]>([]);
  const [isLoadingActivityHistory, setIsLoadingActivityHistory] = useState(false);

  // Fetch stores
  const { data: storesData = [], isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
  });

  // Fetch activities
  const { data: activitiesData = [], isLoading: isLoadingActivities } = useQuery<FileActivity[]>({
    queryKey: ['/api/file-activities'],
  });

  // Procesar los datos para obtener la última actividad de cada tienda
  useEffect(() => {
    if (storesData.length > 0 && !isLoadingStores) {
      setStores(storesData);
      
      // Procesar las actividades cuando estén disponibles
      if (activitiesData.length > 0 && !isLoadingActivities) {
        const tempStoreActivities: StoreActivity[] = [];
        
        // Agrupar actividades por código de tienda
        const activitiesByStore: Record<string, FileActivity[]> = {};
        activitiesData.forEach(activity => {
          if (!activitiesByStore[activity.storeCode]) {
            activitiesByStore[activity.storeCode] = [];
          }
          activitiesByStore[activity.storeCode].push(activity);
        });
        
        // Procesar cada tienda para obtener su última actividad
        storesData.forEach(store => {
          const storeCode = store.code;
          const storeActivitiesList = activitiesByStore[storeCode] || [];
          
          // Ordenar actividades por fecha descendente para obtener la última
          storeActivitiesList.sort((a, b) => 
            new Date(b.processingDate).getTime() - new Date(a.processingDate).getTime()
          );
          
          const lastActivity = storeActivitiesList.length > 0 ? storeActivitiesList[0] : undefined;
          const daysSinceLastActivity = lastActivity 
            ? differenceInDays(new Date(), new Date(lastActivity.processingDate))
            : 999; // Si no hay actividad, asignar un valor alto
          
          // Determinar el estado basado en los días desde la última actividad
          let status: "active" | "warning" | "danger" | "inactive";
          
          if (!store.active) {
            status = "inactive";
          } else if (daysSinceLastActivity <= 7) {
            status = "active";
          } else if (daysSinceLastActivity <= 15) {
            status = "warning";
          } else {
            status = "danger";
          }
          
          tempStoreActivities.push({
            store,
            lastActivity,
            daysSinceLastActivity,
            status
          });
        });
        
        setStoreActivities(tempStoreActivities);
      }
    }
  }, [storesData, activitiesData, isLoadingStores, isLoadingActivities]);

  // Filtrar las tiendas según los filtros aplicados
  const filteredStoreActivities = storeActivities.filter(item => {
    const { store } = item;
    
    const matchesCode = store.code.toLowerCase().includes(codeFilter.toLowerCase());
    const matchesName = store.name.toLowerCase().includes(nameFilter.toLowerCase());
    
    // Filtrado por localidad y distrito
    const matchesLocality = localityFilter === "" || (store.locality?.toLowerCase().includes(localityFilter.toLowerCase()) ?? false);
    const matchesDistrict = districtFilter === "" || (store.district?.toLowerCase().includes(districtFilter.toLowerCase()) ?? false);
    
    const matchesType = typeFilter === "all" || store.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    
    return (
      (codeFilter === "" || matchesCode) && 
      (nameFilter === "" || matchesName) && 
      matchesLocality &&
      matchesDistrict &&
      matchesType &&
      matchesStatus
    );
  });

  // Ver el historial de actividad de una tienda
  const handleViewActivityHistory = async (storeActivity: StoreActivity) => {
    setSelectedStore(storeActivity.store);
    setIsLoadingActivityHistory(true);
    
    try {
      const response = await fetch(`/api/file-activities?storeCode=${storeActivity.store.code}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar el historial de actividad');
      }
      
      const data = await response.json();
      setStoreActivityHistory(data);
      setShowActivityDialog(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al cargar el historial de actividad",
        variant: "destructive",
      });
      setStoreActivityHistory([]);
    } finally {
      setIsLoadingActivityHistory(false);
    }
  };

  // Columnas para la tabla de tiendas
  const storeColumns: ColumnDef<StoreActivity>[] = [
    {
      accessorKey: "store.code",
      header: "Código",
      cell: ({ row }) => {
        return <span>{row.original.store.code}</span>;
      }
    },
    {
      accessorKey: "store.name",
      header: "Nombre",
      cell: ({ row }) => {
        return <span>{row.original.store.name}</span>;
      }
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      cell: ({ row }) => {
        const store = row.original.store;
        if (store.district || store.locality) {
          return (
            <div>
              {store.district && <div>{store.district}</div>}
              {store.locality && <div className="text-gray-500 text-xs">{store.locality}</div>}
            </div>
          );
        } else {
          return <span>{store.location || "—"}</span>;
        }
      }
    },
    {
      accessorKey: "store.type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.store.type;
        return (
          <div className="flex items-center">
            {type === "Excel" ? (
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            ) : (
              <FileText className="mr-2 h-4 w-4 text-red-600" />
            )}
            <span>{type}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "lastActivity",
      header: "Última Actividad",
      cell: ({ row }) => {
        const { lastActivity } = row.original;
        return lastActivity ? (
          <span>{new Date(lastActivity.processingDate).toLocaleDateString()}</span>
        ) : (
          <span className="text-muted-foreground">Sin actividad</span>
        );
      }
    },
    {
      accessorKey: "daysSinceLastActivity",
      header: "Días sin actividad",
      cell: ({ row }) => {
        const days = row.original.daysSinceLastActivity;
        if (days === 999) {
          return <span className="text-muted-foreground">N/A</span>;
        }
        return <span>{days} días</span>;
      }
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const { status } = row.original;
        const isActive = row.original.store.active;
        
        if (!isActive) {
          return (
            <Badge variant="outline" className="bg-gray-100 text-gray-600">
              Inactiva
            </Badge>
          );
        }
        
        if (status === "active") {
          return (
            <Badge variant="default" className="bg-green-100 hover:bg-green-200 text-green-800 border-green-400">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Activa
            </Badge>
          );
        } else if (status === "warning") {
          return (
            <Badge variant="default" className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-400">
              <Clock className="mr-1 h-3 w-3" />
              Retrasada
            </Badge>
          );
        } else {
          return (
            <Badge variant="default" className="bg-red-100 hover:bg-red-200 text-red-800 border-red-400">
              <AlertCircle className="mr-1 h-3 w-3" />
              Crítica
            </Badge>
          );
        }
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
            className="h-8 px-2"
            onClick={() => handleViewActivityHistory(row.original)}
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            Ver historial
          </Button>
        );
      }
    }
  ];

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Control de Actividad</h1>
        </div>
        
        {/* Módulos de filtro rápido por estado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Tiendas Activas */}
          <div 
            className={`${statusFilter === "active" ? "ring-2 ring-green-400" : ""} bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 cursor-pointer transition-all`}
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                <h3 className="font-medium">Activas</h3>
              </div>
              <span className="text-lg font-semibold">
                {storeActivities.filter(sa => sa.status === "active" && sa.store.active).length}
              </span>
            </div>
            <p className="text-sm text-green-700 mt-2">Tiendas con actividad en los últimos 7 días</p>
            {statusFilter === "active" && (
              <div className="mt-3 text-xs text-green-600 flex items-center">
                <span>Mostrando solo activas</span>
                <span className="ml-1 underline">Click para ver todas</span>
              </div>
            )}
          </div>
          
          {/* Tiendas Retrasadas */}
          <div 
            className={`${statusFilter === "warning" ? "ring-2 ring-yellow-400" : ""} bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg p-4 cursor-pointer transition-all`}
            onClick={() => setStatusFilter(statusFilter === "warning" ? "all" : "warning")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-yellow-500 mr-2" />
                <h3 className="font-medium">Retrasadas</h3>
              </div>
              <span className="text-lg font-semibold">
                {storeActivities.filter(sa => sa.status === "warning" && sa.store.active).length}
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">Tiendas sin actividad entre 7 y 15 días</p>
            {statusFilter === "warning" && (
              <div className="mt-3 text-xs text-yellow-600 flex items-center">
                <span>Mostrando solo retrasadas</span>
                <span className="ml-1 underline">Click para ver todas</span>
              </div>
            )}
          </div>
          
          {/* Tiendas Críticas */}
          <div 
            className={`${statusFilter === "danger" ? "ring-2 ring-red-400" : ""} bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg p-4 cursor-pointer transition-all`}
            onClick={() => setStatusFilter(statusFilter === "danger" ? "all" : "danger")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                <h3 className="font-medium">Críticas</h3>
              </div>
              <span className="text-lg font-semibold">
                {storeActivities.filter(sa => sa.status === "danger" && sa.store.active).length}
              </span>
            </div>
            <p className="text-sm text-red-700 mt-2">Tiendas sin actividad por más de 15 días</p>
            {statusFilter === "danger" && (
              <div className="mt-3 text-xs text-red-600 flex items-center">
                <span>Mostrando solo críticas</span>
                <span className="ml-1 underline">Click para ver todas</span>
              </div>
            )}
          </div>
          
          {/* Tiendas Inactivas */}
          <div 
            className={`${statusFilter === "inactive" ? "ring-2 ring-gray-400" : ""} bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 cursor-pointer transition-all`}
            onClick={() => setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-gray-500 mr-2" />
                <h3 className="font-medium">Inactivas</h3>
              </div>
              <span className="text-lg font-semibold">
                {storeActivities.filter(sa => !sa.store.active).length}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2">Tiendas marcadas como inactivas en el sistema</p>
            {statusFilter === "inactive" && (
              <div className="mt-3 text-xs text-gray-600 flex items-center">
                <span>Mostrando solo inactivas</span>
                <span className="ml-1 underline">Click para ver todas</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Filtrar tiendas por código, nombre, distrito, localidad o tipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <Label htmlFor="distrito-filter">Distrito</Label>
                <Input
                  id="distrito-filter"
                  placeholder="Filtrar por distrito..."
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localidad-filter">Localidad</Label>
                <Input
                  id="localidad-filter"
                  placeholder="Filtrar por localidad..."
                  value={localityFilter}
                  onChange={(e) => setLocalityFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-filter">Tipo</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value)}
                >
                  <SelectTrigger id="type-filter">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="Excel">Excel</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tabla de actividad de tiendas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarClock className="mr-2 h-5 w-5" />
              Actividad de Tiendas
            </CardTitle>
            <CardDescription>
              Seguimiento de la actividad de envío de reportes de todas las tiendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStores || isLoadingActivities ? (
              <div className="py-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <DataTable 
                    columns={storeColumns} 
                    data={filteredStoreActivities}
                  />
                </div>
                
                {/* Leyenda de colores */}
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium mb-2">Leyenda de estados:</h3>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center">
                      <Badge variant="default" className="mr-2 bg-green-100 text-green-800 border-green-400">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Activa
                      </Badge>
                      <span className="text-sm">Menos de 7 días sin actividad</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="default" className="mr-2 bg-yellow-100 text-yellow-800 border-yellow-400">
                        <Clock className="mr-1 h-3 w-3" />
                        Retrasada
                      </Badge>
                      <span className="text-sm">Entre 7 y 15 días sin actividad</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="default" className="mr-2 bg-red-100 text-red-800 border-red-400">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Crítica
                      </Badge>
                      <span className="text-sm">Más de 15 días sin actividad</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="mr-2 bg-gray-100 text-gray-600">
                        Inactiva
                      </Badge>
                      <span className="text-sm">Tienda marcada como inactiva</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Dialog para ver historial de actividad */}
            <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>
                    Historial de Actividad: {selectedStore?.name} ({selectedStore?.code})
                  </DialogTitle>
                  <DialogDescription>
                    Todas las actividades registradas para esta tienda
                  </DialogDescription>
                </DialogHeader>
                
                {isLoadingActivityHistory ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : storeActivityHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No hay registros de actividad para esta tienda</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-3">Archivo</th>
                          <th className="text-left py-3 px-3">Tipo</th>
                          <th className="text-left py-3 px-3">Fecha</th>
                          <th className="text-left py-3 px-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeActivityHistory.map((activity) => (
                          <tr key={activity.id} className="border-b hover:bg-gray-100">
                            <td className="py-3 px-3">{activity.filename}</td>
                            <td className="py-3 px-3">
                              {activity.fileType === "Excel" ? (
                                <div className="flex items-center">
                                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                                  <span>Excel</span>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <FileText className="mr-2 h-4 w-4 text-red-600" />
                                  <span>PDF</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">{new Date(activity.processingDate).toLocaleString()}</td>
                            <td className="py-3 px-3">
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowActivityDialog(false)}>
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