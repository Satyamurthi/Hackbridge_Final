import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isDevelopment } from '../../lib/supabase';
import { 
  Building2, 
  ChevronDown, 
  LogOut, 
  Shield, 
  Menu, 
  X
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const { user, profile, tenant, availableTenants, switchTenant, signOut, isConfigured } = useAuth();
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardRoute = () => {
    if (!profile) return '/';
    switch (profile.role) {
      case 'super_admin':
      case 'college_admin':
      case 'committee_member':
        return '/admin';
      case 'student':
        return '/student';
      case 'evaluator':
        return '/evaluator';
      case 'company_rep':
        return '/company';
      case 'mentor':
        return '/student';
      default:
        return '/';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm">
      {isDevelopment && !isConfigured && (
        <div className="bg-amber-500 text-slate-900 text-xs py-1 px-4 text-center font-medium">
          Development mode — Supabase credentials are not configured in <code className="font-mono font-bold">.env</code>,
          so this build renders mock data without authentication. Never shipped in production builds.
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand / Tenant Info */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                H
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                  HackBridge
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    SaaS
                  </span>
                </span>
                <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                  {tenant?.name || 'HackBridge'}
                </span>
              </div>
            </Link>

            {/* Tenant Selector (White-label switcher for previewing multiple colleges) */}
            {availableTenants.length > 1 && (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate max-w-[120px]">{tenant?.slug.toUpperCase()}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {tenantDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white shadow-lg ring-1 ring-black/5 py-1 z-50">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Select Institution Tenant
                    </div>
                    {availableTenants.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          switchTenant(t.slug);
                          setTenantDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex flex-col transition-colors ${
                          tenant?.id === t.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{t.subdomain || t.slug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <Link to="/hackathons" className="hover:text-indigo-600 transition-colors">
              Hackathons
            </Link>
            <Link to="/leaderboard" className="hover:text-indigo-600 transition-colors">
              Leaderboard
            </Link>
          </nav>

          {/* Right Action / Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user && <NotificationBell />}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-sm border border-indigo-200">
                    {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 leading-none">
                      {profile?.full_name || user.email}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {profile?.role?.replace('_', ' ') || 'User'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-xl ring-1 ring-black/5 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-medium text-slate-900 truncate">{profile?.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                        {profile?.role?.replace('_', ' ')}
                      </span>
                    </div>

                    <Link
                      to={getDashboardRoute()}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      Stakeholder Dashboard
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-lg shadow-sm shadow-indigo-200 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1 md:hidden">
            {user && <NotificationBell />}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
          <Link
            to="/hackathons"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Hackathons
          </Link>
          <Link
            to="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Leaderboard
          </Link>
          <div className="pt-2 border-t border-slate-100">
            {user ? (
              <>
                <Link
                  to={getDashboardRoute()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-indigo-600 font-semibold text-sm"
                >
                  Go to Dashboard ({profile?.role?.replace('_', ' ')})
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-3 py-2 text-red-600 font-semibold text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
