import React from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      
      <div className="flex flex-1">
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