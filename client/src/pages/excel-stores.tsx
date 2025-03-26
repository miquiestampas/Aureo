import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSocketStore } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Eye, 
  Table, 
  Search, 
  UploadCloud, 
  Info, 
  X, 
  CalendarIcon,
  FilterX,
  FileText
} from "lucide-react";
import FileUploadModal from "@/components/FileUploadModal";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface ExcelSearchResults {
  results: ExcelData[];
  count: number;
  searchType: string;
}

// Definir el esquema de validación para la búsqueda
const searchSchema = z.object({
  searchType: z.enum(["General", "Cliente", "Artículo", "Orden"]).default("General"),
  searchTerms: z.string().min(2, { message: "Los términos de búsqueda deben tener al menos 2 caracteres" }),
  storeCode: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  includeArchived: z.boolean().default(false),
  searchCustomerName: z.boolean().default(true),
  searchCustomerContact: z.boolean().default(true),
  searchItemDetails: z.boolean().default(true),
  searchMetals: z.boolean().default(true),
  searchStones: z.boolean().default(true),
  searchEngravings: z.boolean().default(true),
});

type SearchValues = z.infer<typeof searchSchema>;

export default function ExcelStoresPage() {
  const { toast } = useToast();
  const { recentEvents } = useSocketStore();
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [detailsData, setDetailsData] = useState<ExcelData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ExcelData[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  
  // Fetch excel stores
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'Excel' }],
  });
  
  // Inicializar el formulario de búsqueda
  const form = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      searchType: "General",
      searchTerms: "",
      includeArchived: false,
      searchCustomerName: true,
      searchCustomerContact: true,
      searchItemDetails: true,
      searchMetals: true,
      searchStones: true,
      searchEngravings: true,
    },
  });
  
  // Mutación para realizar la búsqueda
  const searchMutation = useMutation({
    mutationFn: async (values: SearchValues) => {
      setIsSearching(true);
      
      // Construir la URL con los parámetros de búsqueda
      const params = new URLSearchParams();
      params.append('searchType', values.searchType);
      params.append('searchTerms', values.searchTerms);
      
      if (values.storeCode && values.storeCode !== 'all') {
        params.append('storeCode', values.storeCode);
      }
      
      if (values.fromDate) {
        params.append('fromDate', values.fromDate.toISOString());
      }
      
      if (values.toDate) {
        params.append('toDate', values.toDate.toISOString());
      }
      
      if (values.priceMin) {
        params.append('priceMin', values.priceMin);
      }
      
      if (values.priceMax) {
        params.append('priceMax', values.priceMax);
      }
      
      params.append('includeArchived', values.includeArchived.toString());
      params.append('searchCustomerName', values.searchCustomerName.toString());
      params.append('searchCustomerContact', values.searchCustomerContact.toString());
      params.append('searchItemDetails', values.searchItemDetails.toString());
      params.append('searchMetals', values.searchMetals.toString());
      params.append('searchStones', values.searchStones.toString());
      params.append('searchEngravings', values.searchEngravings.toString());
      
      const response = await fetch(`/api/search/excel-data?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al realizar la búsqueda");
      }
      
      const data: ExcelSearchResults = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      setTotalResults(data.count);
      setIsSearching(false);
      
      if (data.count === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron coincidencias para tu búsqueda.",
        });
      } else {
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${data.count} resultados.`,
        });
      }
    },
    onError: (error: Error) => {
      setIsSearching(false);
      toast({
        title: "Error en la búsqueda",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleResetSearch = () => {
    form.reset({
      searchType: "General",
      searchTerms: "",
      storeCode: undefined,
      fromDate: undefined,
      toDate: undefined,
      priceMin: undefined,
      priceMax: undefined,
      includeArchived: false,
      searchCustomerName: true,
      searchCustomerContact: true,
      searchItemDetails: true,
      searchMetals: true,
      searchStones: true,
      searchEngravings: true,
    });
    setSearchResults([]);
    setTotalResults(0);
  };
  
  const onSubmitSearch = (values: SearchValues) => {
    searchMutation.mutate(values);
  };
  
  // View details
  const handleViewDetails = (data: ExcelData) => {
    setDetailsData(data);
    setDetailsDialogOpen(true);
  };
  
  // Refetch data when receiving socket events
  useEffect(() => {
    if (recentEvents.length > 0) {
      const lastEvent = recentEvents[0];
      
      if (lastEvent.type === 'fileProcessingStatus' && 
          lastEvent.data.status === 'Processed') {
        // Si tenemos una búsqueda activa, refrescarla
        if (searchResults.length > 0 && form.getValues("searchTerms")) {
          searchMutation.mutate(form.getValues());
        }
      }
    }
  }, [recentEvents]);
  
  // Data columns
  const columns: ColumnDef<ExcelData>[] = [
    {
      accessorKey: "orderNumber",
      header: "Orden #",
    },
    {
      accessorKey: "storeCode",
      header: "Tienda",
      cell: ({ row }) => {
        const storeCode = row.original.storeCode;
        const store = stores?.find(s => s.code === storeCode);
        return store ? `${store.name} (${storeCode})` : storeCode;
      }
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
      accessorKey: "itemDetails",
      header: "Artículo",
    },
    {
      accessorKey: "price",
      header: "Precio",
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
          <h1 className="text-2xl font-semibold text-gray-900">Registros Excel</h1>
          
          <div className="flex space-x-2">
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowFileUploadModal(true)}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Cargar Archivos Excel
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
        </div>
        
        {/* Módulo de búsqueda */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="mr-2 h-5 w-5" />
              Búsqueda Avanzada
            </CardTitle>
            <CardDescription>
              Busque registros por diferentes criterios. La búsqueda ignora acentos, puntuación y caracteres especiales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitSearch)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="searchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de búsqueda</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo de búsqueda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="General">Búsqueda general</SelectItem>
                            <SelectItem value="Cliente">Por cliente</SelectItem>
                            <SelectItem value="Artículo">Por artículo</SelectItem>
                            <SelectItem value="Orden">Por orden</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Selecciona el tipo de información que estás buscando
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="searchTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Términos de búsqueda</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Ingrese lo que desea buscar..."
                              className="pl-9"
                              {...field}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-9 w-9 p-0"
                                onClick={() => form.setValue("searchTerms", "")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          {form.getValues("searchType") === "Cliente" && "Buscar por nombre o contacto del cliente"}
                          {form.getValues("searchType") === "Artículo" && "Buscar por detalles, metales, piedras o grabados"}
                          {form.getValues("searchType") === "Orden" && "Buscar por número de orden o boleta"}
                          {form.getValues("searchType") === "General" && "Buscar en todos los campos disponibles"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="storeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filtrar por tienda</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Todas las tiendas" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">Todas las tiendas</SelectItem>
                            {stores?.filter(store => store.type === "Excel").map((store) => (
                              <SelectItem key={store.id} value={store.code}>
                                {store.name} ({store.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Limitar la búsqueda a una tienda específica
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Fecha de compra</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fromDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Desde fecha</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "dd/MM/yyyy")
                                    ) : (
                                      <span>Seleccionar</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="toDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Hasta fecha</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "dd/MM/yyyy")
                                    ) : (
                                      <span>Seleccionar</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Rango de precio</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="priceMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio mínimo</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="priceMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio máximo</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Sin límite"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Opciones adicionales</h3>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="includeArchived"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Incluir registros archivados</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Campos de búsqueda</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="searchCustomerName"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Nombre de cliente</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="searchCustomerContact"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Contacto del cliente</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="searchItemDetails"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Detalles del artículo</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="searchMetals"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Metales</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="searchStones"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Piedras</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="searchEngravings"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Grabados</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSearch}
                    className="flex items-center"
                  >
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpiar filtros
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={searchMutation.isPending || isSearching}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {searchMutation.isPending || isSearching ? (
                      <>Buscando...</>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar registros
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Resultados de la búsqueda */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>
                <div className="flex items-center">
                  <FileSpreadsheet className="h-5 w-5 mr-2 text-green-600" />
                  {searchResults.length > 0 
                    ? `Resultados de búsqueda (${totalResults})` 
                    : "Resultados"}
                </div>
              </CardTitle>
              {searchResults.length > 0 && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 mr-1" />
                  {form.getValues("searchType") === "General" 
                    ? "Búsqueda general" 
                    : form.getValues("searchType") === "Cliente" 
                      ? "Búsqueda por cliente"
                      : form.getValues("searchType") === "Artículo" 
                        ? "Búsqueda por artículo"
                        : "Búsqueda por orden"}
                  : "{form.getValues("searchTerms")}"
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {searchResults.length > 0 ? (
              <DataTable
                columns={columns}
                data={searchResults}
                searchKey="orderNumber"
              />
            ) : isSearching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <h3 className="text-lg font-medium">Buscando registros...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Por favor espere mientras procesamos su consulta
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Sin resultados</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {form.getValues("searchTerms") 
                    ? "No se encontraron coincidencias para tu búsqueda." 
                    : "Utilice el formulario de búsqueda para encontrar registros."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
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
                        {format(new Date(detailsData.orderDate), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Fecha de Venta</Label>
                      <div className="font-medium">
                        {detailsData.saleDate 
                          ? format(new Date(detailsData.saleDate), "dd/MM/yyyy") 
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
