import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { Row } from "@tanstack/react-table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  AlertTriangle, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import MainLayout from "@/layouts/main-layout";

// Interfaz para coincidencias
interface Coincidencia {
  id: number;
  excelDataId: number;
  senalTipo: "persona" | "objeto";
  senalId: number;
  porcentajeCoincidencia: number;
  coincidenciaExacta: boolean;
  campo: string;
  valor: string;
  senalValor: string;
  leido: boolean;
  createdAt: string;
  
  // Campos adicionales para mostrar información relacionada
  nombreTienda?: string;
  codigoTienda?: string;
  compradorNombre?: string;
  fechaCompra?: string;
  senalNombre?: string; // Para personas
  senalDescripcion?: string; // Para objetos
  senalDNI?: string; // Para personas
  senalGrabaciones?: string; // Para objetos
  senalMotivo?: string;
}

interface ExcelDataDetail {
  id: number;
  storeId: number;
  storeName: string;
  storeCode: string;
  fecha: string;
  comprador: string;
  dni: string;
  telefono: string;
  direccion: string;
  grabaciones: string;
  articulo: string;
  precio: string;
  processingDate: string;
}

export default function Coincidencias() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("noLeidas");
  const [selectedCoincidencia, setSelectedCoincidencia] = useState<Coincidencia | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [excelDataDetails, setExcelDataDetails] = useState<ExcelDataDetail | null>(null);

  // Get current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/user");
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  // Queries para obtener coincidencias
  const {
    data: coincidenciasNoLeidas,
    isLoading: loadingNoLeidas,
    isError: errorNoLeidas,
    refetch: refetchNoLeidas,
  } = useQuery<Coincidencia[]>({
    queryKey: ["/api/coincidencias/no-leidas"],
    refetchOnWindowFocus: true,
  });

  const {
    data: coincidenciasLeidas,
    isLoading: loadingLeidas,
    isError: errorLeidas,
    refetch: refetchLeidas,
  } = useQuery<Coincidencia[]>({
    queryKey: ["/api/coincidencias/leidas"],
    refetchOnWindowFocus: false,
    enabled: activeTab === "leidas", // Solo cargar cuando la pestaña esté activa
  });

  // Mutation para marcar como leída
  const marcarLeidaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/coincidencias/${id}/marcar-leida`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias/no-leidas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias/leidas"] });
      toast({
        title: "Coincidencia actualizada",
        description: "La coincidencia ha sido marcada como leída.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al marcar como leída: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Función para ver detalles de la compra
  const verDetallesCompra = async (coincidencia: Coincidencia) => {
    setSelectedCoincidencia(coincidencia);
    
    try {
      const res = await fetch(`/api/excel-data/${coincidencia.excelDataId}`);
      if (res.ok) {
        const datos = await res.json();
        setExcelDataDetails(datos);
        setDetailsDialogOpen(true);
        
        // Si la coincidencia no está leída, marcarla como leída
        if (!coincidencia.leido) {
          marcarLeidaMutation.mutate(coincidencia.id);
        }
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar los detalles de la compra.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al cargar detalles:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al intentar cargar los detalles.",
        variant: "destructive",
      });
    }
  };

  // Función para actualizar manualmente las coincidencias
  const actualizarCoincidencias = () => {
    if (activeTab === "noLeidas") {
      refetchNoLeidas();
    } else {
      refetchLeidas();
    }
    
    toast({
      title: "Actualizando",
      description: "Actualizando lista de coincidencias...",
    });
  };

  // Función para ir a la página de detalle de compra
  const irADetalleCompra = (excelDataId: number) => {
    setLocation(`/purchase-control/${excelDataId}`);
  };

  // Función para mostrar el tipo de coincidencia con un color
  const getTipoCoincidenciaBadge = (coincidencia: Coincidencia) => {
    if (coincidencia.senalTipo === "persona") {
      return <Badge variant="outline" className="bg-indigo-100 text-indigo-800">Persona</Badge>;
    } else {
      return <Badge variant="outline" className="bg-amber-100 text-amber-800">Objeto</Badge>;
    }
  };

  // Función para mostrar el nivel de coincidencia con color
  const getNivelCoincidenciaBadge = (coincidencia: Coincidencia) => {
    if (coincidencia.coincidenciaExacta) {
      return <Badge className="bg-red-500">Exacta</Badge>;
    } else {
      return <Badge className="bg-amber-500">Parcial</Badge>;
    }
  };

  // Columnas para la tabla de coincidencias
  const coincidenciasColumns = [
    {
      accessorKey: "senalTipo",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Tipo" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => getTipoCoincidenciaBadge(row.original),
    },
    {
      accessorKey: "nombreTienda",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Tienda" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.nombreTienda}</span>
          <span className="text-xs text-muted-foreground">{row.original.codigoTienda}</span>
        </div>
      ),
    },
    {
      accessorKey: "fechaCompra",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const date = row.original.fechaCompra ? new Date(row.original.fechaCompra) : null;
        return date ? <span>{date.toLocaleDateString('es-ES')}</span> : <span>-</span>;
      },
    },
    {
      accessorKey: "campo",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Campo" />,
    },
    {
      accessorKey: "valor",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Valor encontrado" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => (
        <div className="max-w-[200px] truncate font-medium" title={row.getValue("valor")}>
          {row.getValue("valor")}
        </div>
      ),
    },
    {
      accessorKey: "senalValor",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Señalamiento" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const coincidencia = row.original;
        let mainValue = "";
        let secondaryValue = "";
        
        if (coincidencia.senalTipo === "persona") {
          mainValue = coincidencia.senalNombre || "";
          secondaryValue = coincidencia.senalDNI || "";
        } else {
          mainValue = coincidencia.senalDescripcion || "";
          secondaryValue = coincidencia.senalGrabaciones || "";
        }
        
        return (
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[200px]" title={mainValue}>{mainValue}</span>
            {secondaryValue && (
              <span className="text-xs text-muted-foreground">{secondaryValue}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "porcentajeCoincidencia",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Nivel" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => (
        <div className="flex items-center gap-2">
          {getNivelCoincidenciaBadge(row.original)}
          <span className="text-sm">
            {Math.round(row.original.porcentajeCoincidencia * 100)}%
          </span>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Detectado" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const date = new Date(row.getValue("createdAt"));
        return <span>{date.toLocaleDateString('es-ES')}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const coincidencia = row.original;
        
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => verDetallesCompra(coincidencia)}
              title="Ver detalles"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!coincidencia.leido && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => marcarLeidaMutation.mutate(coincidencia.id)}
                title="Marcar como leída"
                disabled={marcarLeidaMutation.isPending}
              >
                {marcarLeidaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Obtener datos según la pestaña activa
  const getCoincidenciasActivas = () => {
    if (activeTab === "noLeidas") {
      return {
        data: coincidenciasNoLeidas || [],
        isLoading: loadingNoLeidas,
        isError: errorNoLeidas,
      };
    } else {
      return {
        data: coincidenciasLeidas || [],
        isLoading: loadingLeidas,
        isError: errorLeidas,
      };
    }
  };

  const { data, isLoading, isError } = getCoincidenciasActivas();

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">Coincidencias</h1>
            {coincidenciasNoLeidas && coincidenciasNoLeidas.length > 0 && (
              <Badge className="bg-red-500">
                {coincidenciasNoLeidas.length} no leídas
              </Badge>
            )}
          </div>
          <Button 
            onClick={actualizarCoincidencias}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>

        <p className="text-muted-foreground">
          Revise las coincidencias detectadas entre compras y señalamientos registrados en el sistema.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="noLeidas" className="relative">
              No leídas
              {coincidenciasNoLeidas && coincidenciasNoLeidas.length > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {coincidenciasNoLeidas.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="leidas">Leídas</TabsTrigger>
          </TabsList>
          <TabsContent value="noLeidas">
            <Card>
              <CardHeader>
                <CardTitle>Coincidencias Pendientes</CardTitle>
                <CardDescription>
                  Lista de coincidencias que aún no han sido revisadas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isError ? (
                  <div className="flex justify-center items-center h-64 text-destructive">
                    <AlertTriangle className="h-8 w-8 mr-2" />
                    Error al cargar datos. Intente nuevamente más tarde.
                  </div>
                ) : data.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">No hay coincidencias pendientes</p>
                    <p className="text-sm">Todas las coincidencias han sido revisadas.</p>
                  </div>
                ) : (
                  <DataTable
                    columns={coincidenciasColumns}
                    data={data}
                    searchPlaceholder="Buscar coincidencias..."
                    searchColumn="valor"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leidas">
            <Card>
              <CardHeader>
                <CardTitle>Coincidencias Revisadas</CardTitle>
                <CardDescription>
                  Historial de coincidencias que ya han sido revisadas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isError ? (
                  <div className="flex justify-center items-center h-64 text-destructive">
                    <AlertTriangle className="h-8 w-8 mr-2" />
                    Error al cargar datos. Intente nuevamente más tarde.
                  </div>
                ) : data.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4 text-amber-500" />
                    <p className="text-lg font-medium">No hay coincidencias revisadas</p>
                    <p className="text-sm">Aún no se ha marcado ninguna coincidencia como leída.</p>
                  </div>
                ) : (
                  <DataTable
                    columns={coincidenciasColumns}
                    data={data}
                    searchPlaceholder="Buscar coincidencias..."
                    searchColumn="valor"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Diálogo para ver detalles de la compra */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalles de la Compra</DialogTitle>
              <DialogDescription>
                Información completa de la compra asociada a esta coincidencia.
              </DialogDescription>
            </DialogHeader>
            {excelDataDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Tienda</h3>
                    <p className="text-base">
                      {excelDataDetails.storeName} ({excelDataDetails.storeCode})
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Fecha de compra</h3>
                    <p className="text-base">
                      {new Date(excelDataDetails.fecha).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-base font-medium mb-2">Datos del comprador</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Nombre</h3>
                      <p className="text-base">{excelDataDetails.comprador}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">DNI</h3>
                      <p className="text-base">{excelDataDetails.dni || "No disponible"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Teléfono</h3>
                      <p className="text-base">{excelDataDetails.telefono || "No disponible"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Dirección</h3>
                      <p className="text-base">{excelDataDetails.direccion || "No disponible"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-base font-medium mb-2">Datos del artículo</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Artículo</h3>
                      <p className="text-base">{excelDataDetails.articulo}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Precio</h3>
                      <p className="text-base">{excelDataDetails.precio}</p>
                    </div>
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Grabaciones</h3>
                      <p className="text-base">{excelDataDetails.grabaciones || "No disponible"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-base font-medium mb-2">Señalamiento coincidente</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Tipo</h3>
                      <p className="text-base">
                        {selectedCoincidencia?.senalTipo === "persona" ? "Persona" : "Objeto"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Coincidencia</h3>
                      <p className="flex items-center gap-2">
                        {selectedCoincidencia?.coincidenciaExacta ? (
                          <Badge className="bg-red-500">Exacta</Badge>
                        ) : (
                          <Badge className="bg-amber-500">Parcial</Badge>
                        )}
                        <span>
                          {Math.round((selectedCoincidencia?.porcentajeCoincidencia || 0) * 100)}%
                        </span>
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Campo</h3>
                      <p className="text-base">{selectedCoincidencia?.campo}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Valor</h3>
                      <p className="text-base">{selectedCoincidencia?.valor}</p>
                    </div>
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Motivo</h3>
                      <p className="text-base">{selectedCoincidencia?.senalMotivo}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setDetailsDialogOpen(false)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      irADetalleCompra(excelDataDetails.id);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver en Control de Compras
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}