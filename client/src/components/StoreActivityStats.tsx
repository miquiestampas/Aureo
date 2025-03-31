import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Activity, Calendar, Package } from "lucide-react";

interface StoreActivityStatsProps {
  storeCode: string;
}

export function StoreActivityStats({ storeCode }: StoreActivityStatsProps) {
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/stores', storeCode, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeCode}/stats`);
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }
      return response.json();
    },
    enabled: !!storeCode
  });

  if (isLoadingStats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!statsData) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No hay estadísticas disponibles
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Órdenes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              órdenes procesadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.averagePrice}</div>
            <p className="text-xs text-muted-foreground">
              valor medio de las operaciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Metal más Común</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.mostCommonMetal}</div>
            <p className="text-xs text-muted-foreground">
              metal más frecuente en órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Actividad</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.lastActivity}</div>
            <p className="text-xs text-muted-foreground">
              fecha de última operación
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}