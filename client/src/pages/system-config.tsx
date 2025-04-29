import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSocketStore } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Settings,
  RefreshCw,
  FolderOpen,
  FileSpreadsheet,
  FileText,
  PlayCircle,
  StopCircle,
  Save,
  AlertCircle,
  Database
} from "lucide-react";

interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
}

export default function SystemConfigPage() {
  const { toast } = useToast();
  const { watcherActive } = useSocketStore();
  const [dirtyConfigs, setDirtyConfigs] = useState<Record<string, string>>({});
  
  // Fetch system configs
  const { data: configs, refetch: refetchConfigs } = useQuery<SystemConfig[]>({
    queryKey: ['/api/config'],
  });
  
  // Get config by key
  const getConfig = (key: string) => {
    return configs?.find(config => config.key === key);
  };
  
  // Get current value (either from dirty state or from data)
  const getCurrentValue = (key: string) => {
    if (key in dirtyConfigs) {
      return dirtyConfigs[key];
    }
    return getConfig(key)?.value || '';
  };
  
  // Handle input change
  const handleInputChange = (key: string, value: string) => {
    setDirtyConfigs(prev => ({ ...prev, [key]: value }));
  };
  
  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string, value: string }) => {
      const response = await apiRequest("PUT", `/api/config/${key}`, { value });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Configuration saved",
        description: `The ${variables.key} setting has been updated.`,
      });
      
      // Remove from dirty list
      setDirtyConfigs(prev => {
        const newState = { ...prev };
        delete newState[variables.key];
        return newState;
      });
      
      // Refetch configs
      refetchConfigs();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Save all dirty configs
  const saveAllConfigs = async () => {
    for (const [key, value] of Object.entries(dirtyConfigs)) {
      await saveConfigMutation.mutateAsync({ key, value });
    }
  };
  
  // Start file watchers mutation
  const startWatchersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/system/start-watchers", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File watchers started",
        description: "The system is now monitoring directories for new files.",
      });
      refetchConfigs();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start file watchers",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Stop file watchers mutation
  const stopWatchersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/system/stop-watchers", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File watchers stopped",
        description: "The system has stopped monitoring directories.",
      });
      refetchConfigs();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop file watchers",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Check if file watching is enabled
  const isFileWatchingEnabled = getCurrentValue('FILE_PROCESSING_ENABLED') === 'true';
  
  // Render directory input with save button
  const renderDirectoryInput = (key: string, label: string, icon: React.ReactNode) => {
    const config = getConfig(key);
    const currentValue = getCurrentValue(key);
    const isDirty = key in dirtyConfigs;
    
    return (
      <div className="space-y-2">
        <Label htmlFor={key} className="text-base font-medium">
          {label}
        </Label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
              {icon}
            </div>
            <Input
              id={key}
              value={currentValue}
              onChange={e => handleInputChange(key, e.target.value)}
              className="pl-10"
              placeholder="/path/to/directory"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={!isDirty || saveConfigMutation.isPending}
            onClick={() => saveConfigMutation.mutate({ key, value: currentValue })}
          >
            <Save className="h-4 w-4" />
            <span className="sr-only">Save</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {config?.description || "Directory path for file monitoring"}
        </p>
      </div>
    );
  };
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">System Configuration</h1>
            <p className="text-gray-500 mt-1">Configure directory monitoring and file processing settings</p>
          </div>
          
          <div className="flex space-x-2">
            {Object.keys(dirtyConfigs).length > 0 && (
              <Button 
                onClick={saveAllConfigs}
                disabled={saveConfigMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => refetchConfigs()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="file-monitoring">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="file-monitoring">File Monitoring</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="file-monitoring">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Processing Status Card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Settings className="h-5 w-5 mr-2 text-primary" />
                      File Processing Status
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={isFileWatchingEnabled || watcherActive ? 
                        "bg-green-100 text-green-800 hover:bg-green-100" : 
                        "bg-red-100 text-red-800 hover:bg-red-100"}
                    >
                      {isFileWatchingEnabled || watcherActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Switch
                          id="file-processing"
                          checked={isFileWatchingEnabled}
                          onCheckedChange={(checked) => {
                            handleInputChange('FILE_PROCESSING_ENABLED', checked ? 'true' : 'false');
                          }}
                        />
                        <Label htmlFor="file-processing" className="ml-2">
                          Enable automatic file processing
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        When enabled, the system will automatically monitor directories and process new files
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => startWatchersMutation.mutate()}
                        disabled={startWatchersMutation.isPending || (isFileWatchingEnabled && watcherActive)}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Start Watchers
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => stopWatchersMutation.mutate()}
                        disabled={stopWatchersMutation.isPending || (!isFileWatchingEnabled && !watcherActive)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop Watchers
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t">
                  <p className="text-sm text-muted-foreground">
                    Changes to file processing settings take effect immediately
                  </p>
                </CardFooter>
              </Card>
              
              {/* Directory Configuration Cards */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileSpreadsheet className="h-5 w-5 mr-2 text-green-600" />
                    Excel Files Directory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderDirectoryInput('EXCEL_WATCH_DIR', 'Excel Files Directory Path', <FolderOpen className="h-4 w-4" />)}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-red-500" />
                    PDF Files Directory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderDirectoryInput('PDF_WATCH_DIR', 'PDF Files Directory Path', <FolderOpen className="h-4 w-4" />)}
                </CardContent>
              </Card>
              
              {/* Database Path Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2 text-blue-600" />
                    Database File Path
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderDirectoryInput('DATABASE_PATH', 'Database File Path', <Database className="h-4 w-4" />)}
                </CardContent>
              </Card>
            </div>
            
            {/* Advanced Settings */}
            <div className="mt-6">
              <Accordion type="single" collapsible className="bg-white rounded-md border">
                <AccordionItem value="advanced-settings">
                  <AccordionTrigger className="px-4">Advanced Settings</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        These settings control advanced aspects of the file processing system. 
                        Only modify if you understand the implications.
                      </p>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full border-red-300 text-red-500 hover:text-red-700">
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Reset Directory Settings
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will reset all directory paths to their default values. 
                              Any custom paths you have configured will be lost.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                saveConfigMutation.mutate({ key: 'EXCEL_WATCH_DIR', value: '/data/excel' });
                                saveConfigMutation.mutate({ key: 'PDF_WATCH_DIR', value: '/data/pdf' });
                              }}
                            >
                              Reset Settings
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
          
          <TabsContent value="system">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-primary" />
                    General Settings
                  </CardTitle>
                  <CardDescription>
                    System-wide configuration settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <p className="text-sm text-gray-500">
                      This section will contain additional system settings in future versions, such as:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-500">
                      <li>Email notification settings</li>
                      <li>Data retention policies</li>
                      <li>Backup configuration</li>
                      <li>Integration settings</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Database Cleanup Section (SuperAdmin only) */}
              <Card className="border-red-200">
                <CardHeader className="border-b border-red-200">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-red-700">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Limpieza de Base de Datos
                    </CardTitle>
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      Solo SuperAdmin
                    </Badge>
                  </div>
                  <CardDescription className="text-red-500">
                    Herramientas para eliminar datos del sistema. Estas acciones son irreversibles.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-6">
                  <div className="space-y-8">
                    {/* Tiendas */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Eliminar Tiendas</h3>
                      <p className="text-sm text-muted-foreground">
                        Elimina tiendas y todos sus datos asociados.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-green-300 text-green-600 hover:text-green-800">
                              Tiendas Excel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará todas las tiendas de tipo Excel y todos sus datos asociados.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-excel-stores">Contraseña de administrador:</Label>
                                  <Input id="admin-password-excel-stores" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-excel-stores') as HTMLInputElement).value;
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/stores", {
                                    password,
                                    storeType: "Excel"
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Tiendas Excel eliminadas",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar tiendas",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Tiendas Excel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-red-300 text-red-600 hover:text-red-800">
                              Tiendas PDF
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará todas las tiendas de tipo PDF y todos sus datos asociados.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-pdf-stores">Contraseña de administrador:</Label>
                                  <Input id="admin-password-pdf-stores" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-pdf-stores') as HTMLInputElement).value;
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/stores", {
                                    password,
                                    storeType: "PDF"
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Tiendas PDF eliminadas",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar tiendas",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Tiendas PDF
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-red-300 text-red-800 hover:text-red-900">
                              Todas las Tiendas
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará TODAS las tiendas y todos sus datos asociados.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-all-stores">Contraseña de administrador:</Label>
                                  <Input id="admin-password-all-stores" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-all-stores') as HTMLInputElement).value;
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/stores", {
                                    password,
                                    storeType: "All"
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Todas las tiendas eliminadas",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar tiendas",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Todas las Tiendas
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Datos */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Eliminar Datos</h3>
                      <p className="text-sm text-muted-foreground">
                        Elimina datos manteniendo la estructura de tiendas. Opcionalmente puede filtrar por rango de fechas.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="data-date-from">Fecha desde:</Label>
                          <Input 
                            id="data-date-from" 
                            type="date" 
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="data-date-to">Fecha hasta:</Label>
                          <Input 
                            id="data-date-to" 
                            type="date" 
                            className="mt-2"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-green-300 text-green-600 hover:text-green-800">
                              Datos Excel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará todos los datos de Excel en el rango de fechas seleccionado.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-excel-data">Contraseña de administrador:</Label>
                                  <Input id="admin-password-excel-data" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-excel-data') as HTMLInputElement).value;
                                  const fromDate = (document.getElementById('data-date-from') as HTMLInputElement).value;
                                  const toDate = (document.getElementById('data-date-to') as HTMLInputElement).value;
                                  
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/data", {
                                    password,
                                    dataType: "Excel",
                                    fromDate: fromDate || undefined,
                                    toDate: toDate || undefined
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Datos Excel eliminados",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar datos",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Datos Excel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-red-300 text-red-600 hover:text-red-800">
                              Datos PDF
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará todos los documentos PDF en el rango de fechas seleccionado.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-pdf-data">Contraseña de administrador:</Label>
                                  <Input id="admin-password-pdf-data" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-pdf-data') as HTMLInputElement).value;
                                  const fromDate = (document.getElementById('data-date-from') as HTMLInputElement).value;
                                  const toDate = (document.getElementById('data-date-to') as HTMLInputElement).value;
                                  
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/data", {
                                    password,
                                    dataType: "PDF",
                                    fromDate: fromDate || undefined,
                                    toDate: toDate || undefined
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Datos PDF eliminados",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar datos",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Datos PDF
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-amber-300 text-amber-600 hover:text-amber-800">
                              Actividades
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará todas las actividades de archivos en el rango de fechas seleccionado.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-activities">Contraseña de administrador:</Label>
                                  <Input id="admin-password-activities" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-activities') as HTMLInputElement).value;
                                  const fromDate = (document.getElementById('data-date-from') as HTMLInputElement).value;
                                  const toDate = (document.getElementById('data-date-to') as HTMLInputElement).value;
                                  
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/data", {
                                    password,
                                    dataType: "Activities",
                                    fromDate: fromDate || undefined,
                                    toDate: toDate || undefined
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Actividades eliminadas",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar actividades",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Actividades
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full border-red-300 text-red-800 hover:text-red-900">
                              Todos los Datos
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará TODOS los datos (Excel, PDF, Actividades, Alertas) en el rango de fechas seleccionado.
                                <div className="mt-4">
                                  <Label htmlFor="admin-password-all-data">Contraseña de administrador:</Label>
                                  <Input id="admin-password-all-data" type="password" className="mt-2" />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                  const password = (document.getElementById('admin-password-all-data') as HTMLInputElement).value;
                                  const fromDate = (document.getElementById('data-date-from') as HTMLInputElement).value;
                                  const toDate = (document.getElementById('data-date-to') as HTMLInputElement).value;
                                  
                                  if (!password) {
                                    toast({
                                      title: "Error",
                                      description: "Debe proporcionar la contraseña de administrador",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  apiRequest("POST", "/api/system/purge/data", {
                                    password,
                                    dataType: "All",
                                    fromDate: fromDate || undefined,
                                    toDate: toDate || undefined
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      toast({
                                        title: "Todos los datos eliminados",
                                        description: `Se eliminaron ${data.count} registros del sistema.`,
                                      });
                                    })
                                    .catch(error => {
                                      toast({
                                        title: "Error al eliminar datos",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                Eliminar Todos los Datos
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Eliminar toda la base de datos */}
                    <div className="space-y-4 pt-6 border-t border-red-200">
                      <h3 className="text-xl font-medium text-red-800">Eliminar Toda la Base de Datos</h3>
                      <p className="text-sm text-red-600">
                        Esta opción eliminará TODOS los datos del sistema, excepto los usuarios. Esta acción es irreversible.
                      </p>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full mt-4">
                            Eliminar Toda la Base de Datos
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>ADVERTENCIA: Acción Destructiva</AlertDialogTitle>
                            <AlertDialogDescription>
                              <div className="space-y-4">
                                <p className="text-red-600 font-medium">
                                  Esta acción eliminará COMPLETAMENTE todos los datos de la base de datos:
                                </p>
                                <ul className="list-disc pl-5 space-y-1">
                                  <li>Todas las tiendas</li>
                                  <li>Todos los datos Excel</li>
                                  <li>Todos los documentos PDF</li>
                                  <li>Todas las actividades de archivos</li>
                                  <li>Todas las alertas</li>
                                  <li>Todas las configuraciones (se recrearán las predeterminadas)</li>
                                </ul>
                                <p className="font-medium mt-4">Los usuarios no serán eliminados.</p>
                                
                                <div className="mt-6 space-y-4">
                                  <div>
                                    <Label htmlFor="admin-password-all-db">Contraseña de administrador:</Label>
                                    <Input id="admin-password-all-db" type="password" className="mt-2" />
                                  </div>
                                  <div>
                                    <Label htmlFor="confirmation-text">Escriba "CONFIRMAR-ELIMINAR-TODO" para confirmar:</Label>
                                    <Input id="confirmation-text" className="mt-2" />
                                  </div>
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-700 hover:bg-red-800"
                              onClick={() => {
                                const password = (document.getElementById('admin-password-all-db') as HTMLInputElement).value;
                                const confirmationText = (document.getElementById('confirmation-text') as HTMLInputElement).value;
                                
                                if (!password) {
                                  toast({
                                    title: "Error",
                                    description: "Debe proporcionar la contraseña de administrador",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                if (confirmationText !== "CONFIRMAR-ELIMINAR-TODO") {
                                  toast({
                                    title: "Error",
                                    description: "El texto de confirmación no coincide",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                apiRequest("POST", "/api/system/purge/all", {
                                  password,
                                  confirmation: confirmationText
                                })
                                  .then(res => res.json())
                                  .then(data => {
                                    toast({
                                      title: "Base de datos eliminada",
                                      description: `Se eliminaron datos de ${data.tablesAffected} tablas.`,
                                    });
                                  })
                                  .catch(error => {
                                    toast({
                                      title: "Error al eliminar la base de datos",
                                      description: error.message,
                                      variant: "destructive",
                                    });
                                  });
                              }}
                            >
                              Eliminar Toda la Base de Datos
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="bg-red-50 border-t border-red-200">
                  <p className="text-sm text-red-600">
                    <span className="font-medium">Advertencia:</span> Todas las operaciones en esta sección son irreversibles y pueden causar pérdida permanente de datos.
                  </p>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
