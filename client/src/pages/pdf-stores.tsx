import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSocketStore } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
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
  FileText,
  Upload,
  Download,
  FileSearch,
  Eye,
  Calendar
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import PdfViewer from "@/components/PdfViewer";

interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
}

interface PdfDocument {
  id: number;
  storeCode: string;
  documentType: string;
  title: string;
  path: string;
  uploadDate: string;
  fileSize: number;
  fileActivityId: number;
}

export default function PdfStoresPage() {
  const { toast } = useToast();
  const { recentEvents } = useSocketStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ id: number, title: string, storeCode: string } | null>(null);

  // Fetch PDF stores
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['/api/stores', { type: 'PDF' }],
  });
  
  // Fetch PDF documents for selected store
  const { data: pdfDocuments, refetch: refetchPdfDocs } = useQuery<PdfDocument[]>({
    queryKey: ['/api/pdf-documents', { storeCode: selectedStore }],
    enabled: !!selectedStore,
  });
  
  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !selectedStore) return;
      
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("storeCode", selectedStore);
      
      const response = await fetch("/api/upload/pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload file");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File uploaded successfully",
        description: "The file has been queued for processing.",
      });
      setUploadDialogOpen(false);
      setUploadFile(null);
      
      // Refetch file activity data after successful upload
      setTimeout(() => {
        refetchPdfDocs();
        queryClient.invalidateQueries({ queryKey: ['/api/file-activities'] });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };
  
  // Handle file upload
  const handleUpload = () => {
    if (!uploadFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate();
  };
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Refetch data when receiving socket events
  useEffect(() => {
    if (recentEvents.length > 0 && selectedStore) {
      const lastEvent = recentEvents[0];
      
      if (lastEvent.type === 'fileProcessingStatus' && 
          lastEvent.data.status === 'Processed') {
        refetchPdfDocs();
      }
    }
  }, [recentEvents, selectedStore, refetchPdfDocs]);
  
  // Data columns
  const columns: ColumnDef<PdfDocument>[] = [
    {
      accessorKey: "title",
      header: "Document Title",
    },
    {
      accessorKey: "documentType",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.documentType || "Unknown";
        return (
          <div className="flex items-center">
            <span>{type}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "uploadDate",
      header: "Upload Date",
      cell: ({ row }) => {
        const date = new Date(row.original.uploadDate);
        return format(date, "MMM d, yyyy, h:mm a");
      }
    },
    {
      accessorKey: "fileSize",
      header: "File Size",
      cell: ({ row }) => {
        return formatFileSize(row.original.fileSize);
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="View document"
              onClick={() => handleViewPdf(row.original)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">View document</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0"
              title="Download document"
              onClick={() => handleDownloadPdf(row.original.id)}
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Download document</span>
            </Button>
          </div>
        );
      }
    }
  ];
  
  // Handle view PDF
  const handleViewPdf = (document: PdfDocument) => {
    setSelectedDocument({
      id: document.id,
      title: document.title || `Documento-${document.id}`,
      storeCode: document.storeCode
    });
    setViewerOpen(true);
  };

  // Handle download PDF
  const handleDownloadPdf = async (documentId: number) => {
    try {
      // Crear un enlace invisible, configurarlo para descargar y hacer clic en él
      const response = await fetch(`/api/pdf-documents/${documentId}/view`);
      if (!response.ok) {
        throw new Error("Error al descargar el documento");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `documento-${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error descargando PDF:", error);
      toast({
        title: "Error al descargar",
        description: "No se pudo descargar el documento PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">PDF Stores</h1>
          
          <div className="flex space-x-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload PDF File
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload PDF Document</DialogTitle>
                  <DialogDescription>
                    Upload a PDF document for the selected store.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="store">Select Store</Label>
                    <Select 
                      onValueChange={(value) => setSelectedStore(value)}
                      value={selectedStore || undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.filter(store => store.type === "PDF").map(store => (
                          <SelectItem key={store.id} value={store.code}>
                            {store.name} ({store.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="file">PDF File</Label>
                    <Input 
                      id="file" 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleFileChange}
                    />
                    <p className="text-sm text-gray-500">
                      Only PDF files are accepted.
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedStore || !uploadFile || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Store</CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              onValueChange={(value) => setSelectedStore(value)}
              value={selectedStore || undefined}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select a store to view documents" />
              </SelectTrigger>
              <SelectContent>
                {stores?.filter(store => store.type === "PDF").map(store => (
                  <SelectItem key={store.id} value={store.code}>
                    {store.name} ({store.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        {selectedStore ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-red-500" />
                    Documents: {stores?.find(s => s.code === selectedStore)?.name || selectedStore}
                  </div>
                </CardTitle>
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileSearch className="h-4 w-4 mr-1" />
                  {pdfDocuments?.length || 0} documents
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pdfDocuments?.length ? (
                <DataTable
                  columns={columns}
                  data={pdfDocuments}
                  searchKey="title"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No documents available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No PDF documents found for this store.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select a store to view documents</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a PDF store from the dropdown above to view its documents.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <PdfViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          documentId={selectedDocument.id}
          storeCode={selectedDocument.storeCode}
          documentName={selectedDocument.title}
        />
      )}
    </div>
  );
}
