import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Eye,
  Check,
  X,
  AlertTriangle,
  User,
  Package,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Row } from "@tanstack/react-table";
import MainLayout from "@/layouts/main-layout";

// Definición de tipos para las coincidencias
interface Coincidencia {
  id: number;
  estado: "NoLeido" | "Leido" | "Descartado";
  creadoEn: string;
  tipoCoincidencia: "Objeto" | "Persona";
  idSenalPersona: number | null;
  idSenalObjeto: number | null;
  idExcelData: number;
  nombrePersona?: string;
  descripcionObjeto?: string;
  puntuacionCoincidencia: number;
  tipoMatch: "Exacto" | "Parcial";
  campoCoincidente: string;
  valorCoincidente: string;
  ordenInfo: {
    storeCode: string;
    storeName: string;
    orderNumber: string;
    orderDate: string;
    customerName: string;
  };
  revisadoPor: number | null;
  revisadoEn: string | null;
  notasRevision: string | null;
}

// Datos para las pestañas de filtro
const tabsData = [
  { value: "todas", label: "Todas" },
  { value: "noleidas", label: "No leídas" },
  { value: "leidas", label: "Leídas" },
  { value: "descartadas", label: "Descartadas" },
];

export default function Coincidencias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("noleidas");
  const [viewingCoincidencia, setViewingCoincidencia] = useState<Coincidencia | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean, id: number | null, action: "marcar" | "descartar" }>({
    open: false,
    id: null,
    action: "marcar"
  });
  const [reviewNotes, setReviewNotes] = useState("");
  
  // Cargar datos de coincidencias
  const { 
    data: coincidencias = [], 
    isLoading: isLoadingCoincidencias,
    isError: isErrorCoincidencias,
    refetch: refetchCoincidencias
  } = useQuery<Coincidencia[]>({
    queryKey: ["/api/coincidencias", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/coincidencias?estado=${activeTab === "todas" ? "all" : activeTab}`);
      if (!res.ok) throw new Error("Error al cargar coincidencias");
      return res.json();
    }
  });
  
  // Mutación para marcar como leída
  const markAsReadMutation = useMutation({
    mutationFn: async ({id, notas}: {id: number, notas: string}) => {
      const response = await fetch(`/api/coincidencias/${id}/leer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notasRevision: notas }),
      });
      
      if (!response.ok) {
        throw new Error("Error al marcar coincidencia como leída");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Coincidencia revisada",
        description: "La coincidencia ha sido marcada como leída correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias/noleidas/count"] });
      setReviewDialog({ open: false, id: null, action: "marcar" });
      setReviewNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al marcar coincidencia: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para descartar
  const dismissMutation = useMutation({
    mutationFn: async ({id, notas}: {id: number, notas: string}) => {
      const response = await fetch(`/api/coincidencias/${id}/descartar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notasRevision: notas }),
      });
      
      if (!response.ok) {
        throw new Error("Error al descartar coincidencia");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Coincidencia descartada",
        description: "La coincidencia ha sido descartada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coincidencias/noleidas/count"] });
      setReviewDialog({ open: false, id: null, action: "descartar" });
      setReviewNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al descartar coincidencia: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Columnas para la tabla de coincidencias
  const coincidenciasColumns = [
    {
      accessorKey: "tipoCoincidencia",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Tipo" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const tipo = row.getValue("tipoCoincidencia");
        return (
          <div className="flex items-center">
            {tipo === "Persona" ? (
              <User className="mr-2 h-4 w-4" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            {tipo}
          </div>
        );
      },
    },
    {
      accessorKey: "valorCoincidente",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Valor encontrado" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const valor = row.getValue("valorCoincidente") as string;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[250px] truncate">{valor}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{valor}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "tipoMatch",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Precisión" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const tipoMatch = row.getValue("tipoMatch") as string;
        const puntuacion = row.original.puntuacionCoincidencia;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={tipoMatch === "Exacto" ? "destructive" : "default"}>
                  {tipoMatch}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Puntuación: {(puntuacion * 100).toFixed(2)}%</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "ordenInfo.storeCode",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Tienda" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const storeCode = row.original.ordenInfo.storeCode;
        const storeName = row.original.ordenInfo.storeName;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{storeCode}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{storeName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "ordenInfo.orderNumber",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Nº Orden" />,
    },
    {
      accessorKey: "creadoEn",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const fecha = new Date(row.getValue("creadoEn"));
        return format(fecha, "dd/MM/yyyy", { locale: es });
      },
    },
    {
      accessorKey: "estado",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Estado" />,
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const estado = row.getValue("estado") as string;
        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        let label = "";
        
        switch (estado) {
          case "NoLeido":
            variant = "destructive";
            label = "No leído";
            break;
          case "Leido":
            variant = "default";
            label = "Leído";
            break;
          case "Descartado":
            variant = "secondary";
            label = "Descartado";
            break;
        }
        
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<Coincidencia> }) => {
        const coincidencia = row.original;
        const noLeida = coincidencia.estado === "NoLeido";
        
        return (
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setViewingCoincidencia(coincidencia)}>
              <Eye className="h-4 w-4" />
            </Button>
            {noLeida && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setReviewDialog({ 
                    open: true, 
                    id: coincidencia.id, 
                    action: "marcar" 
                  })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setReviewDialog({ 
                    open: true, 
                    id: coincidencia.id, 
                    action: "descartar" 
                  })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];
  
  // Función para obtener el color del estado según su valor
  const getStatusColor = (status: string) => {
    switch (status) {
      case "NoLeido": return "text-destructive";
      case "Leido": return "text-primary";
      case "Descartado": return "text-muted-foreground";
      default: return "";
    }
  };
  
  // Filtrar coincidencias según la pestaña activa
  const filteredCoincidencias = coincidencias.filter(coincidencia => {
    if (activeTab === "todas") return true;
    if (activeTab === "noleidas") return coincidencia.estado === "NoLeido";
    if (activeTab === "leidas") return coincidencia.estado === "Leido";
    if (activeTab === "descartadas") return coincidencia.estado === "Descartado";
    return true;
  });
  
  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Coincidencias</h2>
          <p className="text-muted-foreground">
            Revise y gestione las coincidencias detectadas en los registros de compras
          </p>
        </div>
        
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-4 mb-4">
            {tabsData.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                {tab.value === "noleidas" && (
                  <Badge className="ml-2 bg-destructive hover:bg-destructive text-white">
                    {coincidencias.filter(c => c.estado === "NoLeido").length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {tabsData.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {tab.label === "Todas" ? "Todas las coincidencias" : `Coincidencias ${tab.label.toLowerCase()}`}
                  </CardTitle>
                  <CardDescription>
                    {tab.value === "noleidas" && "Coincidencias que requieren revisión"}
                    {tab.value === "leidas" && "Coincidencias que han sido revisadas"}
                    {tab.value === "descartadas" && "Coincidencias que han sido descartadas"}
                    {tab.value === "todas" && "Todas las coincidencias detectadas en el sistema"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable 
                    columns={coincidenciasColumns}
                    data={filteredCoincidencias}
                    searchColumn="valorCoincidente"
                    searchPlaceholder="Buscar por valor coincidente..."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Diálogo para ver detalles de coincidencia */}
        <Dialog open={!!viewingCoincidencia} onOpenChange={(open) => !open && setViewingCoincidencia(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                Detalles de coincidencia
              </DialogTitle>
              <DialogDescription>
                Información detallada sobre la coincidencia detectada
              </DialogDescription>
            </DialogHeader>
            
            {viewingCoincidencia && (
              <div className="space-y-4">
                {/* Información general */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Tipo</h3>
                    <p className="text-sm mt-1">
                      {viewingCoincidencia.tipoCoincidencia === "Persona" ? (
                        <span className="flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          Persona
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Package className="mr-2 h-4 w-4" />
                          Objeto
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Estado</h3>
                    <p className={`text-sm mt-1 ${getStatusColor(viewingCoincidencia.estado)}`}>
                      {viewingCoincidencia.estado === "NoLeido" && "No leído"}
                      {viewingCoincidencia.estado === "Leido" && "Leído"}
                      {viewingCoincidencia.estado === "Descartado" && "Descartado"}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Fecha de detección</h3>
                    <p className="text-sm mt-1">
                      {format(new Date(viewingCoincidencia.creadoEn), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium">Precisión</h3>
                    <p className="text-sm mt-1 flex items-center">
                      <Badge variant={viewingCoincidencia.tipoMatch === "Exacto" ? "destructive" : "default"}>
                        {viewingCoincidencia.tipoMatch}
                      </Badge>
                      <span className="ml-2">
                        ({(viewingCoincidencia.puntuacionCoincidencia * 100).toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                </div>
                
                {/* Información de señalamiento */}
                <div className="border rounded-md p-3 bg-muted/50">
                  <h3 className="text-sm font-medium mb-2">Señalamiento</h3>
                  <div className="space-y-2">
                    {viewingCoincidencia.tipoCoincidencia === "Persona" ? (
                      <>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Nombre:</span>
                          <p className="text-sm">{viewingCoincidencia.nombrePersona || "N/A"}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Descripción:</span>
                          <p className="text-sm">{viewingCoincidencia.descripcionObjeto || "N/A"}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Campo coincidente:</span>
                      <p className="text-sm">{viewingCoincidencia.campoCoincidente}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Valor encontrado:</span>
                      <p className="text-sm">{viewingCoincidencia.valorCoincidente}</p>
                    </div>
                  </div>
                </div>
                
                {/* Información de la orden */}
                <div className="border rounded-md p-3 bg-muted/50">
                  <h3 className="text-sm font-medium mb-2">Información de la orden</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Tienda:</span>
                      <p className="text-sm">
                        {viewingCoincidencia.ordenInfo.storeCode} - {viewingCoincidencia.ordenInfo.storeName}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Nº Orden:</span>
                      <p className="text-sm">{viewingCoincidencia.ordenInfo.orderNumber}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Fecha orden:</span>
                      <p className="text-sm">
                        {format(new Date(viewingCoincidencia.ordenInfo.orderDate), "dd/MM/yyyy", { locale: es })}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Cliente:</span>
                      <p className="text-sm">{viewingCoincidencia.ordenInfo.customerName || "N/A"}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button variant="outline" size="sm" className="mt-2" asChild>
                      <a href={`/purchase-control?orderNumber=${viewingCoincidencia.ordenInfo.orderNumber}`} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver en Control de Compras
                      </a>
                    </Button>
                  </div>
                </div>
                
                {/* Información de revisión */}
                {(viewingCoincidencia.estado === "Leido" || viewingCoincidencia.estado === "Descartado") && (
                  <div className="border rounded-md p-3 bg-muted/50">
                    <h3 className="text-sm font-medium mb-2">Información de revisión</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Revisado por:</span>
                        <p className="text-sm">ID: {viewingCoincidencia.revisadoPor}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Fecha de revisión:</span>
                        <p className="text-sm">
                          {viewingCoincidencia.revisadoEn 
                            ? format(new Date(viewingCoincidencia.revisadoEn), "dd/MM/yyyy HH:mm", { locale: es })
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Notas:</span>
                        <p className="text-sm whitespace-pre-wrap">
                          {viewingCoincidencia.notasRevision || "Sin notas"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Acciones */}
                <DialogFooter className="gap-2">
                  {viewingCoincidencia.estado === "NoLeido" && (
                    <>
                      <Button
                        onClick={() => {
                          setReviewDialog({ 
                            open: true, 
                            id: viewingCoincidencia.id, 
                            action: "marcar" 
                          });
                          setViewingCoincidencia(null);
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Marcar como leída
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setReviewDialog({ 
                            open: true, 
                            id: viewingCoincidencia.id, 
                            action: "descartar" 
                          });
                          setViewingCoincidencia(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Descartar
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Diálogo para marcar como leída o descartar */}
        <Dialog 
          open={reviewDialog.open} 
          onOpenChange={(open) => !open && setReviewDialog({ open: false, id: null, action: "marcar" })}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.action === "marcar" ? "Marcar como leída" : "Descartar coincidencia"}
              </DialogTitle>
              <DialogDescription>
                {reviewDialog.action === "marcar" 
                  ? "Añada notas opcionales sobre esta coincidencia" 
                  : "Explique por qué descarta esta coincidencia"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Notas de revisión</h3>
                <Textarea 
                  placeholder="Ingrese notas sobre esta revisión (opcional)"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setReviewDialog({ open: false, id: null, action: "marcar" })}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (reviewDialog.id === null) return;
                  
                  if (reviewDialog.action === "marcar") {
                    markAsReadMutation.mutate({ id: reviewDialog.id, notas: reviewNotes });
                  } else {
                    dismissMutation.mutate({ id: reviewDialog.id, notas: reviewNotes });
                  }
                }}
              >
                {reviewDialog.action === "marcar" ? "Marcar como leída" : "Descartar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}