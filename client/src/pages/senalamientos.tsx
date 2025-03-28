import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Edit,
  Trash2,
  Plus,
  Search,
  User,
  Package,
  Shield,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Label } from "@/components/ui/label";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import MainLayout from "@/layouts/main-layout";

// Definición de tipos para las señales
interface SenalPersona {
  id: number;
  nombre: string;
  documentoId: string | null;
  notas: string | null;
  fecha: string | null;
  estado: "Activo" | "Inactivo";
  creadoPor: number;
  creadoEn: string;
  modificadoPor: number | null;
  modificadoEn: string | null;
}

interface SenalObjeto {
  id: number;
  descripcion: string;
  grabacion: string | null;
  notas: string | null;
  fecha: string | null;
  estado: "Activo" | "Inactivo";
  creadoPor: number;
  creadoEn: string;
  modificadoPor: number | null;
  modificadoEn: string | null;
}

// Schemas para validación de formularios
const personaSchema = z.object({
  nombre: z.union([
    z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    z.literal("")
  ]).optional(),
  documentoId: z.union([
    z.string().min(3, "El documento debe tener al menos 3 caracteres"),
    z.literal("")
  ]).optional(),
  notas: z.string().nullable().optional(),
  fecha: z.date().optional().nullable(),
  estado: z.enum(["Activo", "Inactivo"])
});

const objetoSchema = z.object({
  descripcion: z.union([
    z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
    z.literal("")
  ]),
  grabacion: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  fecha: z.date().optional().nullable(),
  estado: z.enum(["Activo", "Inactivo"])
});

type PersonaFormValues = z.infer<typeof personaSchema>;
type ObjetoFormValues = z.infer<typeof objetoSchema>;

export default function Senalamientos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"personas" | "objetos">("personas");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [isObjetoDialogOpen, setIsObjetoDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<SenalPersona | null>(null);
  const [editingObjeto, setEditingObjeto] = useState<SenalObjeto | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean, type: "persona" | "objeto", id: number | null }>({
    open: false,
    type: "persona",
    id: null
  });
  
  // Formulario para personas
  const personaForm = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      nombre: "",
      documentoId: "",
      notas: "",
      fecha: new Date(),
      estado: "Activo"
    }
  });
  
  // Formulario para objetos
  const objetoForm = useForm<ObjetoFormValues>({
    resolver: zodResolver(objetoSchema),
    defaultValues: {
      descripcion: "",
      grabacion: "",
      notas: "",
      fecha: new Date(),
      estado: "Activo"
    }
  });
  
  // Cargar datos de señalamientos de personas
  const { 
    data: personas = [], 
    isLoading: isLoadingPersonas,
    isError: isErrorPersonas
  } = useQuery<SenalPersona[]>({
    queryKey: ["/api/senalamiento/personas"],
  });
  
  // Cargar datos de señalamientos de objetos
  const { 
    data: objetos = [], 
    isLoading: isLoadingObjetos,
    isError: isErrorObjetos
  } = useQuery<SenalObjeto[]>({
    queryKey: ["/api/senalamiento/objetos"],
  });
  
  // Mutación para crear persona
  const createPersonaMutation = useMutation({
    mutationFn: async (data: PersonaFormValues) => {
      // Convertir fecha a formato ISO string si existe
      const formattedData = {
        ...data,
        fecha: data.fecha ? data.fecha.toISOString() : null
      };
      
      const response = await fetch("/api/senalamiento/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });
      
      if (!response.ok) {
        throw new Error("Error al crear señalamiento de persona");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento creado",
        description: "El señalamiento de persona ha sido creado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/personas"] });
      personaForm.reset();
      setIsPersonaDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al crear señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para actualizar persona
  const updatePersonaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: PersonaFormValues }) => {
      // Convertir fecha a formato ISO string si existe
      const formattedData = {
        ...data,
        fecha: data.fecha ? data.fecha.toISOString() : null
      };
      
      const response = await fetch(`/api/senalamiento/personas/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar señalamiento de persona");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento actualizado",
        description: "El señalamiento de persona ha sido actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/personas"] });
      personaForm.reset();
      setEditingPersona(null);
      setIsPersonaDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al actualizar señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para eliminar persona
  const deletePersonaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/senalamiento/personas/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Error al eliminar señalamiento de persona");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento eliminado",
        description: "El señalamiento de persona ha sido eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/personas"] });
      setDeleteConfirmDialog({ open: false, type: "persona", id: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para crear objeto
  const createObjetoMutation = useMutation({
    mutationFn: async (data: ObjetoFormValues) => {
      // Convertir fecha a formato ISO string si existe
      const formattedData = {
        ...data,
        fecha: data.fecha ? data.fecha.toISOString() : null
      };
      
      const response = await fetch("/api/senalamiento/objetos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });
      
      if (!response.ok) {
        throw new Error("Error al crear señalamiento de objeto");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento creado",
        description: "El señalamiento de objeto ha sido creado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/objetos"] });
      objetoForm.reset();
      setIsObjetoDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al crear señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para actualizar objeto
  const updateObjetoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: ObjetoFormValues }) => {
      // Convertir fecha a formato ISO string si existe
      const formattedData = {
        ...data,
        fecha: data.fecha ? data.fecha.toISOString() : null
      };
      
      const response = await fetch(`/api/senalamiento/objetos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar señalamiento de objeto");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento actualizado",
        description: "El señalamiento de objeto ha sido actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/objetos"] });
      objetoForm.reset();
      setEditingObjeto(null);
      setIsObjetoDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al actualizar señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para eliminar objeto
  const deleteObjetoMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/senalamiento/objetos/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Error al eliminar señalamiento de objeto");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Señalamiento eliminado",
        description: "El señalamiento de objeto ha sido eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/objetos"] });
      setDeleteConfirmDialog({ open: false, type: "objeto", id: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Manejar envío del formulario de persona
  const handlePersonaSubmit = async (data: PersonaFormValues) => {
    if (editingPersona) {
      updatePersonaMutation.mutate({ id: editingPersona.id, data });
    } else {
      createPersonaMutation.mutate(data);
    }
  };
  
  // Manejar envío del formulario de objeto
  const handleObjetoSubmit = async (data: ObjetoFormValues) => {
    if (editingObjeto) {
      updateObjetoMutation.mutate({ id: editingObjeto.id, data });
    } else {
      createObjetoMutation.mutate(data);
    }
  };
  
  // Abrir diálogo de edición para persona
  const handleEditPersona = (persona: SenalPersona) => {
    personaForm.reset({
      nombre: persona.nombre || undefined,
      documentoId: persona.documentoId || undefined,
      notas: persona.notas || undefined,
      fecha: persona.fecha ? new Date(persona.fecha) : new Date(),
      estado: persona.estado
    });
    setEditingPersona(persona);
    setIsPersonaDialogOpen(true);
  };
  
  // Abrir diálogo de edición para objeto
  const handleEditObjeto = (objeto: SenalObjeto) => {
    objetoForm.reset({
      descripcion: objeto.descripcion,
      grabacion: objeto.grabacion || undefined,
      notas: objeto.notas || undefined,
      fecha: objeto.fecha ? new Date(objeto.fecha) : new Date(),
      estado: objeto.estado
    });
    setEditingObjeto(objeto);
    setIsObjetoDialogOpen(true);
  };
  
  // Verificar si el usuario puede editar/eliminar (solo el creador o SuperAdmin)
  const canEditDelete = (createdById: number) => {
    return user?.role === "SuperAdmin" || (user?.role === "Admin" && createdById === user?.id);
  };
  
  // Columnas para tabla de personas
  const personasColumns = [
    {
      accessorKey: "nombre",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Nombre" />,
    },
    {
      accessorKey: "documentoId",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Documento" />,
    },
    {
      accessorKey: "estado",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Estado" />,
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const estado = row.getValue("estado") as string;
        return (
          <Badge variant={estado === "Activo" ? "default" : "secondary"}>
            {estado}
          </Badge>
        );
      },
    },
    {
      accessorKey: "fecha",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha registro" />,
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const fechaStr = row.getValue("fecha") as string;
        if (!fechaStr) return "N/A";
        try {
          const fecha = new Date(fechaStr);
          if (isNaN(fecha.getTime())) return "Fecha inválida";
          return format(fecha, "dd/MM/yyyy", { locale: es });
        } catch (error) {
          console.error("Error al formatear fecha:", error);
          return "Error de formato";
        }
      },
    },
    {
      accessorKey: "creadoEn",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha creación" />,
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const fechaStr = row.getValue("creadoEn") as string;
        if (!fechaStr) return "N/A";
        try {
          const fecha = new Date(fechaStr);
          if (isNaN(fecha.getTime())) return "Fecha inválida";
          return format(fecha, "dd/MM/yyyy", { locale: es });
        } catch (error) {
          console.error("Error al formatear fecha:", error);
          return "Error de formato";
        }
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const persona = row.original;
        
        if (!canEditDelete(persona.creadoPor)) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled>
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solo el creador o SuperAdmin pueden editar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        return (
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => handleEditPersona(persona)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setDeleteConfirmDialog({ open: true, type: "persona", id: persona.id })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
  
  // Columnas para tabla de objetos
  const objetosColumns = [
    {
      accessorKey: "descripcion",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Descripción" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const desc = row.getValue("descripcion") as string;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[300px] truncate">{desc}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[400px]">{desc}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "grabacion",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Grabación" />,
    },
    {
      accessorKey: "estado",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Estado" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const estado = row.getValue("estado") as string;
        return (
          <Badge variant={estado === "Activo" ? "default" : "secondary"}>
            {estado}
          </Badge>
        );
      },
    },
    {
      accessorKey: "fecha",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha registro" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const fechaStr = row.getValue("fecha") as string;
        if (!fechaStr) return "N/A";
        try {
          const fecha = new Date(fechaStr);
          if (isNaN(fecha.getTime())) return "Fecha inválida";
          return format(fecha, "dd/MM/yyyy", { locale: es });
        } catch (error) {
          console.error("Error al formatear fecha:", error);
          return "Error de formato";
        }
      },
    },
    {
      accessorKey: "creadoEn",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha creación" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const fechaStr = row.getValue("creadoEn") as string;
        if (!fechaStr) return "N/A";
        try {
          const fecha = new Date(fechaStr);
          if (isNaN(fecha.getTime())) return "Fecha inválida";
          return format(fecha, "dd/MM/yyyy", { locale: es });
        } catch (error) {
          console.error("Error al formatear fecha:", error);
          return "Error de formato";
        }
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const objeto = row.original;
        
        if (!canEditDelete(objeto.creadoPor)) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled>
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solo el creador o SuperAdmin pueden editar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        return (
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => handleEditObjeto(objeto)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setDeleteConfirmDialog({ open: true, type: "objeto", id: objeto.id })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];
  
  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Señalamientos</h2>
            <p className="text-muted-foreground">
              Gestione las personas y objetos que deben ser vigilados en los registros de compras
            </p>
          </div>
          
          {(user?.role === "SuperAdmin" || user?.role === "Admin") && (
            <div className="flex space-x-2">
              <Button 
                onClick={() => { 
                  setActiveTab("personas");
                  setEditingPersona(null);
                  personaForm.reset();
                  setIsPersonaDialogOpen(true);
                }}
              >
                <User className="mr-2 h-4 w-4" />
                Añadir Persona
              </Button>
              <Button 
                onClick={() => { 
                  setActiveTab("objetos");
                  setEditingObjeto(null);
                  objetoForm.reset();
                  setIsObjetoDialogOpen(true);
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                Añadir Objeto
              </Button>
            </div>
          )}
        </div>
        
        <Tabs 
          defaultValue="personas" 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as "personas" | "objetos")}
        >
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="personas">
              <User className="mr-2 h-4 w-4" />
              Personas ({personas.length})
            </TabsTrigger>
            <TabsTrigger value="objetos">
              <Package className="mr-2 h-4 w-4" />
              Objetos ({objetos.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="personas" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Señalamientos de Personas</CardTitle>
                <CardDescription>
                  Lista de personas que deben ser monitoreadas en las compras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable 
                  columns={personasColumns}
                  data={personas}
                  searchColumn="nombre"
                  searchPlaceholder="Buscar por nombre..."
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="objetos" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Señalamientos de Objetos</CardTitle>
                <CardDescription>
                  Lista de objetos que deben ser monitoreados en las compras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable 
                  columns={objetosColumns}
                  data={objetos}
                  searchColumn="descripcion"
                  searchPlaceholder="Buscar por descripción..."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Diálogo para añadir/editar persona */}
        <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingPersona ? "Editar persona" : "Añadir nueva persona"}
              </DialogTitle>
              <DialogDescription>
                {editingPersona 
                  ? "Actualice los datos de la persona señalada" 
                  : "Introduzca los datos de la persona a señalar"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...personaForm}>
              <form onSubmit={personaForm.handleSubmit(handlePersonaSubmit)} className="space-y-4">
                <FormField
                  control={personaForm.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de la persona" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personaForm.control}
                  name="documentoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Documento de identidad</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="DNI, NIE u otro documento" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormDescription>
                        Debe proporcionar al menos nombre o documento de identidad
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personaForm.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: es })
                              ) : (
                                <span>Seleccione una fecha</span>
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
                        Fecha de registro (por defecto: hoy)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                
                <FormField
                  control={personaForm.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Activo">Activo</SelectItem>
                          <SelectItem value="Inactivo">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={personaForm.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notas adicionales" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit">
                    {editingPersona ? "Actualizar" : "Añadir"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Diálogo para añadir/editar objeto */}
        <Dialog open={isObjetoDialogOpen} onOpenChange={setIsObjetoDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingObjeto ? "Editar objeto" : "Añadir nuevo objeto"}
              </DialogTitle>
              <DialogDescription>
                {editingObjeto 
                  ? "Actualice los datos del objeto señalado" 
                  : "Introduzca los datos del objeto a señalar"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...objetoForm}>
              <form onSubmit={objetoForm.handleSubmit(handleObjetoSubmit)} className="space-y-4">
                <FormField
                  control={objetoForm.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción detallada del objeto" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={objetoForm.control}
                  name="grabacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grabación</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Texto de grabación o marca" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormDescription>
                        Texto que pueda estar grabado o marcado en el objeto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={objetoForm.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: es })
                              ) : (
                                <span>Seleccione una fecha</span>
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
                        Fecha de registro (por defecto: hoy)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                
                <FormField
                  control={objetoForm.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Activo">Activo</SelectItem>
                          <SelectItem value="Inactivo">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={objetoForm.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notas adicionales" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit">
                    {editingObjeto ? "Actualizar" : "Añadir"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Diálogo de confirmación para eliminar */}
        <Dialog 
          open={deleteConfirmDialog.open} 
          onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar este señalamiento? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirmDialog({ open: false, type: "persona", id: null })}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmDialog.id === null) return;
                  
                  if (deleteConfirmDialog.type === "persona") {
                    deletePersonaMutation.mutate(deleteConfirmDialog.id);
                  } else {
                    deleteObjetoMutation.mutate(deleteConfirmDialog.id);
                  }
                }}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}