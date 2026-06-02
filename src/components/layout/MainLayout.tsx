import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-brand-50/50 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar Controls */}
        <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
export default MainLayout;
