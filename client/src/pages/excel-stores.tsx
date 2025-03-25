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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Upload,
  Download,
  Eye,
  Table,
  Search,
  UploadCloud,
  Info
} from "lucide-react";
import FileUploadModal from "@/components/FileUploadModal";
import ExcelDataSearch from "@/components/ExcelDataSearch";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
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
  const { recentEvents } = useSocketStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [detailsData, setDetailsData] = useState<ExcelData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Fetch excel stores
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'Excel' }],
  });
  
  // Fetch excel data for selected store
  const { data: excelData, refetch: refetchExcelData } = useQuery<ExcelData[]>({
    queryKey: ['/api/excel-data', { storeCode: selectedStore }],
    enabled: !!selectedStore,
  });
  
  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !selectedStore) return;
      
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("storeCode", selectedStore);
      
      const response = await fetch("/api/upload/excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload file");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File uploaded successfully",
        description: "The file has been queued for processing.",
      });
      setUploadDialogOpen(false);
      setUploadFile(null);
      
      // Refetch file activity data after successful upload
      setTimeout(() => {
        refetchExcelData();
        queryClient.invalidateQueries({ queryKey: ['/api/file-activities'] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
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
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate();
  };
  
  // View details
  const handleViewDetails = (data: ExcelData) => {
    setDetailsData(data);
    setDetailsDialogOpen(true);
  };
  
  // Refetch data when receiving socket events
  useEffect(() => {
    if (recentEvents.length > 0 && selectedStore) {
      const lastEvent = recentEvents[0];
      
      if (lastEvent.type === 'fileProcessingStatus' && 
          lastEvent.data.status === 'Processed') {
        refetchExcelData();
      }
    }
  }, [recentEvents, selectedStore, refetchExcelData]);
  
  // Data columns
  const columns: ColumnDef<ExcelData>[] = [
    {
      accessorKey: "orderNumber",
      header: "Orden #",
    },
    {
      accessorKey: "orderDate",
      header: "Fecha de Orden",
      cell: ({ row }) => {
        const date = new Date(row.original.orderDate);
        return format(date, "MMM d, yyyy");
      }
    },
    {
      accessorKey: "customerName",
      header: "Nombre del Cliente",
    },
    {
      accessorKey: "itemDetails",
      header: "Detalles del Artículo",
    },
    {
      accessorKey: "price",
      header: "Precio",
    },
    {
      accessorKey: "saleDate",
      header: "Fecha de Venta",
      cell: ({ row }) => {
        const date = row.original.saleDate ? new Date(row.original.saleDate) : null;
        return date ? format(date, "MMM d, yyyy") : "No vendido";
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
              onClick={() => handleViewDetails(row.original)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">Ver detalles</span>
            </Button>
          </div>
        );
      }
    }
  ];
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Tiendas Excel</h1>
          
          <div className="flex space-x-2">
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowFileUploadModal(true)}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Cargar Archivos Excel
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setShowSearchModal(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Buscar Registros
            </Button>
            
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Datos
            </Button>
          </div>
          
          {/* Modal de Carga de Archivos */}
          <FileUploadModal 
            isOpen={showFileUploadModal}
            onClose={() => setShowFileUploadModal(false)}
            storesByType={stores?.filter(store => store.type === "Excel") || []}
            fileType="Excel"
          />
          
          {/* Modal de Búsqueda de Datos Excel */}
          <ExcelDataSearch
            isOpen={showSearchModal}
            onClose={() => setShowSearchModal(false)}
            onViewDetails={handleViewDetails}
            stores={stores?.filter(store => store.type === "Excel") || []}
          />
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Seleccionar Tienda</CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              onValueChange={(value) => setSelectedStore(value)}
              value={selectedStore || undefined}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Seleccione una tienda para ver datos" />
              </SelectTrigger>
              <SelectContent>
                {stores?.filter(store => store.type === "Excel").map(store => (
                  <SelectItem key={store.id} value={store.code}>
                    {store.name} ({store.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        {selectedStore ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>
                  <div className="flex items-center">
                    <FileSpreadsheet className="h-5 w-5 mr-2 text-green-600" />
                    Datos de Tienda: {stores?.find(s => s.code === selectedStore)?.name || selectedStore}
                  </div>
                </CardTitle>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Table className="h-4 w-4 mr-1" />
                  {excelData?.length || 0} registros
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {excelData?.length ? (
                <DataTable
                  columns={columns}
                  data={excelData}
                  searchKey="orderNumber"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No hay datos disponibles</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No se encontraron registros de compras para esta tienda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Seleccione una tienda para ver datos</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Elija una tienda Excel del menú desplegable para ver sus datos de compra.
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Item Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalles de Compra</DialogTitle>
              <DialogDescription>
                Información completa sobre la orden de compra seleccionada.
              </DialogDescription>
            </DialogHeader>
            
            {detailsData && (
              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">Información General</TabsTrigger>
                  <TabsTrigger value="product">Detalles del Producto</TabsTrigger>
                  <TabsTrigger value="customer">Datos del Cliente</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Número de Orden</Label>
                      <div className="font-medium">{detailsData.orderNumber}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Código de Tienda</Label>
                      <div className="font-medium">{detailsData.storeCode}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Fecha de Orden</Label>
                      <div className="font-medium">
                        {format(new Date(detailsData.orderDate), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Fecha de Venta</Label>
                      <div className="font-medium">
                        {detailsData.saleDate 
                          ? format(new Date(detailsData.saleDate), "MMM d, yyyy") 
                          : "No vendido"
                        }
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Precio</Label>
                      <div className="font-medium">{detailsData.price}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Boleta de Empeño</Label>
                      <div className="font-medium">{detailsData.pawnTicket || "N/A"}</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="product" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <Label>Detalles del Artículo</Label>
                      <div className="font-medium">{detailsData.itemDetails}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Metales</Label>
                      <div className="font-medium">{detailsData.metals || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Grabados</Label>
                      <div className="font-medium">{detailsData.engravings || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Piedras</Label>
                      <div className="font-medium">{detailsData.stones || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Quilates</Label>
                      <div className="font-medium">{detailsData.carats || "N/A"}</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="customer" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Nombre del Cliente</Label>
                      <div className="font-medium">{detailsData.customerName || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Información de Contacto</Label>
                      <div className="font-medium">{detailsData.customerContact || "N/A"}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDetailsDialogOpen(false)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
