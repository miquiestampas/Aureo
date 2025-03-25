import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  Menu, 
  Bell, 
  HelpCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [hasNotification] = useState(true);
  
  // Get page title based on current location
  const getPageTitle = () => {
    switch (location) {
      case '/':
        return 'Dashboard';
      case '/excel-stores':
        return 'Excel Stores';
      case '/pdf-stores':
        return 'PDF Stores';
      case '/store-management':
        return 'Store Management';
      case '/user-management':
        return 'User Management';
      case '/system-config':
        return 'System Configuration';
      default:
        return 'RetailManager';
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
          <Button variant="ghost" size="icon" className="relative ml-2 text-gray-400 hover:text-gray-500">
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" />
            {hasNotification && (
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
            )}
          </Button>
          
          {/* Help Button */}
          <Button variant="ghost" size="icon" className="ml-2 text-gray-400 hover:text-gray-500">
            <span className="sr-only">Help</span>
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-primary">
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
