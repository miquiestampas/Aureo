import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Eye, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Store as StoreType, ExcelData, ExcelSearchResults } from "../shared/types";
import StoreInfoDialog from "./StoreInfoDialog";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface ExcelDataSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (data: ExcelData) => void;
  stores: StoreType[];
}

// Definir el esquema de validación para la búsqueda
const searchSchema = z.object({
  searchType: z.enum(["General", "Cliente", "Artículo", "Orden"]).default("General"),
  searchTerms: z.string().optional().refine(val => {
    // Si no hay términos de búsqueda, debe haber al menos un filtro (tienda, fecha o precio)
    if (!val || val.length < 1) return true; // Ya verificaremos la condición completa en onSubmit
    return val.length >= 1;
  }, { message: "Ingrese al menos 1 carácter o use los filtros de tienda, fecha o precio" }),
  storeCode: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  priceMin: z.string().optional(),
  priceMax: z.string().optional(),
  // Eliminamos la opción de incluir archivados - siempre estarán incluidos
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
  const [activeTab, setActiveTab] = useState<string>("search");
  const [storeInfoDialog, setStoreInfoDialog] = useState<{ open: boolean, store: StoreType | null }>({
    open: false,
    store: null
  });
  
  // Inicializar el formulario
  const form = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      searchType: "General",
      searchTerms: "",
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
      // Construir la URL con los parámetros de búsqueda
      const params = new URLSearchParams();
      params.append('searchType', values.searchType);
      params.append('searchTerms', values.searchTerms || '');
      
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
      
      // Los registros archivados siempre se incluyen por defecto
      params.append('includeArchived', 'true');
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
      
      if (data.count === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron coincidencias para tu búsqueda.",
        });
      } else {
        setActiveTab("results");
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${data.count} resultados.`,
        });
      }
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
  
  // Función para mostrar el diálogo de información de tienda
  const onShowStoreInfo = (store: StoreType) => {
    setStoreInfoDialog({
      open: true,
      store
    });
  };
  
  // Columnas para la tabla de resultados
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
        const store = stores.find(s => s.code === storeCode);
        return (
          <Button 
            variant="link" 
            className="p-0 h-auto font-normal text-left"
            onClick={() => onShowStoreInfo(store || { code: storeCode, name: storeCode, location: "", type: "", active: true, id: 0 })}
          >
            {store ? `${store.name} (${storeCode})` : storeCode}
          </Button>
        );
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
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => onViewDetails(row.original)}
          title="Ver detalles"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];
  
  const handleReset = () => {
    form.reset({
      searchType: "General",
      searchTerms: "",
      storeCode: undefined,
      fromDate: undefined,
      toDate: undefined,
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
    setActiveTab("search");
  };
  
  return (
    <div>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Búsqueda avanzada de registros</DialogTitle>
            <DialogDescription>
              Busca información específica en todos los registros de compras.
            </DialogDescription>
          </DialogHeader>
        
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Búsqueda</TabsTrigger>
              <TabsTrigger value="results" disabled={searchResults.length === 0}>
                Resultados {totalResults > 0 && `(${totalResults})`}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="space-y-4 py-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Primera columna de campos */}
                    <div className="space-y-6">
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
                            <FormMessage />
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
                                {stores.map((store) => (
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
                    
                    {/* Segunda columna de campos */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        format(field.value, "PPP")
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
                              <FormMessage />
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
                                        format(field.value, "PPP")
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="priceMin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Precio mínimo</FormLabel>
                              <FormControl>
                                <Input
                                  type="text"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
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
                                  type="text"
                                  placeholder="Sin límite"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <FormLabel>Opciones de búsqueda</FormLabel>
                        <div className="space-y-2">
                          {/* Aquí puedes agregar opciones adicionales si es necesario */}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <FormLabel>Campos de búsqueda</FormLabel>
                    <p className="text-sm text-muted-foreground mb-2">
                      Selecciona los campos en los que deseas buscar
                    </p>
                    
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
                              <FormLabel>Nombre del cliente</FormLabel>
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
                  
                  <DialogFooter className="flex items-center justify-between gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={searchMutation.isPending}
                    >
                      Limpiar filtros
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="submit"
                        disabled={searchMutation.isPending}
                      >
                        {searchMutation.isPending ? "Buscando..." : "Buscar"}
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="results" className="py-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Resultados de la búsqueda</h3>
                    <p className="text-sm text-muted-foreground">
                      Se encontraron {totalResults} registros que coinciden con tu búsqueda.
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveTab("search")}
                    variant="outline"
                  >
                    Nueva búsqueda
                  </Button>
                </div>
                
                <DataTable
                  columns={columns}
                  data={searchResults}
                  pageSize={10}
                />
              </div>
              
              <DialogFooter className="mt-6">
                <Button
                  onClick={onClose}
                  variant="secondary"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {storeInfoDialog.open && (
        <StoreInfoDialog 
          store={storeInfoDialog.store} 
          open={storeInfoDialog.open} 
          onClose={() => setStoreInfoDialog({ open: false, store: null })} 
        />
      )}
    </div>
  );
}