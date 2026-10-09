import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isDemoMode, supabaseConfigurationIssue } from '../../lib/supabase';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { UserRole } from '../../types/database';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-medium text-slate-500">Authenticating session...</p>
    </div>
  </div>
);

/**
 * Production fail-closed screen for a missing / invalid Supabase configuration.
 * No protected workspace content is rendered and no privileged request is made.
 */
const ConfigurationErrorScreen: React.FC = () => (
  <div className="min-h-[70vh] flex items-center justify-center px-4">
    <div className="max-w-lg w-full text-center space-y-4 bg-white border border-rose-200 rounded-2xl p-8 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Platform configuration error</h1>
      <p className="text-xs text-slate-600 leading-relaxed">
        This deployment is not connected to Supabase, so authenticated workspaces are unavailable.
        {supabaseConfigurationIssue ? ` ${supabaseConfigurationIssue}` : ''}
      </p>
      <p className="text-[11px] text-slate-500">
        An administrator must set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> and rebuild the application.
      </p>
    </div>
  </div>
);

/**
 * Development / Demo banner shown when the UI is run without Supabase credentials.
 */
const DevelopmentBypassNotice: React.FC = () => (
  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <span>
      <strong>Live Presentation Demo Mode.</strong> Rendered with seeded MITT hackathon dataset for panel evaluation.
    </span>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, isLoading, isConfigured } = useAuth();
  const location = useLocation();
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading && !forceReady) {
    return <LoadingScreen />;
  }

  // ---- Configuration gate (fail closed in real production, open in demo) ----
  if (!isConfigured) {
    if (!isDemoMode) {
      return <ConfigurationErrorScreen />;
    }

    return (
      <div className="space-y-4">
        <DevelopmentBypassNotice />
        {children}
      </div>
    );
  }

  if (!user) {
    if (isDemoMode) {
      return (
        <div className="space-y-4">
          <DevelopmentBypassNotice />
          {children}
        </div>
      );
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role;
    // super_admin has access to everything
    if (userRole === 'super_admin') {
      return children;
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      if (isDemoMode) {
        return children;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};
