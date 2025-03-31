import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Store as StoreType, ExcelData } from "../shared/types";
import StoreInfoDialog from "../components/StoreInfoDialog";

// Components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Icons
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  User,
  Phone,
  MapPin,
  FileSpreadsheet,
  Store as StoreIcon,
  Package,
  Info,
  ArrowUpDown,
  ChevronsUpDown,
  X,
  Eye,
  Download,
  Printer,
  AlertTriangle,
  Quote,
  Gem,
} from "lucide-react";

// Types
interface Alert {
  id: number;
  excelDataId: number;
  watchlistItemId?: number;
  watchlistPersonId?: number;
  type: string;
  matchType: string;
  matchValue: string;
  alertDate: string;
  status: string;
  reviewedBy?: number;
  reviewNotes?: string;
}

interface SearchParams {
  query: string;
  storeCode?: string;
  dateFrom?: string;
  dateTo?: string;
  orderNumber?: string;
  customerName?: string;
  customerContact?: string;
  customerAddress?: string; // Añadido: dirección del cliente
  customerLocation?: string; // Añadido: provincia/país del cliente
  itemDetails?: string;
  metals?: string;
  engravings?: string; // Agregamos campo para grabaciones
  stones?: string; // Agregamos campo para piedras
  price?: string;
  priceOperator?: string;
  onlyAlerts?: boolean;
}

export default function PurchaseControlPage() {
  const { toast } = useToast();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: "",
    storeCode: "",
    customerName: "",
    customerContact: "",
    customerLocation: "", // Añadido: provincia/país del cliente
    itemDetails: "",
    metals: "",
    engravings: "",
    stones: "",
  });
  const [advancedSearch, setAdvancedSearch] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedRecord, setSelectedRecord] = useState<ExcelData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ExcelData;
    direction: 'asc' | 'desc';
  }>({ key: 'orderDate', direction: 'desc' });
  
  // Estado para el diálogo de información de tienda
  const [storeInfoOpen, setStoreInfoOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);

  const today = new Date();

  // Fetch stores for filter
  const { data: stores } = useQuery<StoreType[]>({
    queryKey: ['/api/stores'],
  });

  // Excel stores (type: Excel) for the filter
  const excelStores = stores?.filter(store => store.type === "Excel" && store.active) || [];

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (params: SearchParams) => {
      const response = await apiRequest(
        "POST", 
        "/api/search/excel-data/advanced", 
        params
      );
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.results && data.results.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron registros que coincidan con los criterios de búsqueda.",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la búsqueda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get alerts for a specific record
  const getAlerts = async (excelDataId: number) => {
    try {
      const response = await apiRequest("GET", `/api/alerts/excel/${excelDataId}`);
      const alertsData = await response.json();
      setAlerts(alertsData);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      setAlerts([]);
    }
  };

  // View record details
  const handleViewDetails = (record: ExcelData) => {
    setSelectedRecord(record);
    getAlerts(record.id);
    setIsDetailOpen(true);
  };
  
  // Mostrar información de la tienda
  const handleShowStore = (storeCode: string) => {
    const store = stores?.find(s => s.code.trim() === storeCode.trim());
    if (store) {
      setSelectedStore(store);
      setStoreInfoOpen(true);
    } else {
      toast({
        title: "Tienda no encontrada",
        description: `No se encontró información para la tienda ${storeCode}`,
        variant: "destructive",
      });
    }
  };

  // Handle search form submit
  const handleSearch = () => {
    let params: SearchParams;

    if (advancedSearch) {
      // Parámetros para búsqueda avanzada
      params = {
        query: searchQuery, // Mantener la consulta general también en búsqueda avanzada
        storeCode: searchParams.storeCode === "all" ? undefined : searchParams.storeCode || undefined,
        dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
        orderNumber: searchParams.orderNumber || undefined,
        customerName: searchParams.customerName || undefined,
        customerContact: searchParams.customerContact || undefined,
        customerLocation: searchParams.customerLocation || undefined, // Añadido: provincia/país del cliente
        itemDetails: searchParams.itemDetails || undefined,
        metals: searchParams.metals || undefined,
        engravings: searchParams.engravings || undefined,
        stones: searchParams.stones || undefined,
        price: searchParams.price || undefined,
        priceOperator: searchParams.priceOperator || undefined,
        onlyAlerts: searchParams.onlyAlerts || undefined
      };
    } else {
      // Parámetros para búsqueda simple - solo la consulta
      params = {
        query: searchQuery
      };
    }

    // Record search in history
    if (searchQuery.trim()) {
      recordSearchHistory(searchQuery);
    }

    console.log("Enviando parámetros de búsqueda:", params);
    // Execute search
    searchMutation.mutate(params);
  };

  // Record search to history
  const recordSearchHistory = async (query: string) => {
    if (!query.trim()) return;

    try {
      await apiRequest("POST", "/api/search-history", {
        query,
        searchType: "excel_data",
      });
    } catch (error) {
      console.error("Error recording search history:", error);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch (e) {
      return dateStr;
    }
  };

  // Get sorted results
  const getSortedResults = () => {
    if (!searchMutation.data?.results) return [];

    return [...searchMutation.data.results].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null or undefined values
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }

      // Handle date comparison
      if (sortConfig.key === 'orderDate' || sortConfig.key === 'saleDate') {
        const dateA = aValue ? new Date(aValue).getTime() : 0;
        const dateB = bValue ? new Date(bValue).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return 0;
    });
  };

  // Sort handler
  const handleSort = (key: keyof ExcelData) => {
    setSortConfig({
      key,
      direction: 
        sortConfig.key === key 
          ? sortConfig.direction === 'asc' 
            ? 'desc' 
            : 'asc' 
          : 'asc',
    });
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Control de Compras</h1>
            <p className="text-gray-500 mt-1">Busque y analice datos de compras de todas las tiendas</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Search className="h-5 w-5 mr-2 text-primary" />
                <CardTitle>Buscador de Compras</CardTitle>
              </div>
              <Button
                variant="default"
                onClick={() => setAdvancedSearch(!advancedSearch)}
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {advancedSearch ? "Búsqueda Simple" : "Búsqueda Avanzada"}
              </Button>
            </div>
            <CardDescription>
              {advancedSearch
                ? "Utilice los filtros avanzados para refinar su búsqueda"
                : "Busque por nombre, documento, objeto, metales, etc."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!advancedSearch ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por nombre, documento, objeto, metales..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="store-filter">Tienda</Label>
                    <Select
                      value={searchParams.storeCode || "all"}
                      onValueChange={(value) =>
                        setSearchParams({ ...searchParams, storeCode: value })
                      }
                    >
                      <SelectTrigger id="store-filter">
                        <SelectValue placeholder="Todas las tiendas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las tiendas</SelectItem>
                        {excelStores.map((store) => (
                          <SelectItem key={store.id} value={store.code}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date-from">Fecha desde</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? (
                            format(dateFrom, "dd/MM/yyyy")
                          ) : (
                            <span>Seleccione fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          defaultMonth={dateFrom}
                          toDate={today}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="date-to">Fecha hasta</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? (
                            format(dateTo, "dd/MM/yyyy")
                          ) : (
                            <span>Seleccione fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                          defaultMonth={dateTo}
                          toDate={today}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="customer-name">Nombre del Cliente</Label>
                    <Input
                      id="customer-name"
                      placeholder="Nombre del cliente"
                      value={searchParams.customerName || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          customerName: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer-contact">Documento</Label>
                    <Input
                      id="customer-contact"
                      placeholder="DNI/NIE/Pasaporte"
                      value={searchParams.customerContact || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          customerContact: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer-location">Provincia/País</Label>
                    <Input
                      id="customer-location"
                      placeholder="Madrid, Barcelona, etc."
                      value={searchParams.customerLocation || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          customerLocation: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="order-number">Número de Orden</Label>
                    <Input
                      id="order-number"
                      placeholder="Número de orden"
                      value={searchParams.orderNumber || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          orderNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="item-details">Descripción del Objeto</Label>
                    <Input
                      id="item-details"
                      placeholder="Objeto, descripción"
                      value={searchParams.itemDetails || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          itemDetails: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="metals">Metales</Label>
                    <Input
                      id="metals"
                      placeholder="Oro, plata, etc."
                      value={searchParams.metals || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          metals: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Nueva fila para grabados y piedras */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="engravings" className="flex items-center">
                      <Quote className="h-4 w-4 mr-1 text-primary" />
                      <span>Grabaciones</span>
                    </Label>
                    <Input
                      id="engravings"
                      placeholder="Iniciales, fechas, inscripciones..."
                      value={searchParams.engravings || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          engravings: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="stones" className="flex items-center">
                      <Gem className="h-4 w-4 mr-1 text-primary" />
                      <span>Piedras</span>
                    </Label>
                    <Input
                      id="stones"
                      placeholder="Diamantes, rubíes, etc."
                      value={searchParams.stones || ""}
                      onChange={(e) =>
                        setSearchParams({
                          ...searchParams,
                          stones: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="price">Precio</Label>
                      <Input
                        id="price"
                        placeholder="Cantidad"
                        type="number"
                        value={searchParams.price || ""}
                        onChange={(e) =>
                          setSearchParams({
                            ...searchParams,
                            price: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="w-24">
                      <Label htmlFor="price-op">Operador</Label>
                      <Select
                        value={searchParams.priceOperator || "="}
                        onValueChange={(value) =>
                          setSearchParams({
                            ...searchParams,
                            priceOperator: value,
                          })
                        }
                      >
                        <SelectTrigger id="price-op">
                          <SelectValue placeholder="=" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">=</SelectItem>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value=">=">≥</SelectItem>
                          <SelectItem value="<=">≤</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="alerts-only"
                    checked={searchParams.onlyAlerts || false}
                    onCheckedChange={(checked) =>
                      setSearchParams({
                        ...searchParams,
                        onlyAlerts: checked as boolean,
                      })
                    }
                  />
                  <label
                    htmlFor="alerts-only"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1 text-orange-500" />
                    Solo mostrar compras con alertas
                  </label>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchParams({
                        query: "",
                        storeCode: "all",
                        customerName: "",
                        customerContact: "",
                        customerLocation: "", // Añadido: provincia/país del cliente
                        itemDetails: "",
                        metals: "",
                        engravings: "",
                        stones: "",
                      });
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar Filtros
                  </Button>
                  <Button 
                    onClick={handleSearch} 
                    disabled={searchMutation.isPending}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {searchMutation.isPending ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                <span className="ml-3 text-lg text-gray-600">Buscando registros...</span>
              </div>
            </CardContent>
          </Card>
        ) : searchMutation.data?.results ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resultados de la Búsqueda</CardTitle>
                <div className="text-sm text-gray-500">
                  {searchMutation.data.results.length}{" "}
                  {searchMutation.data.results.length === 1
                    ? "registro encontrado"
                    : "registros encontrados"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('storeCode')}
                        >
                          Tienda
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('orderDate')}
                        >
                          Fecha
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('orderNumber')}
                        >
                          Orden
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('customerName')}
                        >
                          Cliente
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('itemDetails')}
                        >
                          Objeto
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('engravings')}
                        >
                          Grabaciones
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={() => handleSort('price')}
                        >
                          Precio
                          <ChevronsUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSortedResults().map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {/* Indicador de alerta si existe */}
                          {record.hasAlerts && (
                            <div className="flex justify-center">
                              <AlertTriangle className="h-5 w-5 text-orange-500" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Button 
                            variant="link" 
                            className="p-0 h-auto font-medium hover:text-primary" 
                            onClick={() => handleShowStore(record.storeCode)}
                          >
                            {record.storeCode}
                          </Button>
                        </TableCell>
                        <TableCell>{formatDate(record.orderDate)}</TableCell>
                        <TableCell>{record.orderNumber}</TableCell>
                        <TableCell>{record.customerName}</TableCell>
                        <TableCell>{record.customerContact}</TableCell>
                        <TableCell>
                          {record.itemDetails.length > 30
                            ? `${record.itemDetails.substring(0, 30)}...`
                            : record.itemDetails}
                        </TableCell>
                        <TableCell>
                          {record.engravings || "—"}
                        </TableCell>
                        <TableCell>{record.price} €</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Detailed Record View */}
        {selectedRecord && (
          <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <SheetContent className="sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Detalles de la Compra</SheetTitle>
                <SheetDescription>
                  {selectedRecord.orderNumber} - {formatDate(selectedRecord.orderDate)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Tienda</Label>
                    <div className="flex items-center">
                      <StoreIcon className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">{selectedRecord.storeCode}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Fecha de Compra</Label>
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                      <span>{formatDate(selectedRecord.orderDate)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Cliente</Label>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">{selectedRecord.customerName}</span>
                    </div>
                    <div className="flex items-center ml-6">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{selectedRecord.customerContact}</span>
                    </div>
                    {selectedRecord.customerLocation && (
                      <div className="flex items-center ml-6">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{selectedRecord.customerLocation}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Objeto</Label>
                  <div className="space-y-1">
                    <div className="flex items-start">
                      <Package className="h-4 w-4 mr-2 mt-1 text-primary" />
                      <div>
                        <p className="font-medium">{selectedRecord.itemDetails}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-xs text-gray-500">Metales</p>
                            <p>{selectedRecord.metals || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Quilates</p>
                            <p>{selectedRecord.carats || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Grabados</p>
                            <p>{selectedRecord.engravings || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Piedras</p>
                            <p>{selectedRecord.stones || "—"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Precio</Label>
                    <p className="text-xl font-bold text-primary">{selectedRecord.price} €</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Papeleta de Empeño</Label>
                    <p>{selectedRecord.pawnTicket || "No"}</p>
                  </div>
                </div>

                {alerts.length > 0 && (
                  <>
                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                        <Label className="text-base font-medium">Alertas ({alerts.length})</Label>
                      </div>

                      <div className="bg-orange-50 border border-orange-100 rounded-md p-3 space-y-3">
                        {alerts.map(alert => (
                          <div key={alert.id} className="border-b border-orange-100 pb-2 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <Badge variant="outline" className="bg-orange-100 text-orange-800 mb-1">
                                  {alert.type === 'watchlist_item' ? 'Objeto' : 'Persona'}
                                </Badge>
                                <p className="text-sm font-medium">{alert.matchValue}</p>
                                <p className="text-xs text-gray-500">
                                  {alert.matchType === 'exact' ? 'Coincidencia exacta' : 'Coincidencia parcial'} • 
                                  {format(new Date(alert.alertDate), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={
                                  alert.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : alert.status === 'reviewed'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                }
                              >
                                {alert.status === 'pending' ? 'Pendiente' : 
                                 alert.status === 'reviewed' ? 'Revisada' : 'Escalada'}
                              </Badge>
                            </div>

                            {alert.reviewNotes && (
                              <div className="mt-1 text-xs bg-white p-1 rounded">
                                <span className="font-medium">Notas: </span>
                                {alert.reviewNotes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cerrar
                  </Button>

                  <div className="space-x-2">
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      
      {/* Diálogo de información de tienda */}
      <StoreInfoDialog 
        store={selectedStore} 
        open={storeInfoOpen} 
        onClose={() => setStoreInfoOpen(false)} 
      />
    </div>
  );
}