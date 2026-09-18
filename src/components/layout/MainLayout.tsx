import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { OfflineAlert } from '../pwa/OfflineAlert';
import { PwaInstallBanner } from '../pwa/PwaInstallBanner';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-brand-50/50 font-sans">
      <OfflineAlert />
      <PwaInstallBanner />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar Navigation (Fixed position with independent scroll) */}
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          {/* Topbar Controls (Stays at the top, does not scroll with page content) */}
          <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Content View Container (Independent scroll) */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 overscroll-contain scrollbar-thin">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12 sm:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  </div>
  );
};
export default MainLayout;
