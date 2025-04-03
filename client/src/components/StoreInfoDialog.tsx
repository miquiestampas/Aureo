import { useState } from "react";
import { Store as StoreType } from "../shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Store, MapPin, Calendar, Phone, Mail, ExternalLink } from "lucide-react";

// Define props para el componente
interface StoreInfoDialogProps {
  store: StoreType | null;
  open: boolean;
  onClose: () => void;
}

export default function StoreInfoDialog({ store, open, onClose }: StoreInfoDialogProps) {
  const [activeTab, setActiveTab] = useState("general");

  // Si no hay tienda seleccionada, no renderizamos nada
  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Store className="h-5 w-5" />
            {store.name}
            <Badge variant="outline" className="ml-2">
              {store.code}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Información detallada de la tienda
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
            <TabsTrigger value="advanced">Datos Avanzados</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Datos de la tienda
                </CardTitle>
                <CardDescription>
                  Información básica de la tienda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Ubicación
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.location || "No disponible"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <Store className="h-3.5 w-3.5" />
                      Tipo
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.type || "No especificado"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Fecha de apertura
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.openingDate ? new Date(store.openingDate).toLocaleDateString() : "No disponible"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <Badge className="h-3.5 w-3.5" />
                      Estado
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                          Inactiva
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contacto
                </CardTitle>
                <CardDescription>
                  Información de contacto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <Phone className="h-3.5 w-3.5" />
                      Teléfono
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.phone || "No disponible"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.email || "No disponible"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1 mb-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Sitio web
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {store.website ? (
                        <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {store.website}
                        </a>
                      ) : (
                        "No disponible"
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actividad Reciente</CardTitle>
                <CardDescription>
                  Estadísticas de actividad de la tienda en los últimos 30 días
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Cargando estadísticas...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos Avanzados</CardTitle>
                <CardDescription>
                  Métricas detalladas y datos históricos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Cargando datos avanzados...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}