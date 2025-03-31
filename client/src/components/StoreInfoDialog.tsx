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

interface StoreInfoDialogProps {
  store: StoreType | null;
  open: boolean;
  onClose: () => void;
}

export default function StoreInfoDialog({ store, open, onClose }: StoreInfoDialogProps) {
  if (!store) return null;
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Información de tienda</DialogTitle>
          <DialogDescription>
            Detalles completos de la tienda seleccionada
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Código</h4>
              <p className="text-base">{store.code}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Estado</h4>
              <p className="text-base">
                <Badge variant={store.active ? "default" : "outline"}>
                  {store.active ? "Activa" : "Inactiva"}
                </Badge>
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Nombre</h4>
            <p className="text-base">{store.name}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Tipo</h4>
            <p className="text-base">{store.type || "No especificado"}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Ubicación</h4>
            <p className="text-base">{store.location || "No especificada"}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}