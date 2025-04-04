import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Menu, 
  Bell, 
  HelpCircle,
  AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();

  // Query para obtener notificaciones de coincidencias no leídas
  const { data: coincidenciasNoLeidas } = useQuery<{ count: number }>({
    queryKey: ["/api/coincidencias/noleidas/count"],
    refetchInterval: 60000, // Actualizar cada minuto
    refetchOnWindowFocus: true,
  });
  
  // Get page title based on current location
  const getPageTitle = () => {
    switch (location) {
      case '/':
        return 'Dashboard';
      case '/excel-stores':
        return 'Tiendas Excel';
      case '/pdf-stores':
        return 'Tiendas PDF';
      case '/store-management':
        return 'Gestión de Tiendas';
      case '/user-management':
        return 'Gestión de Usuarios';
      case '/system-config':
        return 'Configuración del Sistema';
      case '/activity-control':
        return 'Control de Actividad';
      case '/purchase-control':
        return 'Control de Compras';
      case '/senalamientos':
        return 'Señalamientos';
      case '/coincidencias':
        return 'Coincidencias';
      default:
        return 'Áureo';
    }
  };
  
  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
      <Button 
        variant="ghost" 
        size="icon" 
        className="md:hidden px-4 border-r border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        onClick={onMenuToggle}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </Button>
      
      <div className="flex-1 flex justify-between px-4">
        <div className="flex-1 flex items-center">
          <h1 className="text-xl font-semibold text-primary">{getPageTitle()}</h1>
        </div>
        
        <div className="ml-4 flex items-center md:ml-6">
          {/* Notification Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative ml-2 text-gray-400 hover:text-gray-500"
                onClick={() => (user?.role === "SuperAdmin" || user?.role === "Admin") && setLocation("/coincidencias")}
              >
                <span className="sr-only">Ver coincidencias</span>
                <Bell className="h-6 w-6" />
                {coincidenciasNoLeidas && coincidenciasNoLeidas.count > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-5 p-1 rounded-full bg-red-500 text-white text-xs font-medium">
                    {coincidenciasNoLeidas.count > 99 ? '99+' : coincidenciasNoLeidas.count}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={() => setLocation("/coincidencias")}
              >
                <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                Ver coincidencias
                {coincidenciasNoLeidas && coincidenciasNoLeidas.count > 0 && (
                  <Badge className="ml-2 bg-red-500">
                    {coincidenciasNoLeidas.count}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={() => setLocation("/senalamientos")}
              >
                <AlertTriangle className="mr-2 h-4 w-4 text-indigo-500" />
                Gestionar señalamientos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Help Button */}
          <Button variant="ghost" size="icon" className="ml-2 text-gray-400 hover:text-gray-500">
            <span className="sr-only">Ayuda</span>
            <HelpCircle className="h-6 w-6" />
          </Button>
          
          {/* User Menu (Hidden on Mobile) */}
          <div className="hidden md:block ml-3 relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-sm">
                  <span className="ml-3 text-sm font-medium text-gray-700 truncate">
                    {user?.name}
                  </span>
                  <div className="ml-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium role-badge">
                      {user?.role}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  Signed in as <strong className="ml-1">{user?.username}</strong>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
