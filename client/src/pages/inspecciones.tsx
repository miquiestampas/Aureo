import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, 
  Plus, 
  FileText, 
  Download, 
  Trash, 
  PenSquare, 
  Calendar, 
  Store, 
  Shield, 
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Definición de tipos
interface Inspeccion {
  id: number;
  storeCode: string;
  estado: string;
  fechaInspeccion: string;
  inspectores: string;
  resultado: string;
  observaciones: string | null;
  creadoPor: number;
  creadoEn: string;
  modificadoPor: number | null;
  modificadoEn: string | null;
  storeName?: string;
}

interface DocumentoInspeccion {
  id: number;
  inspeccionId: number;
  tipoDocumento: string;
  titulo: string;
  descripcion: string | null;
  ruta: string;
  fechaSubida: string;
  tamanoArchivo: number | null;
  formatoArchivo: string;
  creadoPor: number;
}

interface Store {
  id: number;
  name: string;
  code: string;
}

// Esquema de validación para nueva inspección
const inspeccionSchema = z.object({
  storeCode: z.string().min(1, { message: "La tienda es requerida" }),
  fechaInspeccion: z.string().min(1, { message: "La fecha es requerida" }),
  inspectores: z.string().min(1, { message: "Los inspectores son requeridos" }),
  resultado: z.string().min(1, { message: "El resultado es requerido" }),
  observaciones: z.string().nullable().optional(),
  estado: z.string().min(1, { message: "El estado es requerido" }),
});

const formDocumentoSchema = z.object({
  tipoDocumento: z.string().min(1, { message: "El tipo de documento es requerido" }),
  titulo: z.string().min(1, { message: "El título es requerido" }),
  descripcion: z.string().nullable().optional(),
});

// Componente principal
export default function Inspecciones() {
  const [selectedTab, setSelectedTab] = useState("listado");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [selectedInspeccion, setSelectedInspeccion] = useState<Inspeccion | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInspecciones, setFilteredInspecciones] = useState<Inspeccion[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consultas
  const { data: inspecciones = [], isLoading } = useQuery({
    queryKey: ['/api/inspecciones'],
    queryFn: () => apiRequest<Inspeccion[]>('/api/inspecciones'),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: () => apiRequest<Store[]>('/api/stores'),
  });

  const { data: documentos = [], isLoading: loadingDocumentos } = useQuery({
    queryKey: ['/api/documentos-inspeccion', selectedInspeccion?.id],
    queryFn: () => selectedInspeccion ? apiRequest<DocumentoInspeccion[]>(`/api/documentos-inspeccion/${selectedInspeccion.id}`) : Promise.resolve([]),
    enabled: !!selectedInspeccion,
  });

  // Efecto para filtrar inspecciones
  useEffect(() => {
    if (inspecciones) {
      if (!searchQuery) {
        setFilteredInspecciones(inspecciones);
      } else {
        const normalized = searchQuery.toLowerCase();
        setFilteredInspecciones(
          inspecciones.filter(
            (insp) =>
              insp.storeCode.toLowerCase().includes(normalized) ||
              (insp.storeName && insp.storeName.toLowerCase().includes(normalized)) ||
              insp.inspectores.toLowerCase().includes(normalized) ||
              insp.resultado.toLowerCase().includes(normalized) ||
              insp.estado.toLowerCase().includes(normalized)
          )
        );
      }
    }
  }, [searchQuery, inspecciones]);

  // Mutaciones
  const createInspeccionMutation = useMutation({
    mutationFn: (data: z.infer<typeof inspeccionSchema>) => 
      apiRequest('POST', '/api/inspecciones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspecciones'] });
      toast({
        title: "Inspección creada",
        description: "La inspección ha sido creada correctamente",
      });
      setIsNewDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al crear la inspección: ${error}`,
        variant: "destructive",
      });
    },
  });

  const updateInspeccionMutation = useMutation({
    mutationFn: (data: z.infer<typeof inspeccionSchema> & { id: number }) => 
      apiRequest('PUT', `/api/inspecciones/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspecciones'] });
      toast({
        title: "Inspección actualizada",
        description: "La inspección ha sido actualizada correctamente",
      });
      setIsEditDialogOpen(false);
      setSelectedInspeccion(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al actualizar la inspección: ${error}`,
        variant: "destructive",
      });
    },
  });

  const uploadDocumentoMutation = useMutation({
    mutationFn: async (data: { formData: FormData, inspeccionId: number }) => {
      const { formData, inspeccionId } = data;
      return apiRequest('POST', `/api/documentos-inspeccion/${inspeccionId}`, formData, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documentos-inspeccion', selectedInspeccion?.id] });
      setIsDocumentDialogOpen(false);
      setSelectedFile(null);
      toast({
        title: "Documento subido",
        description: "El documento ha sido subido correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al subir el documento: ${error}`,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentoMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/documentos-inspeccion/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documentos-inspeccion', selectedInspeccion?.id] });
      toast({
        title: "Documento eliminado",
        description: "El documento ha sido eliminado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Error al eliminar el documento: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Formularios
  const newForm = useForm<z.infer<typeof inspeccionSchema>>({
    resolver: zodResolver(inspeccionSchema),
    defaultValues: {
      storeCode: "",
      fechaInspeccion: new Date().toISOString().split('T')[0],
      inspectores: "",
      resultado: "Satisfactorio",
      observaciones: "",
      estado: "Finalizada",
    },
  });

  const editForm = useForm<z.infer<typeof inspeccionSchema>>({
    resolver: zodResolver(inspeccionSchema),
    defaultValues: {
      storeCode: selectedInspeccion?.storeCode || "",
      fechaInspeccion: selectedInspeccion?.fechaInspeccion ? selectedInspeccion.fechaInspeccion.split('T')[0] : "",
      inspectores: selectedInspeccion?.inspectores || "",
      resultado: selectedInspeccion?.resultado || "",
      observaciones: selectedInspeccion?.observaciones || "",
      estado: selectedInspeccion?.estado || "",
    },
  });

  const documentForm = useForm<z.infer<typeof formDocumentoSchema>>({
    resolver: zodResolver(formDocumentoSchema),
    defaultValues: {
      tipoDocumento: "Acta",
      titulo: "",
      descripcion: "",
    },
  });

  // Reset del formulario de edición cuando cambia la inspección seleccionada
  useEffect(() => {
    if (selectedInspeccion) {
      editForm.reset({
        storeCode: selectedInspeccion.storeCode,
        fechaInspeccion: selectedInspeccion.fechaInspeccion.split('T')[0],
        inspectores: selectedInspeccion.inspectores,
        resultado: selectedInspeccion.resultado,
        observaciones: selectedInspeccion.observaciones,
        estado: selectedInspeccion.estado,
      });
    }
  }, [selectedInspeccion, editForm]);

  // Funciones auxiliares
  const getStoreName = (code: string) => {
    const store = stores.find(s => s.code === code);
    return store ? store.name : code;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validación de tamaño (max 15MB)
      if (file.size > 15 * 1024 * 1024) {
        setFileError("El archivo no debe superar los 15MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDocumentSubmit = async (data: z.infer<typeof formDocumentoSchema>) => {
    if (!selectedFile) {
      setFileError("Debe seleccionar un archivo");
      return;
    }

    if (!selectedInspeccion) {
      toast({
        title: "Error",
        description: "No hay una inspección seleccionada",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("documento", selectedFile);
    formData.append("tipoDocumento", data.tipoDocumento);
    formData.append("titulo", data.titulo);
    formData.append("descripcion", data.descripcion || "");

    uploadDocumentoMutation.mutate({ formData, inspeccionId: selectedInspeccion.id });
  };

  const handleDownloadDocument = (documento: DocumentoInspeccion) => {
    window.open(`/api/documentos-inspeccion/${documento.id}/download`, '_blank');
  };

  // Renderizado
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Gestión de Inspecciones</h1>

      <Tabs defaultValue="listado" value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="listado">Listado de Inspecciones</TabsTrigger>
          {selectedInspeccion && (
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="listado">
          <Card>
            <CardHeader>
              <CardTitle>Inspecciones</CardTitle>
              <CardDescription>
                Gestiona las inspecciones físicas de tiendas
              </CardDescription>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar inspecciones..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setIsNewDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Inspección
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Inspectores</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInspecciones.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No se encontraron inspecciones
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInspecciones.map((inspeccion) => (
                        <TableRow key={inspeccion.id}>
                          <TableCell>{inspeccion.id}</TableCell>
                          <TableCell>
                            <div className="font-medium">{getStoreName(inspeccion.storeCode)}</div>
                            <div className="text-xs text-gray-500">{inspeccion.storeCode}</div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(inspeccion.fechaInspeccion), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>{inspeccion.inspectores}</TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              inspeccion.resultado === 'Satisfactorio' 
                                ? 'bg-green-100 text-green-800' 
                                : inspeccion.resultado === 'Con incidencias' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {inspeccion.resultado}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              inspeccion.estado === 'Finalizada' 
                                ? 'bg-blue-100 text-blue-800' 
                                : inspeccion.estado === 'En proceso' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {inspeccion.estado}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedInspeccion(inspeccion);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <PenSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedInspeccion(inspeccion);
                                  setSelectedTab("documentos");
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {selectedInspeccion && (
          <TabsContent value="documentos">
            <Card>
              <CardHeader>
                <CardTitle>Documentos de Inspección</CardTitle>
                <CardDescription>
                  Gestiona los documentos asociados a la inspección #{selectedInspeccion.id} de{" "}
                  {getStoreName(selectedInspeccion.storeCode)}
                </CardDescription>
                
                <div className="flex justify-between items-center mt-4">
                  <div className="flex space-x-2 items-center">
                    <Button variant="outline" onClick={() => setSelectedTab("listado")}>
                      Volver al listado
                    </Button>
                  </div>
                  <Button onClick={() => setIsDocumentDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Documento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 border rounded-md flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Fecha de inspección</p>
                      <p className="text-sm">
                        {format(parseISO(selectedInspeccion.fechaInspeccion), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 border rounded-md flex items-center space-x-3">
                    <Store className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Tienda</p>
                      <p className="text-sm">{getStoreName(selectedInspeccion.storeCode)}</p>
                    </div>
                  </div>
                  <div className="p-4 border rounded-md flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Resultado</p>
                      <p className="text-sm">{selectedInspeccion.resultado}</p>
                    </div>
                  </div>
                </div>

                {selectedInspeccion.observaciones && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-md">
                    <h3 className="font-medium mb-2 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Observaciones
                    </h3>
                    <p className="text-sm">{selectedInspeccion.observaciones}</p>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Formato</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingDocumentos ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">
                            Cargando documentos...
                          </TableCell>
                        </TableRow>
                      ) : documentos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">
                            No hay documentos para esta inspección
                          </TableCell>
                        </TableRow>
                      ) : (
                        documentos.map((documento) => (
                          <TableRow key={documento.id}>
                            <TableCell>
                              <div className="font-medium">{documento.titulo}</div>
                              {documento.descripcion && (
                                <div className="text-xs text-gray-500">{documento.descripcion}</div>
                              )}
                            </TableCell>
                            <TableCell>{documento.tipoDocumento}</TableCell>
                            <TableCell>
                              {format(parseISO(documento.fechaSubida), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell className="uppercase">{documento.formatoArchivo}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadDocument(documento)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => {
                                    if (window.confirm("¿Está seguro de eliminar este documento?")) {
                                      deleteDocumentoMutation.mutate(documento.id);
                                    }
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Diálogo para nueva inspección */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Inspección</DialogTitle>
          </DialogHeader>
          
          <Form {...newForm}>
            <form onSubmit={newForm.handleSubmit(data => createInspeccionMutation.mutate(data))} className="space-y-4">
              <FormField
                control={newForm.control}
                name="storeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tienda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una tienda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.code} value={store.code}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newForm.control}
                name="fechaInspeccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inspección</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newForm.control}
                name="inspectores"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspectores</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombres de inspectores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newForm.control}
                name="resultado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resultado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un resultado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Satisfactorio">Satisfactorio</SelectItem>
                        <SelectItem value="Con incidencias">Con incidencias</SelectItem>
                        <SelectItem value="Sancionado">Sancionado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newForm.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones de la inspección" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newForm.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Finalizada">Finalizada</SelectItem>
                        <SelectItem value="En proceso">En proceso</SelectItem>
                        <SelectItem value="Planificada">Planificada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createInspeccionMutation.isPending}>
                  {createInspeccionMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar inspección */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Inspección</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form 
              onSubmit={editForm.handleSubmit(data => 
                updateInspeccionMutation.mutate({ ...data, id: selectedInspeccion!.id })
              )} 
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="storeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tienda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una tienda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.code} value={store.code}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="fechaInspeccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inspección</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="inspectores"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspectores</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombres de inspectores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="resultado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resultado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un resultado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Satisfactorio">Satisfactorio</SelectItem>
                        <SelectItem value="Con incidencias">Con incidencias</SelectItem>
                        <SelectItem value="Sancionado">Sancionado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

              
              <FormField
                control={editForm.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones de la inspección" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Finalizada">Finalizada</SelectItem>
                        <SelectItem value="En proceso">En proceso</SelectItem>
                        <SelectItem value="Planificada">Planificada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateInspeccionMutation.isPending}>
                  {updateInspeccionMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para subir documento */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Documento</DialogTitle>
          </DialogHeader>
          
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(handleDocumentSubmit)} className="space-y-4">
              <FormField
                control={documentForm.control}
                name="tipoDocumento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de documento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Acta">Acta</SelectItem>
                        <SelectItem value="Informe">Informe</SelectItem>
                        <SelectItem value="Sanción">Sanción</SelectItem>
                        <SelectItem value="Fotografía">Fotografía</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={documentForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título del documento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={documentForm.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descripción del documento" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <Label htmlFor="file">Archivo</Label>
                <Input 
                  id="file" 
                  type="file" 
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip,.rar"
                />
                {fileError && <p className="text-sm text-red-500">{fileError}</p>}
                {selectedFile && (
                  <p className="text-sm text-gray-500">
                    Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploadDocumentoMutation.isPending}>
                  {uploadDocumentoMutation.isPending ? "Subiendo..." : "Subir"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}