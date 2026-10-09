import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  showSidebar?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ showSidebar = false }) => {
  const { tenant } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <div className="flex-1 flex">
        {showSidebar && <Sidebar />}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {!showSidebar && (
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <p>
              &copy; {new Date().getFullYear()} {tenant?.name || 'HackBridge'} · Powered by HackBridge
            </p>
            <p className="text-[11px] text-slate-400">
              White-label SaaS Platform for Engineering Colleges
            </p>
          </div>
        </footer>
      )}
    </div>
  );
};
