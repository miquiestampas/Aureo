import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, MapPin, Users, TrendingUp, Star, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StoreAdvancedStatsProps {
  storeCode: string;
}

export function StoreAdvancedStats({ storeCode }: StoreAdvancedStatsProps) {
  const [activeTab, setActiveTab] = useState("orders");

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/stores', storeCode, 'advanced-stats'],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeCode}/advanced-stats`);
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas avanzadas');
      }
      return response.json();
    },
    enabled: !!storeCode
  });

  if (isLoadingStats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!statsData || !statsData.ordersByMonth || !statsData.sellersByRegion || 
      (statsData.ordersByMonth.length === 0 && statsData.sellersByRegion.length === 0)) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay datos suficientes para mostrar estadísticas avanzadas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="orders" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Órdenes</TabsTrigger>
          <TabsTrigger value="price">Precios</TabsTrigger>
          <TabsTrigger value="regions">Provincias/Países</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Órdenes por Mes</CardTitle>
              <CardDescription>
                Historial de órdenes procesadas a lo largo del tiempo
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {!statsData.ordersByMonth || statsData.ordersByMonth.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de órdenes disponibles
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData.ordersByMonth.map((item: any) => (
                    <div key={item.month} className="flex items-center">
                      <p className="w-36 text-sm">{item.month}</p>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(statsData.performanceMetrics?.peakMonthValue > 0) ? 
                              (item.count / statsData.performanceMetrics.peakMonthValue * 100) : 0} 
                            className="h-2" 
                          />
                          <span className="text-sm">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Órdenes Mensuales</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData.performanceMetrics.avgOrdersPerMonth}</div>
                <p className="text-xs text-muted-foreground">
                  promedio de órdenes procesadas por mes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mes con Mayor Actividad</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData.performanceMetrics.peakMonth}</div>
                <p className="text-xs text-muted-foreground">
                  {statsData.performanceMetrics.peakMonthValue} órdenes
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="price" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Precios</CardTitle>
              <CardDescription>
                Análisis de rangos de precios para las órdenes
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {!statsData.priceDistribution || statsData.priceDistribution.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de precios disponibles
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData.priceDistribution.map((item: any) => (
                    <div key={item.range} className="flex items-center">
                      <p className="w-24 text-sm">{item.range}</p>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={statsData.priceDistribution.length > 0 ? 
                              (item.count / Math.max(...statsData.priceDistribution.map((d: any) => d.count || 0)) * 100) : 0} 
                            className="h-2" 
                          />
                          <span className="text-sm">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Provincias/Países</CardTitle>
              <CardDescription>
                Análisis de ventas por regiones geográficas
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {statsData.sellersByRegion?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de regiones disponibles
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData.sellersByRegion?.map((item: any) => (
                    <div key={item.region} className="flex items-center">
                      <p className="w-28 text-sm truncate" title={item.region}>
                        {item.region}
                      </p>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={item.percentage} 
                            className="h-2" 
                          />
                          <span className="text-sm">{item.count} ({item.percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Regiones</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsData.sellersByRegion?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  provincias/países con actividad
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Región Principal</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate" title={statsData.sellersByRegion?.[0]?.region || "N/A"}>
                  {statsData.sellersByRegion?.[0]?.region || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statsData.sellersByRegion?.[0]?.count || 0} órdenes ({statsData.sellersByRegion?.[0]?.percentage || 0}%)
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="customers" className="space-y-4">
          {!statsData.customerMetrics ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay datos de clientes disponibles
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData.customerMetrics?.totalCustomers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    clientes únicos
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clientes Habituales</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData.customerMetrics?.returningCustomers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    tasa de retorno: {statsData.customerMetrics?.returningRate || "0%"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}