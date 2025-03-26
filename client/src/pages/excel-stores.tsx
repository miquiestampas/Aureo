import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showStoreDataDialog, setShowStoreDataDialog] = useState(false);
  const [storeData, setStoreData] = useState<ExcelData[]>([]);
  
  // Fetch excel stores
  const { data: stores, isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'Excel' }],
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
  
  // Data columns for stores
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
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => handleViewStoreData(row.original)}
            >
              <Database className="h-4 w-4" />
              <span className="sr-only">Ver datos</span>
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
          
          <div className="flex space-x-2">
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowFileUploadModal(true)}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Cargar Archivos
            </Button>
          </div>
          
          {/* Modal de Carga de Archivos */}
          <FileUploadModal 
            isOpen={showFileUploadModal}
            onClose={() => setShowFileUploadModal(false)}
            storesByType={stores?.filter(store => store.type === "Excel") || []}
            fileType="Excel"
          />
        </div>
        
        {/* Listado de tiendas Excel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              Tiendas con datos Excel
            </CardTitle>
            <CardDescription>
              Seleccione una tienda para ver sus registros importados. Actualmente hay {stores?.filter(s => s.type === "Excel")?.length || 0} tiendas configuradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStores ? (
              <div className="py-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <DataTable 
                columns={storeColumns} 
                data={stores?.filter(store => store.type === "Excel") || []} 
                searchKey="name"
              />
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