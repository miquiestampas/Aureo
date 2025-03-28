import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileSpreadsheet,
  FileText,
  Store,
  Users,
  Settings,
  LogOut,
  ActivitySquare,
  Search,
  AlertCircle,
  AlertTriangle,
  Shield,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  requiredRoles?: string[];
  userRole?: string;
}

const NavItem = ({ href, icon, label, active, requiredRoles, userRole }: NavItemProps) => {
  // If requiredRoles is specified, check if user has access
  if (requiredRoles && userRole && !requiredRoles.includes(userRole)) {
    return null;
  }
  
  return (
    <Link href={href}>
      <div
        className={cn(
          "sidebar-item flex items-center px-4 py-3 text-sm font-medium text-white hover:bg-yellow-500/20 hover:text-yellow-500 rounded-md transition-colors cursor-pointer",
          active && "bg-yellow-500/20 text-yellow-500"
        )}
      >
        <div className="sidebar-icon mr-3 text-white">{icon}</div>
        {label}
      </div>
    </Link>
  );
};

export default function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };
  
  const userInitials = user?.name ? getInitials(user.name) : "U";
  
  return (
    <div className="flex flex-col w-64 bg-primary text-white h-full">
      {/* Logo Section */}
      <div className="flex items-center justify-center h-16 px-4 bg-primary-dark">
        <h1 className="text-xl font-bold">Áureo</h1>
      </div>
      
      {/* User Profile Section */}
      <div className="flex flex-col items-center justify-center pt-5 pb-6 border-b border-primary-light">
        <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-primary text-2xl font-bold">{userInitials}</span>
        </div>
        <h2 className="mt-2 text-md font-semibold">{user?.name}</h2>
        <span className="px-2 py-1 mt-1 text-xs rounded-full bg-secondary text-primary font-medium">
          {user?.role}
        </span>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-2 space-y-1">
          {/* Panel Principal */}
          <div className="mb-2">
            <h3 className="px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Panel Principal
            </h3>
          </div>
          
          <NavItem
            href="/"
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={location === '/'}
          />

          {/* Investigación Section */}
          <div className="mt-6 mb-2">
            <h3 className="px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Investigación
            </h3>
          </div>
          
          <NavItem
            href="/purchase-control"
            icon={<Search size={20} />}
            label="Control de Compras"
            active={location === '/purchase-control'}
          />
          
          <NavItem
            href="/senalamientos"
            icon={<AlertTriangle size={20} />}
            label="Señalamientos"
            active={location === '/senalamientos'}
            requiredRoles={["SuperAdmin", "Admin"]}
            userRole={user?.role}
          />
          
          <NavItem
            href="/coincidencias"
            icon={<Bell size={20} />}
            label="Coincidencias"
            active={location === '/coincidencias'}
            requiredRoles={["SuperAdmin", "Admin"]}
            userRole={user?.role}
          />

          {/* Administración Section */}
          <div className="mt-6 mb-2">
            <h3 className="px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Administración
            </h3>
          </div>
          
          <NavItem
            href="/activity-control"
            icon={<ActivitySquare size={20} />}
            label="Control de Actividad"
            active={location === '/activity-control'}
          />
          
          <NavItem
            href="/store-management"
            icon={<Store size={20} />}
            label="Gestión de Tiendas"
            active={location === '/store-management'}
            requiredRoles={["SuperAdmin", "Admin"]}
            userRole={user?.role}
          />
          
          <NavItem
            href="/excel-stores"
            icon={<FileSpreadsheet size={20} />}
            label="Tiendas Excel"
            active={location === '/excel-stores'}
          />
          
          <NavItem
            href="/pdf-stores"
            icon={<FileText size={20} />}
            label="Tiendas PDF"
            active={location === '/pdf-stores'}
          />
          
          {/* Sistema Section */}
          <div className="mt-6 mb-2">
            <h3 className="px-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Sistema
            </h3>
          </div>
          
          <NavItem
            href="/user-management"
            icon={<Users size={20} />}
            label="Gestión de Usuarios"
            active={location === '/user-management'}
            requiredRoles={["SuperAdmin"]}
            userRole={user?.role}
          />
          
          <NavItem
            href="/system-config"
            icon={<Settings size={20} />}
            label="Configuración del Sistema"
            active={location === '/system-config'}
            requiredRoles={["SuperAdmin"]}
            userRole={user?.role}
          />
        </div>
      </nav>
      
      {/* Logout Button */}
      <div className="flex-shrink-0 p-4 border-t border-primary-light">
        <Button
          onClick={handleLogout}
          className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-primary bg-secondary hover:bg-yellow-400 transition-colors"
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
