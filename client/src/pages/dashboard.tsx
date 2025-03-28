import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useSocketStore } from "@/lib/socket";
import { Column } from "@tanstack/react-table";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, 
} from "@/components/ui/card";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  FileSpreadsheet,
  FileText,
  FileCheck,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  AlertCircle,
  Plus,
  Upload,
  Calendar as CalendarIcon,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye
} from "lucide-react";
import FileUploadModal from "@/components/FileUploadModal";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

interface SystemStatus {
  totalStores: number;
  excelStores: number;
  pdfStores: number;
  processedToday: number;
  pendingFiles: number;
  fileWatchingActive: boolean;
  lastSystemCheck: string;
  databaseSize: number; // Tamaño relativo de la BD en porcentaje (0-100)
}

interface FileActivity {
  id: number;
  filename: string;
  storeCode: string;
  fileType: "Excel" | "PDF";
  status: "Pending" | "Processing" | "Processed" | "Failed" | "PendingStoreAssignment";
  processingDate: string;
  processedBy: string;
  errorMessage?: string;
  detectedStoreCode?: string;
}

// Interfaces adicionales
interface Store {
  id: number;
  code: string;
  name: string;
  type: "Excel" | "PDF";
  location: string | null;
  active: boolean;
}

// Componente para manejar la asignación de tiendas
function StoreAssignmentCard({ file, onAssigned }: { file: FileActivity, onAssigned: () => void }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Cargar tiendas por tipo
  useEffect(() => {
    const loadStores = async () => {
      try {
        const response = await fetch(`/api/stores?type=${file.fileType}`);
        if (response.ok) {
          const data = await response.json();
          setStores(data.filter((store: Store) => store.active));
        }
      } catch (error) {
        console.error("Error al cargar tiendas:", error);
      }
    };
    
    if (isDialogOpen) {
      loadStores();
    }
  }, [isDialogOpen, file.fileType]);

  // Asignar tienda al archivo
  const assignStore = useMutation({
    mutationFn: async () => {
      if (!selectedStore) {
        throw new Error("Debe seleccionar una tienda");
      }
      
      const response = await apiRequest("POST", `/api/file-activities/${file.id}/assign-store`, {
        storeCode: selectedStore
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al asignar tienda");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tienda asignada",
        description: "El archivo ha sido asignado correctamente a la tienda",
        variant: "default",
      });
      setIsDialogOpen(false);
      setSelectedStore("");
      onAssigned();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al asignar tienda",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAssign = () => {
    assignStore.mutate();
  };

  return (
    <div className="bg-gray-50 rounded-lg shadow p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            {file.fileType === "Excel" ? (
              <FileSpreadsheet className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <FileText className="h-5 w-5 text-red-500 mr-2" />
            )}
            <span className="text-sm font-medium text-gray-900">{file.filename}</span>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            <p>Procesado: {new Date(file.processingDate).toLocaleString()}</p>
            {file.detectedStoreCode && (
              <p className="mt-1">
                <span className="font-medium">Código detectado:</span> {file.detectedStoreCode} (no reconocido)
              </p>
            )}
          </div>
        </div>
        
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Asignar Tienda
          </Button>
        </div>
      </div>
      
      {/* Dialog para asignar tienda */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Tienda al Archivo</DialogTitle>
            <DialogDescription>
              Seleccione la tienda a la que desea asignar el archivo <span className="font-medium">{file.filename}</span>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="store-select">Tienda</Label>
              <Select
                value={selectedStore}
                onValueChange={setSelectedStore}
              >
                <SelectTrigger id="store-select">
                  <SelectValue placeholder="Seleccionar tienda" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.code}>
                      {store.code} - {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {file.detectedStoreCode && (
              <div className="bg-orange-50 p-3 rounded-md text-sm">
                <p className="font-medium text-orange-800">Información</p>
                <p className="text-orange-700 mt-1">
                  Se detectó el código <span className="font-medium">{file.detectedStoreCode}</span> en el nombre del archivo, 
                  pero no coincide con ninguna tienda registrada en el sistema.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedStore || assignStore.isPending}
            >
              {assignStore.isPending ? "Asignando..." : "Confirmar Asignación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DashboardPage() {
  // Socket state for real-time updates
  const { watcherActive, recentEvents } = useSocketStore();
  
  // Fetch system status
  const { data: systemStatus, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/system/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Fetch recent file activities
  const { data: activities, refetch: refetchActivities } = useQuery<FileActivity[]>({
    queryKey: ['/api/file-activities', { limit: 25 }],
    refetchInterval: 15000, // Refetch every 15 seconds
  });
  
  // Fetch files pending store assignment
  const { data: pendingAssignments, refetch: refetchPendingAssignments } = useQuery<FileActivity[]>({
    queryKey: ['/api/pending-store-assignments'],
    refetchInterval: 15000, // Refetch every 15 seconds
  });
  
  // Fetch all stores for modals
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
  });
  
  // Refetch data when receiving socket events
  useEffect(() => {
    if (recentEvents.length > 0) {
      const lastEvent = recentEvents[0];
      
      if (lastEvent.type === 'fileDetected' || lastEvent.type === 'fileProcessingStatus') {
        refetchActivities();
        refetchStatus();
        refetchPendingAssignments();
      }
    }
  }, [recentEvents, refetchActivities, refetchStatus, refetchPendingAssignments]);
  
  // Toast para mensajes al usuario
  const { toast } = useToast();
  
  // Estados para los modales y diálogos
  // Estado para filtros
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  interface DateRange {
    from: Date | undefined;
    to: Date | undefined;
  }
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });
  
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isPdfUploadModalOpen, setIsPdfUploadModalOpen] = useState(false);
  const [isExcelUploadModalOpen, setIsExcelUploadModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<FileActivity[]>([]);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  
  // Consulta para obtener el número de coincidencias no leídas
  const { data: unreadMatchesData } = useQuery({
    queryKey: ['/api/coincidencias/noleidas/count'],
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });
  
  const unreadMatches = unreadMatchesData?.count ?? 0;
  
  // Mutación para eliminar actividad de archivo
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/file-activities/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar el archivo");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Archivo eliminado",
        description: "El archivo ha sido eliminado correctamente",
        variant: "default",
      });
      // Actualizar datos
      refetchActivities();
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Función para eliminar múltiples actividades
  const deleteMultipleActivities = async () => {
    setIsDeleteLoading(true);
    try {
      // Verificar contraseña de administrador
      const verifyResponse = await apiRequest("POST", "/api/verify-admin-password", { password: adminPassword });
      
      if (!verifyResponse.ok) {
        throw new Error("Contraseña incorrecta");
      }
      
      // Eliminar cada actividad seleccionada
      const deletePromises = selectedActivities.map(activity => 
        apiRequest("DELETE", `/api/file-activities/${activity.id}`)
      );
      
      await Promise.all(deletePromises);
      
      toast({
        title: "Archivos eliminados",
        description: `Se han eliminado ${selectedActivities.length} archivos correctamente`,
        variant: "default",
      });
      
      // Limpiar selección y cerrar diálogo
      setSelectedActivities([]);
      setAdminPassword("");
      setIsPasswordDialogOpen(false);
      
      // Actualizar datos
      refetchActivities();
      refetchStatus();
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "Ha ocurrido un error al eliminar los archivos",
        variant: "destructive",
      });
    } finally {
      setIsDeleteLoading(false);
    }
  };
  
  // Función para manejar selección de actividades
  const handleSelectActivities = (activities: FileActivity[]) => {
    setSelectedActivities(activities);
    setIsPasswordDialogOpen(true);
  };

  // Estado para el modal de previsualización
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);
  const [previewFileType, setPreviewFileType] = useState<"Excel" | "PDF" | null>(null);

  // Manejador para descargar archivo
  const handleDownload = (id: number) => {
    // Redireccionar a la URL de descarga
    window.open(`/api/file-activities/${id}/download`, '_blank');
  };

  // Manejador para previsualizar archivo
  const handlePreview = (id: number, fileType: "Excel" | "PDF") => {
    setPreviewFileId(id);
    setPreviewFileType(fileType);
    setPreviewDialogOpen(true);
  };

  // Manejador para eliminar archivo
  const handleDelete = (id: number) => {
    deleteActivityMutation.mutate(id);
  };
  
  // Columns for activities table
  const columns: ColumnDef<FileActivity>[] = [
    {
      accessorKey: "filename",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Archivo
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        const filename = row.original.filename;
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{filename}</div>
          </div>
        );
      },
      enableSorting: true
    },
    {
      accessorKey: "storeCode",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Tienda
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        const storeCode = row.original.storeCode;
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{storeCode}</div>
          </div>
        );
      },
      enableSorting: true
    },
    {
      accessorKey: "fileType",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Tipo de Archivo
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        const fileType = row.original.fileType;
        return (
          <div className="flex items-center">
            {fileType === "Excel" ? (
              <FileSpreadsheet className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <FileText className="h-5 w-5 text-red-500 mr-2" />
            )}
            <span className="text-sm text-gray-900">{fileType}</span>
          </div>
        );
      },
      enableSorting: true
    },
    {
      accessorKey: "processingDate",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Fecha
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.original.processingDate);
        return (
          <div className="text-sm text-gray-900">
            {format(date, "MMM d, h:mm a")}
          </div>
        );
      },
      enableSorting: true,
      sortingFn: (rowA, rowB, columnId) => {
        const dateA = new Date(rowA.getValue(columnId) as string).getTime();
        const dateB = new Date(rowB.getValue(columnId) as string).getTime();
        return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
      }
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Estado
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        const status = row.original.status;
        
        switch(status) {
          case "Processed":
            return (
              <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle className="h-3 w-3 mr-1" /> Procesado
              </Badge>
            );
          case "Processing":
            return (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                <Clock className="h-3 w-3 mr-1" /> Procesando
              </Badge>
            );
          case "Failed":
            return (
              <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                <XCircle className="h-3 w-3 mr-1" /> Fallido
              </Badge>
            );
          case "PendingStoreAssignment":
            return (
              <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                <AlertCircle className="h-3 w-3 mr-1" /> Asignación pendiente
              </Badge>
            );
          default:
            return (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                <Clock className="h-3 w-3 mr-1" /> Pendiente
              </Badge>
            );
        }
      },
      enableSorting: true
    },
    {
      accessorKey: "processedBy",
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Procesado Por
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </div>
        )
      },
      cell: ({ row }) => {
        return <div className="text-sm text-gray-500">{row.original.processedBy}</div>;
      },
      enableSorting: true
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        return (
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => handleDownload(row.original.id)}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => handlePreview(row.original.id, row.original.fileType)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={deleteActivityMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente el archivo <span className="font-medium">{row.original.filename}</span> y todos los datos relacionados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => handleDelete(row.original.id)}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      }
    }
  ];
  
  // Modal para previsualización de archivos
  const PreviewDialog = () => {
    if (!previewFileId) return null;
    
    const previewUrl = `/api/file-activities/${previewFileId}/preview`;
    
    return (
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Previsualización de archivo</DialogTitle>
            <DialogDescription>
              {previewFileType === "PDF" 
                ? "Visualización del documento PDF" 
                : "Visualización de la hoja de cálculo"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            {previewFileType === "PDF" ? (
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center p-6">
                  <FileSpreadsheet className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Archivo Excel</h3>
                  <p className="text-gray-500 mb-4">
                    La previsualización de archivos Excel no está disponible directamente en el navegador.
                  </p>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.open(previewUrl, '_blank')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Modal de previsualización */}
        <PreviewDialog />
        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Stores Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-primary rounded-md p-3">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total de Tiendas</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemStatus?.totalStores ?? '...'}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <Link href="/store-management">
                <div className="text-sm font-medium text-primary hover:text-primary/90 cursor-pointer">
                  Ver todas las tiendas
                </div>
              </Link>
            </CardFooter>
          </Card>
          
          {/* Processed Today Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <FileCheck className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Procesados Hoy</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemStatus?.processedToday ?? '...'}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <Link href="/excel-stores">
                <div className="text-sm font-medium text-primary hover:text-primary/90 cursor-pointer">
                  Ver archivos recientes
                </div>
              </Link>
            </CardFooter>
          </Card>
          
          {/* Coincidencias no leídas Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-amber-500 rounded-md p-3">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Señalamientos sin revisar</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {unreadMatches ?? '...'}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <Link href="/coincidencias">
                <div className="text-sm font-medium text-primary hover:text-primary/90 cursor-pointer">
                  Ver coincidencias
                </div>
              </Link>
            </CardFooter>
          </Card>
        </div>
        
        {/* System Status Section */}
        <div className="mt-8">
          <h2 className="text-lg leading-6 font-medium text-gray-900">Estado del Sistema</h2>
          <div className="mt-5 bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* File Monitoring Status */}
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Monitoreo de Archivos</dt>
                  <dd className="mt-1 flex items-center">
                    {systemStatus?.fileWatchingActive || watcherActive ? (
                      <>
                        <span className="flex-shrink-0 h-4 w-4 rounded-full bg-green-500"></span>
                        <span className="ml-2 text-sm text-gray-900">Activo</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-shrink-0 h-4 w-4 rounded-full bg-red-500"></span>
                        <span className="ml-2 text-sm text-gray-900">Inactivo</span>
                      </>
                    )}
                  </dd>
                </div>
                
                {/* Processing Queue */}
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Cola de Procesamiento</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {systemStatus?.pendingFiles ?? 0} archivos en espera
                  </dd>
                </div>
                
                {/* Last System Check */}
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Última Verificación</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {systemStatus?.lastSystemCheck ? 
                      format(new Date(systemStatus.lastSystemCheck), "MMM d, h:mm a") : 
                      "No disponible"}
                  </dd>
                </div>
                
                {/* Database Size */}
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Tamaño de la Base de Datos</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-500 h-2.5 rounded-full" 
                        style={{ width: `${systemStatus?.databaseSize ?? 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">
                      {systemStatus?.databaseSize ?? 0}% de 1TB
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
        
        {/* Pending Store Assignments Section */}
        {pendingAssignments && pendingAssignments.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg leading-6 font-medium text-gray-900">Archivos Pendientes de Asignación</h2>
              <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                {pendingAssignments.length} {pendingAssignments.length === 1 ? 'archivo' : 'archivos'}
              </Badge>
            </div>
            <div className="mt-5 bg-white shadow overflow-hidden rounded-lg">
              <div className="p-6">
                <div className="space-y-4">
                  {pendingAssignments.map((file) => (
                    <StoreAssignmentCard 
                      key={file.id} 
                      file={file} 
                      onAssigned={() => {
                        refetchPendingAssignments();
                        refetchActivities();
                        refetchStatus();
                        toast({
                          title: "Archivo procesado",
                          description: "El archivo ha sido asignado y procesado correctamente",
                          variant: "default",
                        });
                      }} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Recent Activity Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Actividad Reciente</h2>
            <div className="flex space-x-2">
              <Button 
                className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setIsPdfUploadModalOpen(true)}
              >
                <FileText className="mr-2 h-5 w-5" />
                Cargar PDF
              </Button>
              <Button 
                className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setIsExcelUploadModalOpen(true)}
              >
                <FileSpreadsheet className="mr-2 h-5 w-5" />
                Cargar Excel
              </Button>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="mt-5 bg-white shadow-sm rounded-lg border p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Filtro por tipo de archivo */}
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="file-type-filter" className="mb-1 block">Tipo de Archivo</Label>
                <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                  <SelectTrigger id="file-type-filter" className="w-full">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="Excel">Excel</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro por estado */}
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="status-filter" className="mb-1 block">Estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="Processed">Procesado</SelectItem>
                    <SelectItem value="Processing">Procesando</SelectItem>
                    <SelectItem value="Failed">Fallido</SelectItem>
                    <SelectItem value="Pending">Pendiente</SelectItem>
                    <SelectItem value="PendingStoreAssignment">Asignación pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro por fecha */}
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="date-filter" className="mb-1 block">Rango de Fechas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-filter"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>Del {format(dateRange.from, "dd/MM/yyyy")} al {format(dateRange.to, "dd/MM/yyyy")}</>
                        ) : (
                          <>Desde {format(dateRange.from, "dd/MM/yyyy")}</>
                        )
                      ) : (
                        "Seleccionar rango de fechas"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={new Date()}
                      selected={dateRange.from && dateRange.to ? {
                        from: dateRange.from,
                        to: dateRange.to
                      } : undefined}
                      onSelect={(range) => 
                        setDateRange({
                          from: range?.from,
                          to: range?.to
                        })
                      }
                      numberOfMonths={2}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Botón para limpiar filtros */}
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  className="h-10"
                  onClick={() => {
                    setFileTypeFilter("all");
                    setStatusFilter("all");
                    setDateRange({ from: undefined, to: undefined });
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow overflow-hidden rounded-lg">
            {activities ? (
              <DataTable 
                columns={columns} 
                data={activities.filter(activity => {
                  // Filtro por tipo de archivo
                  if (fileTypeFilter !== "all" && activity.fileType !== fileTypeFilter) {
                    return false;
                  }
                  
                  // Filtro por estado
                  if (statusFilter !== "all" && activity.status !== statusFilter) {
                    return false;
                  }
                  
                  // Filtro por fecha
                  if (dateRange.from && dateRange.to) {
                    const activityDate = new Date(activity.processingDate);
                    const fromDate = new Date(dateRange.from);
                    const toDate = new Date(dateRange.to);
                    toDate.setHours(23, 59, 59, 999); // Ajustar hasta el final del día
                    
                    if (activityDate < fromDate || activityDate > toDate) {
                      return false;
                    }
                  } else if (dateRange.from) {
                    const activityDate = new Date(activity.processingDate);
                    const fromDate = new Date(dateRange.from);
                    
                    if (activityDate < fromDate) {
                      return false;
                    }
                  }
                  
                  return true;
                })} 
                searchKey="filename"
                pageSizeOptions={[5, 10, 25, 50]}
                showColumnToggle={true}
                enableRowSelection={true}
                onDeleteSelected={handleSelectActivities}
              />
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Cargando actividades recientes...</p>
              </div>
            )}
          </div>
          
          {/* Diálogo de Confirmación con Contraseña */}
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmación de Administrador</DialogTitle>
                <DialogDescription>
                  Se requiere contraseña de administrador para eliminar {selectedActivities.length} archivo(s).
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="admin-password" className="text-right">
                    Contraseña
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="col-span-3"
                    placeholder="Introduce la contraseña de administrador"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsPasswordDialogOpen(false);
                    setAdminPassword("");
                    setSelectedActivities([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={deleteMultipleActivities}
                  disabled={!adminPassword || isDeleteLoading}
                >
                  {isDeleteLoading ? "Eliminando..." : "Confirmar Eliminación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Modales de carga de archivos */}
      <FileUploadModal 
        isOpen={isPdfUploadModalOpen} 
        onClose={() => setIsPdfUploadModalOpen(false)} 
        storesByType={stores.filter(store => store.type === "PDF" && store.active)} 
        fileType="PDF" 
      />
      <FileUploadModal 
        isOpen={isExcelUploadModalOpen} 
        onClose={() => setIsExcelUploadModalOpen(false)} 
        storesByType={stores.filter(store => store.type === "Excel" && store.active)} 
        fileType="Excel" 
      />
      
      {/* Modal de previsualización de archivos */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Previsualización de archivo</DialogTitle>
            <DialogDescription>
              {previewFileType === "PDF" ? "Visualización del documento PDF" : "Visualización del archivo Excel"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="min-h-[60vh] w-full bg-gray-100 rounded-md">
            {previewFileId && (
              previewFileType === "PDF" ? (
                <iframe 
                  src={`/api/file-activities/${previewFileId}/preview`}
                  className="w-full h-[60vh] rounded-md border-none"
                  title="Previsualización de PDF"
                  sandbox="allow-same-origin allow-scripts"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <FileSpreadsheet className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-6">Los archivos Excel no se pueden previsualizar directamente.</p>
                  <Button
                    onClick={() => handleDownload(previewFileId)}
                    variant="default"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar archivo Excel
                  </Button>
                </div>
              )
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
