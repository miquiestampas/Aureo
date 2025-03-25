import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Download, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number | null;
  storeCode: string | null;
  documentName: string;
}

export default function PdfViewer({ isOpen, onClose, documentId, storeCode, documentName }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && documentId) {
      setIsLoading(true);
      setError(null);
      
      // Primero obtener los detalles del documento
      fetch(`/api/pdf-documents/${documentId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error al obtener detalles del documento: ${response.status}`);
          }
          return response.json();
        })
        .then(docInfo => {
          // Luego obtener el contenido del PDF
          return fetch(`/api/pdf-documents/${documentId}/view`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Error al cargar el documento: ${response.status}`);
              }
              return response.blob();
            })
            .then(blob => {
              // Crear una URL del objeto para mostrar el PDF
              const url = URL.createObjectURL(blob);
              setPdfUrl(url);
              setIsLoading(false);
              
              console.log("PDF cargado correctamente:", docInfo);
            });
        })
        .catch(err => {
          console.error("Error al cargar el PDF:", err);
          setError("No se pudo cargar el documento PDF. Por favor, inténtelo de nuevo más tarde.");
          setIsLoading(false);
          toast({
            title: "Error al cargar el PDF",
            description: err.message || "No se pudo cargar el documento PDF",
            variant: "destructive",
          });
        });
    } else {
      // Limpiar la URL del PDF al cerrar el visor
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }
    
    // Limpiar la URL del PDF al desmontar el componente
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, documentId, toast]);

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = documentName || `documento-${documentId}.pdf`;
      a.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle>
              {documentName} 
              {storeCode && <span className="text-sm ml-2 opacity-60">Tienda: {storeCode}</span>}
            </DialogTitle>
            <DialogClose asChild>
              <Button size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription>
            Vista previa del documento PDF
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow relative overflow-hidden bg-muted rounded-md mt-2">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="ml-2">Cargando documento...</span>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={onClose} variant="outline">Cerrar</Button>
            </div>
          ) : (
            <iframe 
              src={`${pdfUrl}#toolbar=0`} 
              className="w-full h-full border-0"
              title={`PDF Viewer - ${documentName}`}
            />
          )}
        </div>
        
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handleDownload} disabled={!pdfUrl || isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}