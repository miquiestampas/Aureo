import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { DataTable } from "@/components/ui/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { Row } from "@tanstack/react-table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, PlusCircle, AlertTriangle, Check, X, Edit, Trash2 } from "lucide-react";
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import MainLayout from "@/layouts/main-layout";

// Define el esquema para los señalamientos de personas
const personaSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  dni: z.string().min(5, "El DNI debe tener al menos 5 caracteres"),
  motivo: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
  createdBy: z.number().optional(),
});

// Define el esquema para los señalamientos de objetos
const objetoSchema = z.object({
  id: z.number().optional(),
  descripcion: z.string().min(5, "La descripción debe tener al menos 5 caracteres"),
  grabaciones: z.string().min(2, "Las grabaciones deben tener al menos 2 caracteres"),
  motivo: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
  createdBy: z.number().optional(),
});

type PersonaForm = z.infer<typeof personaSchema>;
type ObjetoForm = z.infer<typeof objetoSchema>;

// Interfaces para los datos recibidos del servidor
interface SenalPersona {
  id: number;
  nombre: string;
  dni: string;
  motivo: string;
  createdBy: number;
  createdAt: string;
  creatorName?: string;
}

interface SenalObjeto {
  id: number;
  descripcion: string;
  grabaciones: string;
  motivo: string;
  createdBy: number;
  createdAt: string;
  creatorName?: string;
}

export default function Senalamientos() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("personas");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [isObjetoDialogOpen, setIsObjetoDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<SenalPersona | null>(null);
  const [editingObjeto, setEditingObjeto] = useState<SenalObjeto | null>(null);
  const [deleteAlertPersona, setDeleteAlertPersona] = useState<SenalPersona | null>(null);
  const [deleteAlertObjeto, setDeleteAlertObjeto] = useState<SenalObjeto | null>(null);

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

  // Formulario para personas
  const personaForm = useForm<PersonaForm>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      nombre: "",
      dni: "",
      motivo: "",
    },
  });

  // Formulario para objetos
  const objetoForm = useForm<ObjetoForm>({
    resolver: zodResolver(objetoSchema),
    defaultValues: {
      descripcion: "",
      grabaciones: "",
      motivo: "",
    },
  });

  // Queries para obtener los datos
  const {
    data: personas,
    isLoading: loadingPersonas,
    isError: errorPersonas,
  } = useQuery<SenalPersona[]>({
    queryKey: ["/api/senalamiento/personas"],
    refetchOnWindowFocus: false,
  });

  const {
    data: objetos,
    isLoading: loadingObjetos,
    isError: errorObjetos,
  } = useQuery<SenalObjeto[]>({
    queryKey: ["/api/senalamiento/objetos"],
    refetchOnWindowFocus: false,
  });

  // Mutations para crear/editar personas
  const personaMutation = useMutation({
    mutationFn: async (data: PersonaForm) => {
      if (editingPersona) {
        const res = await apiRequest("PUT", `/api/senalamiento/personas/${editingPersona.id}`, data);
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/senalamiento/personas", data);
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/personas"] });
      toast({
        title: editingPersona ? "Señalamiento actualizado" : "Señalamiento creado",
        description: editingPersona
          ? "El señalamiento de persona ha sido actualizado exitosamente."
          : "El señalamiento de persona ha sido creado exitosamente.",
      });
      personaForm.reset();
      setIsPersonaDialogOpen(false);
      setEditingPersona(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al ${editingPersona ? "actualizar" : "crear"} el señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutations para crear/editar objetos
  const objetoMutation = useMutation({
    mutationFn: async (data: ObjetoForm) => {
      if (editingObjeto) {
        const res = await apiRequest("PUT", `/api/senalamiento/objetos/${editingObjeto.id}`, data);
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/senalamiento/objetos", data);
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/objetos"] });
      toast({
        title: editingObjeto ? "Señalamiento actualizado" : "Señalamiento creado",
        description: editingObjeto
          ? "El señalamiento de objeto ha sido actualizado exitosamente."
          : "El señalamiento de objeto ha sido creado exitosamente.",
      });
      objetoForm.reset();
      setIsObjetoDialogOpen(false);
      setEditingObjeto(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al ${editingObjeto ? "actualizar" : "crear"} el señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar personas
  const deletePersonaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/senalamiento/personas/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/personas"] });
      toast({
        title: "Señalamiento eliminado",
        description: "El señalamiento de persona ha sido eliminado exitosamente.",
      });
      setDeleteAlertPersona(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al eliminar el señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar objetos
  const deleteObjetoMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/senalamiento/objetos/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/senalamiento/objetos"] });
      toast({
        title: "Señalamiento eliminado",
        description: "El señalamiento de objeto ha sido eliminado exitosamente.",
      });
      setDeleteAlertObjeto(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Error al eliminar el señalamiento: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handler para enviar el formulario de personas
  const onSubmitPersona = (data: PersonaForm) => {
    personaMutation.mutate(data);
  };

  // Handler para enviar el formulario de objetos
  const onSubmitObjeto = (data: ObjetoForm) => {
    objetoMutation.mutate(data);
  };

  // Handler para abrir el diálogo de edición de persona
  const handleEditPersona = (persona: SenalPersona) => {
    setEditingPersona(persona);
    personaForm.reset({
      nombre: persona.nombre,
      dni: persona.dni,
      motivo: persona.motivo,
    });
    setIsPersonaDialogOpen(true);
  };

  // Handler para abrir el diálogo de edición de objeto
  const handleEditObjeto = (objeto: SenalObjeto) => {
    setEditingObjeto(objeto);
    objetoForm.reset({
      descripcion: objeto.descripcion,
      grabaciones: objeto.grabaciones,
      motivo: objeto.motivo,
    });
    setIsObjetoDialogOpen(true);
  };

  // Columnas para la tabla de personas
  const personasColumns = [
    {
      accessorKey: "nombre",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Nombre" />,
    },
    {
      accessorKey: "dni",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="DNI" />,
    },
    {
      accessorKey: "motivo",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Motivo" />,
      cell: ({ row }: { row: Row<SenalPersona> }) => (
        <div className="max-w-[200px] truncate" title={row.getValue("motivo")}>
          {row.getValue("motivo")}
        </div>
      ),
    },
    {
      accessorKey: "creatorName",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Creado Por" />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha de Creación" />,
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const date = new Date(row.getValue("createdAt"));
        return <span>{date.toLocaleDateString('es-ES')}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<SenalPersona> }) => {
        const persona = row.original;
        const canEdit = currentUser?.role === "SuperAdmin" || 
                        (currentUser?.role === "Admin" && currentUser?.id === persona.createdBy);
        
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => handleEditPersona(persona)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteAlertPersona(persona)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
                {!canEdit && (
                  <DropdownMenuItem disabled>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Sin permisos para editar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Columnas para la tabla de objetos
  const objetosColumns = [
    {
      accessorKey: "descripcion",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Descripción" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => (
        <div className="max-w-[200px] truncate" title={row.getValue("descripcion")}>
          {row.getValue("descripcion")}
        </div>
      ),
    },
    {
      accessorKey: "grabaciones",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Grabaciones" />,
    },
    {
      accessorKey: "motivo",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Motivo" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => (
        <div className="max-w-[200px] truncate" title={row.getValue("motivo")}>
          {row.getValue("motivo")}
        </div>
      ),
    },
    {
      accessorKey: "creatorName",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Creado Por" />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }: any) => <SortableColumnHeader column={column} title="Fecha de Creación" />,
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const date = new Date(row.getValue("createdAt"));
        return <span>{date.toLocaleDateString('es-ES')}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<SenalObjeto> }) => {
        const objeto = row.original;
        const canEdit = currentUser?.role === "SuperAdmin" || 
                        (currentUser?.role === "Admin" && currentUser?.id === objeto.createdBy);
        
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => handleEditObjeto(objeto)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteAlertObjeto(objeto)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
                {!canEdit && (
                  <DropdownMenuItem disabled>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Sin permisos para editar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Señalamientos</h1>
          <div className="flex gap-2">
            {(currentUser?.role === "SuperAdmin" || currentUser?.role === "Admin") && (
              <>
                <Button onClick={() => {
                  setEditingPersona(null);
                  personaForm.reset();
                  setIsPersonaDialogOpen(true);
                }} className="bg-indigo-700 hover:bg-indigo-800" disabled={activeTab !== "personas"}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo Señalamiento de Persona
                </Button>
                <Button onClick={() => {
                  setEditingObjeto(null);
                  objetoForm.reset();
                  setIsObjetoDialogOpen(true);
                }} className="bg-amber-600 hover:bg-amber-700" disabled={activeTab !== "objetos"}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo Señalamiento de Objeto
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground">
          Gestione y monitoree señalamientos de personas y objetos de interés para el sistema.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personas">Personas</TabsTrigger>
            <TabsTrigger value="objetos">Objetos</TabsTrigger>
          </TabsList>
          <TabsContent value="personas">
            <Card>
              <CardHeader>
                <CardTitle>Señalamientos de Personas</CardTitle>
                <CardDescription>
                  Lista de personas señaladas en el sistema por nombre o DNI.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPersonas ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : errorPersonas ? (
                  <div className="flex justify-center items-center h-64 text-destructive">
                    <AlertTriangle className="h-8 w-8 mr-2" />
                    Error al cargar datos. Intente nuevamente más tarde.
                  </div>
                ) : (
                  <DataTable
                    columns={personasColumns}
                    data={personas || []}
                    searchPlaceholder="Buscar por nombre o DNI..."
                    searchColumn="nombre"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="objetos">
            <Card>
              <CardHeader>
                <CardTitle>Señalamientos de Objetos</CardTitle>
                <CardDescription>
                  Lista de objetos señalados en el sistema por descripción o grabaciones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingObjetos ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : errorObjetos ? (
                  <div className="flex justify-center items-center h-64 text-destructive">
                    <AlertTriangle className="h-8 w-8 mr-2" />
                    Error al cargar datos. Intente nuevamente más tarde.
                  </div>
                ) : (
                  <DataTable
                    columns={objetosColumns}
                    data={objetos || []}
                    searchPlaceholder="Buscar por descripción..."
                    searchColumn="descripcion"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Diálogo para crear/editar personas */}
        <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingPersona ? "Editar Señalamiento de Persona" : "Nuevo Señalamiento de Persona"}
              </DialogTitle>
              <DialogDescription>
                Complete el formulario para {editingPersona ? "actualizar" : "crear"} un señalamiento de persona.
              </DialogDescription>
            </DialogHeader>
            <Form {...personaForm}>
              <form onSubmit={personaForm.handleSubmit(onSubmitPersona)} className="space-y-4">
                <FormField
                  control={personaForm.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personaForm.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de DNI" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personaForm.control}
                  name="motivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Motivo del señalamiento"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPersonaDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={personaMutation.isPending} className="bg-indigo-700 hover:bg-indigo-800">
                    {personaMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {editingPersona ? "Actualizar" : "Crear"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Diálogo para crear/editar objetos */}
        <Dialog open={isObjetoDialogOpen} onOpenChange={setIsObjetoDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingObjeto ? "Editar Señalamiento de Objeto" : "Nuevo Señalamiento de Objeto"}
              </DialogTitle>
              <DialogDescription>
                Complete el formulario para {editingObjeto ? "actualizar" : "crear"} un señalamiento de objeto.
              </DialogDescription>
            </DialogHeader>
            <Form {...objetoForm}>
              <form onSubmit={objetoForm.handleSubmit(onSubmitObjeto)} className="space-y-4">
                <FormField
                  control={objetoForm.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descripción detallada del objeto"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={objetoForm.control}
                  name="grabaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grabaciones</FormLabel>
                      <FormControl>
                        <Input placeholder="Grabaciones o marcas identificativas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={objetoForm.control}
                  name="motivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Motivo del señalamiento"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsObjetoDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={objetoMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
                    {objetoMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {editingObjeto ? "Actualizar" : "Crear"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Alert Dialog para confirmar eliminación de personas */}
        <AlertDialog open={!!deleteAlertPersona} onOpenChange={() => setDeleteAlertPersona(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro que desea eliminar este señalamiento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente el señalamiento de persona para{" "}
                <span className="font-semibold">{deleteAlertPersona?.nombre}</span>.
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (deleteAlertPersona) {
                    deletePersonaMutation.mutate(deleteAlertPersona.id);
                  }
                }}
                disabled={deletePersonaMutation.isPending}
              >
                {deletePersonaMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Alert Dialog para confirmar eliminación de objetos */}
        <AlertDialog open={!!deleteAlertObjeto} onOpenChange={() => setDeleteAlertObjeto(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro que desea eliminar este señalamiento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente el señalamiento de objeto con descripción{" "}
                <span className="font-semibold">{deleteAlertObjeto?.descripcion}</span>.
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (deleteAlertObjeto) {
                    deleteObjetoMutation.mutate(deleteAlertObjeto.id);
                  }
                }}
                disabled={deleteObjetoMutation.isPending}
              >
                {deleteObjetoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}