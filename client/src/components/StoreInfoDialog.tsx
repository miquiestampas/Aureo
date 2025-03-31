import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store as StoreType } from "../shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  MapPin, 
  Tag, 
  Briefcase, 
  Calendar, 
  FileText, 
  ShoppingBag,
  Phone,
  Mail,
  Clock
} from "lucide-react";

interface StoreInfoDialogProps {
  store: StoreType | null;
  open: boolean;
  onClose: () => void;
}

interface StoreStats {
  totalOrders: number;
  averagePrice: string;
  lastActivity: string;
  mostCommonMetal: string;
}

export default function StoreInfoDialog({ store, open, onClose }: StoreInfoDialogProps) {
  const [activeTab, setActiveTab] = useState("info");
  
  // Consulta para obtener estadísticas de la tienda
  const { data: storeStats, isLoading } = useQuery({
    queryKey: ['storeStats', store?.code],
    queryFn: async () => {
      if (!store) return null;
      
      try {
        const response = await fetch(`/api/stores/${store.code}/stats`);
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        console.error("Error al cargar estadísticas de tienda:", error);
        return null;
      }
    },
    enabled: !!store && open,
  });
  
  // Valores por defecto para las estadísticas
  const stats: StoreStats = storeStats || {
    totalOrders: 0,
    averagePrice: "0",
    lastActivity: "Sin actividad",
    mostCommonMetal: "Ninguno"
  };
  
  if (!store) return null;
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center">
            <Building2 className="h-6 w-6 mr-2 text-primary" />
            <DialogTitle className="text-xl">{store.name}</DialogTitle>
          </div>
          <Badge variant={store.active ? "default" : "outline"} className="mt-2 self-start">
            {store.active ? "Tienda Activa" : "Tienda Inactiva"}
          </Badge>
          <DialogDescription className="mt-2">
            Información detallada y estadísticas de la tienda seleccionada
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Información básica</TabsTrigger>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-md">Detalles principales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start">
                    <Tag className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Código</h4>
                      <p className="text-base font-medium">{store.code}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Briefcase className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Tipo</h4>
                      <p className="text-base">{store.type || "No especificado"}</p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Ubicación</h4>
                    <p className="text-base">{store.location || "No especificada"}</p>
                  </div>
                </div>
                
                {/* Información de contacto - Si estuviera disponible */}
                {(store.phone || store.email) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Información de contacto</h4>
                      
                      {store.phone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          <p className="text-sm">{store.phone}</p>
                        </div>
                      )}
                      
                      {store.email && (
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                          <p className="text-sm">{store.email}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Detalles adicionales - Si estuvieran disponibles */}
                {store.details && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Detalles adicionales</h4>
                      <p className="text-sm mt-1">{store.details}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Actividad comercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Total de órdenes</dt>
                      <dd className="text-2xl font-bold">{stats.totalOrders}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Precio promedio</dt>
                      <dd className="text-lg font-semibold">{stats.averagePrice}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Actividad reciente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Última actividad</dt>
                      <dd className="text-base">{stats.lastActivity}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Metal más común</dt>
                      <dd className="text-base">{stats.mostCommonMetal}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
            
            {isLoading && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Cargando estadísticas...
              </p>
            )}
            
            {!isLoading && !storeStats && (
              <div className="text-center p-4 mt-2">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">
                  Las estadísticas detalladas para esta tienda no están disponibles en este momento.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}