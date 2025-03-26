import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useSocketStore } from "@/lib/socket";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  AlertCircle
} from "lucide-react";
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
  systemLoad: number;
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

  // Manejador para descargar archivo
  const handleDownload = (id: number) => {
    // Redireccionar a la URL de descarga
    window.open(`/api/file-activities/${id}/download`, '_blank');
  };

  // Manejador para eliminar archivo
  const handleDelete = (id: number) => {
    deleteActivityMutation.mutate(id);
  };
  
  // Columns for activities table
  const columns: ColumnDef<FileActivity>[] = [
    {
      accessorKey: "storeCode",
      header: "Tienda",
      cell: ({ row }) => {
        const storeCode = row.original.storeCode;
        return (
          <div>
            <div className="text-sm font-medium text-gray-900">{storeCode}</div>
          </div>
        );
      }
    },
    {
      accessorKey: "fileType",
      header: "Tipo de Archivo",
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
      }
    },
    {
      accessorKey: "processingDate",
      header: "Fecha",
      cell: ({ row }) => {
        const date = new Date(row.original.processingDate);
        return (
          <div className="text-sm text-gray-900">
            {format(date, "MMM d, h:mm a")}
          </div>
        );
      }
    },
    {
      accessorKey: "status",
      header: "Estado",
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
      }
    },
    {
      accessorKey: "processedBy",
      header: "Procesado Por",
      cell: ({ row }) => {
        return <div className="text-sm text-gray-500">{row.original.processedBy}</div>;
      }
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
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
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
                <a className="text-sm font-medium text-primary hover:text-primary/90">
                  Ver todas las tiendas
                </a>
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
                <a className="text-sm font-medium text-primary hover:text-primary/90">
                  Ver archivos recientes
                </a>
              </Link>
            </CardFooter>
          </Card>
          
          {/* Excel Stores Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-600 rounded-md p-3">
                  <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Tiendas Excel</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemStatus?.excelStores ?? '...'}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <Link href="/excel-stores">
                <a className="text-sm font-medium text-primary hover:text-primary/90">
                  Ver tiendas Excel
                </a>
              </Link>
            </CardFooter>
          </Card>
          
          {/* PDF Stores Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Tiendas PDF</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemStatus?.pdfStores ?? '...'}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <Link href="/pdf-stores">
                <a className="text-sm font-medium text-primary hover:text-primary/90">
                  Ver tiendas PDF
                </a>
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
                
                {/* System Load */}
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Carga del Sistema</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-500 h-2.5 rounded-full" 
                        style={{ width: `${systemStatus?.systemLoad ?? 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">
                      {systemStatus?.systemLoad ?? 0}% - Normal
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
        
        {/* Recent Activity Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Actividad Reciente</h2>
            <div className="flex">
              <Button className="ml-3 inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90">
                <Download className="mr-2 h-5 w-5" />
                Exportar Informe
              </Button>
            </div>
          </div>
          
          <div className="mt-5 bg-white shadow overflow-hidden rounded-lg">
            {activities ? (
              <DataTable 
                columns={columns} 
                data={activities} 
                searchKey="filename"
                pageSizeOptions={[5, 10, 25, 50]}
                showColumnToggle={true}
              />
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Cargando actividades recientes...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
