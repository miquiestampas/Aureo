import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onMenuToggle={toggleSidebar} />
      
      <div className="flex flex-1">
        {/* Mobile sidebar (fixed position when open) */}
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
        <aside className="hidden border-r md:block md:w-64 lg:w-72">
          <Sidebar />
        </aside>
        
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}