import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlusCircle,
  Store,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface StoreData {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
  // Nuevos campos añadidos
  address?: string;
  phone?: string;
  email?: string;
  cif?: string;
  businessName?: string;
  ownerName?: string;
  ownerIdNumber?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  notes?: string;
}

// Form schema for creating/editing a store
const storeFormSchema = z.object({
  code: z.string().min(2, "El código debe tener al menos 2 caracteres").max(20, "El código debe tener máximo 20 caracteres"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  type: z.enum(["Excel", "PDF"]),
  location: z.string().optional(),
  active: z.boolean().default(true),
  // Nuevos campos
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Formato de correo inválido").optional(),
  cif: z.string().optional(),
  businessName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerIdNumber: z.string().optional(),
  startDate: z.string().optional().or(z.date().optional()),
  endDate: z.string().optional().or(z.date().optional()),
  notes: z.string().optional(),
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

export default function StoreManagementPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);

  // Fetch all stores
  const { data: stores, refetch: refetchStores } = useQuery<StoreData[]>({
    queryKey: ['/api/stores'],
  });
  
  // Create store form
  const createForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "Excel",
      location: "",
      active: true,
      address: "",
      phone: "",
      email: "",
      cif: "",
      businessName: "",
      ownerName: "",
      ownerIdNumber: "",
      notes: "",
    },
  });
  
  // Edit store form
  const editForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "Excel",
      location: "",
      active: true,
      address: "",
      phone: "",
      email: "",
      cif: "",
      businessName: "",
      ownerName: "",
      ownerIdNumber: "",
      notes: "",
    },
  });
  
  // Set edit form values when a store is selected
  useEffect(() => {
    if (selectedStore && isEditDialogOpen) {
      editForm.reset({
        code: selectedStore.code,
        name: selectedStore.name,
        type: selectedStore.type as "Excel" | "PDF",
        location: selectedStore.location || "",
        active: selectedStore.active,
        address: selectedStore.address || "",
        phone: selectedStore.phone || "",
        email: selectedStore.email || "",
        cif: selectedStore.cif || "",
        businessName: selectedStore.businessName || "",
        ownerName: selectedStore.ownerName || "",
        ownerIdNumber: selectedStore.ownerIdNumber || "",
        startDate: selectedStore.startDate ? selectedStore.startDate : "",
        endDate: selectedStore.endDate ? selectedStore.endDate : "",
        notes: selectedStore.notes || "",
      });
    }
  }, [selectedStore, isEditDialogOpen, editForm]);
  
  // Create store mutation
  const createMutation = useMutation({
    mutationFn: async (data: StoreFormValues) => {
      const response = await apiRequest("POST", "/api/stores", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tienda creada",
        description: "La tienda ha sido creada correctamente.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear tienda",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update store mutation
  const updateMutation = useMutation({
    mutationFn: async (data: StoreFormValues & { id: number }) => {
      const { id, ...storeData } = data;
      const response = await apiRequest("PUT", `/api/stores/${id}`, storeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tienda actualizada",
        description: "La tienda ha sido actualizada correctamente.",
      });
      setIsEditDialogOpen(false);
      setSelectedStore(null);
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar tienda",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete store mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stores/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Tienda eliminada",
        description: "La tienda ha sido eliminada correctamente.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedStore(null);
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar tienda",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle create form submission
  const onCreateSubmit = (data: StoreFormValues) => {
    createMutation.mutate(data);
  };
  
  // Handle edit form submission
  const onEditSubmit = (data: StoreFormValues) => {
    if (!selectedStore) return;
    
    updateMutation.mutate({
      id: selectedStore.id,
      ...data,
    });
  };
  
  // Handle delete confirmation
  const confirmDelete = () => {
    if (!selectedStore) return;
    deleteMutation.mutate(selectedStore.id);
  };
  
  // Open edit dialog for a store
  const handleEditStore = (store: StoreData) => {
    setSelectedStore(store);
    setIsEditDialogOpen(true);
  };
  
  // Open delete dialog for a store
  const handleDeleteStore = (store: StoreData) => {
    setSelectedStore(store);
    setIsDeleteDialogOpen(true);
  };
  
  // Open detail dialog for a store
  const handleViewStoreDetails = (store: StoreData) => {
    setSelectedStore(store);
    setIsDetailDialogOpen(true);
  };
  
  // Check if user can edit/delete (only SuperAdmin and Admin)
  const canModify = user?.role === "SuperAdmin" || user?.role === "Admin";
  
  // Data table columns
  const columns: ColumnDef<StoreData>[] = [
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nombre",
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <div className="flex items-center">
            {type === "Excel" ? (
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-red-500" />
            )}
            {type}
          </div>
        );
      }
    },
    {
      accessorKey: "location",
      header: "Ubicación",
      cell: ({ row }) => {
        return row.original.location || "—";
      }
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => {
        const isActive = row.original.active;
        return isActive ? (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" /> Activa
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" /> Inactiva
          </Badge>
        );
      }
    },
    ...(canModify ? [
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const store = row.original;
          return (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600" 
                onClick={() => handleViewStoreDetails(store)}
              >
                <Info className="h-4 w-4" />
                <span className="sr-only">Ver Detalles</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => handleEditStore(store)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Editar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600" 
                onClick={() => handleDeleteStore(store)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Eliminar</span>
              </Button>
            </div>
          );
        }
      }
    ] : []),
  ];
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Gestión de Tiendas</h1>
            <p className="text-gray-500 mt-1">Administre sus tiendas de Excel y PDF</p>
          </div>
          
          {canModify && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Nueva Tienda
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nueva Tienda</DialogTitle>
                  <DialogDescription>
                    Añadir una nueva tienda al sistema.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={createForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código de Tienda</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: ST001" {...field} />
                          </FormControl>
                          <FormDescription>
                            Un identificador único para la tienda
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de Tienda</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Tienda Principal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Tienda</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione tipo de tienda" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Excel">Tienda Excel</SelectItem>
                              <SelectItem value="PDF">Tienda PDF</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Determina cómo se procesan los datos de la tienda
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="district"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distrito</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Madrid Centro" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="locality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Localidad</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Chamberí" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={createForm.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Estado Activo</FormLabel>
                            <FormDescription>
                              Las tiendas activas procesarán nuevos archivos
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Nuevos campos - Información adicional */}
                    <div className="border rounded-md p-4 mt-6">
                      <h3 className="font-medium mb-3">Información Adicional</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={createForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Calle Principal 123" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: 912 345 678" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={createForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Correo Electrónico</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: tienda@ejemplo.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createForm.control}
                          name="cif"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CIF</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: B12345678" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={createForm.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Razón Social</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Empresa S.L." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createForm.control}
                          name="ownerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre del Propietario</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Juan Pérez" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={createForm.control}
                          name="ownerIdNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DNI del Propietario</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: 12345678A" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha de Inicio de Actividad</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={createForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha de Cese (si es inactiva)</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="mt-4">
                        <FormField
                          control={createForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Anotaciones</FormLabel>
                              <FormControl>
                                <textarea 
                                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                                  placeholder="Información adicional relevante..."
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Creando..." : "Crear Tienda"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {/* Stores Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Store className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>Todas las Tiendas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stores?.length ? (
              <DataTable
                columns={columns}
                data={stores}
                searchKey="name"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Store className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No se encontraron tiendas</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cree una nueva tienda para comenzar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Edit Store Dialog */}
        {selectedStore && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Tienda</DialogTitle>
                <DialogDescription>
                  Actualizar la información de la tienda.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={editForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Tienda</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: ST001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Tienda</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Tienda Principal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Tienda</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione tipo de tienda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Excel">Tienda Excel</SelectItem>
                            <SelectItem value="PDF">Tienda PDF</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distrito</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Madrid Centro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="locality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localidad</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Chamberí" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Estado Activo</FormLabel>
                          <FormDescription>
                            Las tiendas activas procesarán nuevos archivos
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Nuevos campos - Información adicional */}
                  <div className="border rounded-md p-4 mt-6">
                    <h3 className="font-medium mb-3">Información Adicional</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dirección</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Calle Principal 123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: 912 345 678" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={editForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: tienda@ejemplo.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="cif"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CIF</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: B12345678" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={editForm.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Razón Social</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Empresa S.L." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="ownerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Propietario</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Juan Pérez" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={editForm.control}
                        name="ownerIdNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DNI del Propietario</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: 12345678A" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de Inicio de Actividad</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={editForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de Cese (si es inactiva)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="mt-4">
                      <FormField
                        control={editForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Anotaciones</FormLabel>
                            <FormControl>
                              <textarea 
                                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                                placeholder="Información adicional relevante..."
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit"
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Actualizando..." : "Actualizar Tienda"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente la tienda "{selectedStore?.name}". 
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Store Details Dialog */}
        {selectedStore && (
          <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center">
                  <Store className="h-5 w-5 mr-2 text-primary" />
                  Detalles de Tienda: {selectedStore.name}
                </DialogTitle>
                <DialogDescription>
                  Información completa de la tienda
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-3 border-b pb-2">Información Básica</h3>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Código:</span> 
                        <span className="ml-2">{selectedStore.code}</span>
                      </div>
                      <div>
                        <span className="font-medium">Nombre:</span> 
                        <span className="ml-2">{selectedStore.name}</span>
                      </div>
                      <div>
                        <span className="font-medium">Tipo:</span> 
                        <span className="ml-2 flex items-center">
                          {selectedStore.type === "Excel" ? (
                            <><FileSpreadsheet className="h-4 w-4 mr-1 text-green-500" /> Excel</>
                          ) : (
                            <><FileText className="h-4 w-4 mr-1 text-red-500" /> PDF</>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Ubicación:</span> 
                        <span className="ml-2">{selectedStore.location || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">Estado:</span> 
                        <span className="ml-2">
                          {selectedStore.active ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" /> Activa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3 mr-1" /> Inactiva
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-3 border-b pb-2">Fechas</h3>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Fecha de inicio:</span> 
                        <span className="ml-2">
                          {selectedStore.startDate 
                            ? new Date(selectedStore.startDate).toLocaleDateString() 
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Fecha de cese:</span> 
                        <span className="ml-2">
                          {selectedStore.endDate 
                            ? new Date(selectedStore.endDate).toLocaleDateString() 
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-3 border-b pb-2">Información de Contacto</h3>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Dirección:</span> 
                        <span className="ml-2">{selectedStore.address || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">Teléfono:</span> 
                        <span className="ml-2">{selectedStore.phone || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">Email:</span> 
                        <span className="ml-2">{selectedStore.email || "—"}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-3 border-b pb-2">Información Comercial</h3>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">CIF:</span> 
                        <span className="ml-2">{selectedStore.cif || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">Razón Social:</span> 
                        <span className="ml-2">{selectedStore.businessName || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">Propietario:</span> 
                        <span className="ml-2">{selectedStore.ownerName || "—"}</span>
                      </div>
                      <div>
                        <span className="font-medium">DNI del Propietario:</span> 
                        <span className="ml-2">{selectedStore.ownerIdNumber || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedStore.notes && (
                <div className="mt-4 border rounded-md p-4">
                  <h3 className="font-medium mb-3 border-b pb-2">Anotaciones</h3>
                  <p className="whitespace-pre-line">{selectedStore.notes}</p>
                </div>
              )}
              
              <DialogFooter className="mt-6">
                <Button onClick={() => setIsDetailDialogOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
      </div>
    </div>
  );
}
