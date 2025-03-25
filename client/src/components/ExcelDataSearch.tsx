import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarIcon, Search, X, AlertCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
}

interface ExcelDataSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (data: ExcelData) => void;
  stores: Store[];
}

const searchSchema = z.object({
  searchType: z.enum(["Cliente", "Artículo", "Orden", "General"]),
  searchTerms: z.string().min(2, "Ingrese al menos 2 caracteres para buscar"),
  storeCode: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  includeArchived: z.boolean().default(false),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  searchCustomerName: z.boolean().default(true),
  searchCustomerContact: z.boolean().default(true),
  searchItemDetails: z.boolean().default(true),
  searchMetals: z.boolean().default(true),
  searchStones: z.boolean().default(true),
  searchEngravings: z.boolean().default(true),
});

type SearchValues = z.infer<typeof searchSchema>;

export default function ExcelDataSearch({ isOpen, onClose, onViewDetails, stores }: ExcelDataSearchProps) {
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<ExcelData[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  
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

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (values: SearchValues) => {
      setSearching(true);
      try {
        const searchParams = new URLSearchParams();
        
        searchParams.append('searchType', values.searchType);
        searchParams.append('searchTerms', values.searchTerms);
        
        if (values.storeCode) searchParams.append('storeCode', values.storeCode);
        if (values.fromDate) searchParams.append('fromDate', values.fromDate.toISOString());
        if (values.toDate) searchParams.append('toDate', values.toDate.toISOString());
        if (values.includeArchived) searchParams.append('includeArchived', 'true');
        if (values.priceMin) searchParams.append('priceMin', values.priceMin);
        if (values.priceMax) searchParams.append('priceMax', values.priceMax);
        
        // Add field-specific search flags
        searchParams.append('searchCustomerName', values.searchCustomerName.toString());
        searchParams.append('searchCustomerContact', values.searchCustomerContact.toString());
        searchParams.append('searchItemDetails', values.searchItemDetails.toString());
        searchParams.append('searchMetals', values.searchMetals.toString());
        searchParams.append('searchStones', values.searchStones.toString());
        searchParams.append('searchEngravings', values.searchEngravings.toString());
        
        const response = await fetch(`/api/search/excel-data?${searchParams.toString()}`, {
          method: "GET",
          credentials: "include",
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Error al realizar la búsqueda");
        }
        
        const data: ExcelSearchResults = await response.json();
        return data;
      } finally {
        setSearching(false);
      }
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      setTotalResults(data.count);
      setSearchPerformed(true);
      
      if (data.count === 0) {
        toast({
          title: "No se encontraron resultados",
          description: "Intenta con otros términos de búsqueda",
          variant: "default",
        });
      } else {
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${data.count} resultados`,
        });
      }
      
      // Add search to history
      queryClient.invalidateQueries({ queryKey: ['/api/search-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la búsqueda",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: SearchValues) => {
    searchMutation.mutate(values);
  };
  
  const handleReset = () => {
    form.reset({
      searchType: "General",
      searchTerms: "",
      storeCode: undefined,
      fromDate: undefined,
      toDate: undefined,
      includeArchived: false,
      priceMin: undefined,
      priceMax: undefined,
      searchCustomerName: true,
      searchCustomerContact: true,
      searchItemDetails: true,
      searchMetals: true,
      searchStones: true,
      searchEngravings: true,
    });
    setSearchResults([]);
    setTotalResults(0);
    setSearchPerformed(false);
  };
  
  // Data columns
  const columns: ColumnDef<ExcelData>[] = [
    {
      accessorKey: "orderNumber",
      header: "Orden #",
    },
    {
      accessorKey: "storeCode",
      header: "Tienda",
    },
    {
      accessorKey: "orderDate",
      header: "Fecha de Orden",
      cell: ({ row }) => {
        const date = new Date(row.original.orderDate);
        return format(date, "dd/MM/yyyy");
      }
    },
    {
      accessorKey: "customerName",
      header: "Nombre del Cliente",
    },
    {
      accessorKey: "itemDetails",
      header: "Detalles del Artículo",
      cell: ({ row }) => {
        const details = row.original.itemDetails;
        return details.length > 30 ? `${details.substring(0, 30)}...` : details;
      }
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
              onClick={() => onViewDetails(row.original)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">Ver detalles</span>
            </Button>
          </div>
        );
      }
    }
  ];

  const searchType = form.watch("searchType");
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Búsqueda Avanzada de Datos Excel
          </DialogTitle>
          <DialogDescription>
            Busque registros específicos en los datos importados de Excel por cliente, artículo, orden o texto general.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="search" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Búsqueda</TabsTrigger>
            <TabsTrigger value="results" disabled={!searchPerformed}>
              Resultados {searchPerformed && `(${totalResults})`}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4 pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipo de búsqueda */}
                  <FormField
                    control={form.control}
                    name="searchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Búsqueda</FormLabel>
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
                            <SelectItem value="Cliente">Buscar por Cliente</SelectItem>
                            <SelectItem value="Artículo">Buscar por Artículo</SelectItem>
                            <SelectItem value="Orden">Buscar por Número de Orden</SelectItem>
                            <SelectItem value="General">Búsqueda General</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {searchType === 'Cliente' && "Buscar por nombre o contacto del cliente"}
                          {searchType === 'Artículo' && "Buscar por detalles, metales o piedras del artículo"}
                          {searchType === 'Orden' && "Buscar por número de orden o boleta"}
                          {searchType === 'General' && "Buscar en todos los campos"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Tienda */}
                  <FormField
                    control={form.control}
                    name="storeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tienda</FormLabel>
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
                            <SelectItem value="">Todas las tiendas</SelectItem>
                            {stores.filter(store => store.type === 'Excel').map(store => (
                              <SelectItem key={store.id} value={store.code}>
                                {store.name} ({store.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Limitar la búsqueda a una tienda específica
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Términos de búsqueda */}
                <FormField
                  control={form.control}
                  name="searchTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Términos de Búsqueda</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={
                              searchType === 'Cliente' ? 'Nombre o contacto del cliente...' :
                              searchType === 'Artículo' ? 'Detalles, metales o piedras...' :
                              searchType === 'Orden' ? 'Número de orden o boleta...' :
                              'Buscar en todos los campos...'
                            }
                            className="pl-8"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Ingrese al menos 2 caracteres para buscar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Filtros adicionales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha desde */}
                  <FormField
                    control={form.control}
                    name="fromDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Desde Fecha</FormLabel>
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
                                  <span>Seleccionar fecha</span>
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
                        <FormDescription>
                          Filtrar registros desde esta fecha
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Fecha hasta */}
                  <FormField
                    control={form.control}
                    name="toDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Hasta Fecha</FormLabel>
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
                                  <span>Seleccionar fecha</span>
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
                        <FormDescription>
                          Filtrar registros hasta esta fecha
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Precio mínimo */}
                  <FormField
                    control={form.control}
                    name="priceMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Mínimo</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="Precio mínimo" {...field} />
                        </FormControl>
                        <FormDescription>
                          Filtrar por precio mínimo
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Precio máximo */}
                  <FormField
                    control={form.control}
                    name="priceMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Máximo</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="Precio máximo" {...field} />
                        </FormControl>
                        <FormDescription>
                          Filtrar por precio máximo
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Filtros de campos */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Campos a incluir en la búsqueda</AlertTitle>
                  <AlertDescription>
                    Seleccione los campos específicos en los que desea buscar
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  <FormField
                    control={form.control}
                    name="searchCustomerName"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Nombre del Cliente</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="searchCustomerContact"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Contacto del Cliente</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="searchItemDetails"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Detalles del Artículo</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="searchMetals"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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
                
                <FormField
                  control={form.control}
                  name="includeArchived"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Incluir Registros Archivados</FormLabel>
                        <FormDescription>
                          Incluir registros que han sido archivados
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-between">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleReset}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpiar Filtros
                  </Button>
                  
                  <Button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/90"
                    disabled={searchMutation.isPending}
                  >
                    {searchMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="results" className="space-y-4 pt-4">
            {searchPerformed && (
              <>
                <div className="flex justify-between items-center">
                  <div className="text-sm">
                    Se encontraron <Badge variant="outline">{totalResults}</Badge> resultados
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => form.getValues().searchType === "General" ? 
                      window.location.href = `/api/export/excel-search?q=${form.getValues().searchTerms}` : 
                      window.location.href = `/api/export/excel-search?type=${form.getValues().searchType}&q=${form.getValues().searchTerms}`}
                    disabled={searchResults.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Resultados
                  </Button>
                </div>
                
                {searchResults.length > 0 ? (
                  <DataTable
                    columns={columns}
                    data={searchResults}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No se encontraron resultados</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      No se encontraron registros que coincidan con sus criterios de búsqueda. Intente con diferentes términos o menos filtros.
                    </p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}