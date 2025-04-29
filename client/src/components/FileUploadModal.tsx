import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type Store = {
  id: number;
  code: string;
  name: string;
  type: "Excel" | "PDF";
  location: string | null;
  active: boolean;
};

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  storesByType: Store[];
  fileType: "Excel" | "PDF";
}

export default function FileUploadModal({ isOpen, onClose, storesByType, fileType }: FileUploadModalProps) {
  const { toast } = useToast();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadType, setUploadType] = useState<"individual" | "batch">("individual");
  
  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFiles || selectedFiles.length === 0) {
        throw new Error("Debe seleccionar al menos un archivo");
      }
      
      console.log("Iniciando carga de archivos:", fileType, "Modo:", uploadType);
      
      const formData = new FormData();
      
      if (uploadType === "individual") {
        // Single file upload
        const file = selectedFiles[0];
        formData.append("file", file);
        
        // Log información del archivo para debugging
        console.log("Subiendo archivo:", file.name, "Tipo:", file.type, "Tamaño:", file.size, "bytes");
        
        // Usamos un código de tienda vacío o la tienda seleccionada
        // El servidor se encargará de detectar la tienda adecuada del archivo
        formData.append("storeCode", selectedStore || "");
        
        try {
          const response = await fetch(`/api/upload/${fileType.toLowerCase()}`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          
          console.log("Respuesta del servidor:", response.status, response.statusText);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Error en la respuesta:", errorText);
            throw new Error(errorText || `Error al subir archivo ${fileType} (${response.status})`);
          }
          
          return response.json();
        } catch (error) {
          console.error("Error en la solicitud:", error);
          throw error;
        }
      } else {
        // Batch upload
        // Create an array from FileList to append all files
        const files = Array.from(selectedFiles);
        
        files.forEach((file, index) => {
          console.log(`Archivo ${index+1}:`, file.name, "Tipo:", file.type, "Tamaño:", file.size, "bytes");
          formData.append("files", file);
        });
        
        // Usamos un código de tienda vacío, el servidor detectará automáticamente la tienda adecuada
        formData.append("storeCode", selectedStore || "");
        
        try {
          const response = await fetch(`/api/upload/${fileType.toLowerCase()}/batch`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          
          console.log("Respuesta del servidor para carga por lotes:", response.status, response.statusText);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Error en la respuesta de carga por lotes:", errorText);
            throw new Error(errorText || `Error al subir archivos ${fileType} (${response.status})`);
          }
          
          return response.json();
        } catch (error) {
          console.error("Error en la solicitud de carga por lotes:", error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Archivos subidos exitosamente",
        description: "Los archivos han sido enviados para procesamiento.",
      });
      handleClose();
      
      // Refetch relevant data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/${fileType.toLowerCase()}-data`] });
        queryClient.invalidateQueries({ queryKey: ['/api/file-activities'] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al subir archivos",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };
  
  // Handle upload
  const handleUpload = () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: "No hay archivos seleccionados",
        description: "Por favor seleccione al menos un archivo para subir",
        variant: "destructive",
      });
      return;
    }
    
    // Ya no necesitamos verificar la tienda, se detectará automáticamente
    uploadMutation.mutate();
  };
  
  // Close modal and reset state
  const handleClose = () => {
    setSelectedStore(null);
    setSelectedFiles(null);
    setUploadType("individual");
    onClose();
  };
  
  const getFileTypeLabel = (): string => {
    return fileType === "Excel" ? "Excel o CSV (.xlsx, .xls, .csv)" : "PDF (.pdf)";
  };
  
  const getFileTypeAccept = (): string => {
    return fileType === "Excel" ? ".xlsx,.xls,.csv" : ".pdf";
  };
  
  const getFileTypeIcon = () => {
    return fileType === "Excel" ? (
      <FileSpreadsheet className="h-5 w-5 text-green-600" />
    ) : (
      <FileText className="h-5 w-5 text-red-600" />
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {getFileTypeIcon()}
            <span className="ml-2">Cargar Archivos {fileType}</span>
          </DialogTitle>
          <DialogDescription>
            Suba uno o varios archivos {getFileTypeLabel()} para procesar.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="individual" className="mt-2" onValueChange={(value) => setUploadType(value as "individual" | "batch")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Carga Individual</TabsTrigger>
            <TabsTrigger value="batch">Carga por Lotes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="individual" className="space-y-4 pt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Detección automática de tienda</AlertTitle>
              <AlertDescription>
                {fileType === "Excel" 
                  ? "Para archivos Excel no necesita seleccionar una tienda. La tienda se detectará automáticamente del nombre del archivo o del contenido."
                  : "Para archivos PDF no necesita seleccionar una tienda. La tienda se detectará automáticamente del nombre del archivo."
                }
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="file">Archivo {fileType}</Label>
              <Input 
                id="file" 
                type="file" 
                accept={getFileTypeAccept()}
                onChange={handleFileChange}
              />
              <p className="text-sm text-muted-foreground">
                Solo se aceptan archivos {getFileTypeLabel()}.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="batch" className="space-y-4 pt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Modo de carga por lotes</AlertTitle>
              <AlertDescription>
                Este modo permite subir múltiples archivos a la vez. 
                El código de tienda se detectará automáticamente de los nombres de archivo para todos los documentos.
              </AlertDescription>
            </Alert>
            

            
            <div className="space-y-2">
              <Label htmlFor="files">Seleccionar Archivos</Label>
              <Input 
                id="files" 
                type="file" 
                accept={getFileTypeAccept()}
                onChange={handleFileChange}
                multiple
              />
              <p className="text-sm text-muted-foreground">
                Seleccione múltiples archivos {getFileTypeLabel()} para procesar en lote.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="autoverify" />
              <label
                htmlFor="autoverify"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Verificar automáticamente con lista de vigilancia
              </label>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-2">
          {selectedFiles && selectedFiles.length > 0 && (
            <div className="text-sm">
              {selectedFiles.length} archivo(s) seleccionado(s)
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFiles || uploadMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {uploadMutation.isPending ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            ) : (
              <span className="flex items-center">
                <Upload className="mr-2 h-4 w-4" />
                Subir Archivos
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}