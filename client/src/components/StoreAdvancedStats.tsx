import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, PieChart, Users, TrendingUp, Star, Calendar } from "lucide-react";
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

  if (!statsData || (statsData.ordersByMonth.length === 0 && statsData.topMetals.length === 0)) {
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
          <TabsTrigger value="materials">Materiales</TabsTrigger>
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
              {statsData.ordersByMonth.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de órdenes disponibles
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData.ordersByMonth.map((item) => (
                    <div key={item.month} className="flex items-center">
                      <p className="w-36 text-sm">{item.month}</p>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={item.count / statsData.performanceMetrics.peakMonthValue * 100} 
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
              {statsData.priceDistribution.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de precios disponibles
                </div>
              ) : (
                <div className="space-y-2">
                  {statsData.priceDistribution.map((item) => (
                    <div key={item.range} className="flex items-center">
                      <p className="w-24 text-sm">{item.range}</p>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={item.count / Math.max(...statsData.priceDistribution.map(d => d.count)) * 100} 
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
        
        <TabsContent value="materials" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Metales más Comunes</CardTitle>
                <CardDescription>
                  Distribución de metales en las órdenes
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {statsData.topMetals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de metales disponibles
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statsData.topMetals.map((item) => (
                      <div key={item.metal} className="flex items-center">
                        <p className="w-28 text-sm">{item.metal}</p>
                        <div className="w-full">
                          <div className="flex items-center gap-2">
                            <Progress value={item.percentage} className="h-2" />
                            <span className="text-sm">{item.count} ({item.percentage}%)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Piedras más Comunes</CardTitle>
                <CardDescription>
                  Distribución de piedras en las órdenes
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {statsData.topStones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de piedras disponibles
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statsData.topStones.map((item) => (
                      <div key={item.stone} className="flex items-center">
                        <p className="w-28 text-sm">{item.stone}</p>
                        <div className="w-full">
                          <div className="flex items-center gap-2">
                            <Progress value={item.percentage} className="h-2" />
                            <span className="text-sm">{item.count} ({item.percentage}%)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData.customerMetrics.totalCustomers}</div>
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
                <div className="text-2xl font-bold">{statsData.customerMetrics.returningCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  tasa de retorno: {statsData.customerMetrics.returningRate}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}