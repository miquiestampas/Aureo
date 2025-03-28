import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { useSocketStore } from "@/lib/socket";

// Layouts & Components
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

// Pages
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard";
import ExcelStoresPage from "@/pages/excel-stores";
import PdfStoresPage from "@/pages/pdf-stores";
import StoreManagementPage from "@/pages/store-management";
import UserManagementPage from "@/pages/user-management";
import SystemConfigPage from "@/pages/system-config";
import ActivityControlPage from "@/pages/activity-control";
import PurchaseControlPage from "@/pages/purchase-control";
import SenalamientosPage from "@/pages/senalamientos";
import CoincidenciasPage from "@/pages/coincidencias";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar for mobile (fixed position when open) */}
      {sidebarOpen && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
            onClick={toggleSidebar}
          />
          
          {/* Mobile sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden">
            <Sidebar />
          </div>
        </>
      )}
      
      {/* Desktop sidebar (always visible) */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="w-64">
          <Sidebar />
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Navbar onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute 
        path="/" 
        component={() => (
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/excel-stores" 
        component={() => (
          <AppLayout>
            <ExcelStoresPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/pdf-stores" 
        component={() => (
          <AppLayout>
            <PdfStoresPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/store-management" 
        roles={["SuperAdmin", "Admin"]}
        component={() => (
          <AppLayout>
            <StoreManagementPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/user-management" 
        roles={["SuperAdmin"]}
        component={() => (
          <AppLayout>
            <UserManagementPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/system-config" 
        roles={["SuperAdmin"]}
        component={() => (
          <AppLayout>
            <SystemConfigPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/activity-control" 
        component={() => (
          <AppLayout>
            <ActivityControlPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/purchase-control" 
        component={() => (
          <AppLayout>
            <PurchaseControlPage />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/senalamientos" 
        component={SenalamientosPage} 
      />
      
      <ProtectedRoute 
        path="/coincidencias" 
        component={CoincidenciasPage} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { initSocket } = useSocketStore();
  
  // Initialize socket connection
  useEffect(() => {
    initSocket();
    
    return () => {
      // Clean up socket connection when app unmounts
      useSocketStore.getState().disconnect();
    };
  }, [initSocket]);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
