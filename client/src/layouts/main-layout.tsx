import { ReactNode, useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar for medium screens and up */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={toggleSidebar}></div>
          <div className="relative flex flex-col flex-1 w-full max-w-xs bg-primary">
            <div className="absolute top-0 right-0 p-1">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-md bg-primary focus:outline-none"
                onClick={toggleSidebar}
              >
                <span className="sr-only">Close sidebar</span>
                <svg
                  className="w-6 h-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 md:p-6">
          <div className="container mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}