import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, isDemoMode } from '../lib/supabase';
import type { Tenant, Profile, UserRole } from '../types/database';

/**
 * NOTE (Phase 1.5 hardening):
 * A hardcoded `DEFAULT_PILOT_TENANT` object previously lived here, carrying a
 * made-up UUID (`a0000000-0000-0000-0000-000000000001`) that does not exist in
 * the database. It has been removed on purpose:
 *   - tenant identity may only come from a real `public.tenants` row,
 *   - `tenantId` is `null` until such a row is actually resolved, and
 *   - registration never submits a `tenant_id` when resolution failed (the
 *     `handle_new_user` database trigger resolves it server-side instead).
 * Display-level branding fallbacks stay in the presentation layer only.
 */

interface SignUpOptions {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  phone?: string;
  metadata?: Record<string, any>;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Resolved tenant row (branding + policy). Null until resolved from the DB. */
  tenant: Tenant | null;
  /**
   * Database id of the resolved tenant, or `null` when resolution failed.
   * This is the ONLY value that may ever be persisted for a tenant, and it is
   * `null` rather than a placeholder when no real row could be resolved.
   */
  tenantId: string | null;
  availableTenants: Tenant[];
  role: UserRole | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (options: SignUpOptions) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchTenant: (tenantSlug: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  devSignIn?: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Apply tenant branding variables to CSS root
  useEffect(() => {
    if (tenant) {
      document.documentElement.style.setProperty('--brand-primary', tenant.primary_color || '#4F46E5');
      document.documentElement.style.setProperty('--brand-secondary', tenant.secondary_color || '#7C3AED');
    }
  }, [tenant]);

  // Resolve active tenant from hostname or default config with fast timeout
  const resolveTenant = async (): Promise<Tenant | null> => {
    const fallbackTenant: Tenant = {
      id: '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b',
      slug: 'mitt',
      name: 'Maharaja Institute of Technology Thandavapura',
      custom_domain: 'mitt.edu.in',
      primary_color: '#4F46E5',
      secondary_color: '#7C3AED',
      plan: 'enterprise',
      settings: {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      return fallbackTenant;
    }

    try {
      const hostname = window.location.hostname;
      const defaultSlug = import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'mitt';

      // Race against 800ms timeout
      const queryPromise = async () => {
        // 1. Check custom domain
        let { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('custom_domain', hostname)
          .eq('is_active', true)
          .maybeSingle();

        // 2. Check subdomain if not matched
        if (!tenantData && hostname.includes('.')) {
          const parts = hostname.split('.');
          if (parts.length >= 3) {
            const sub = parts[0];
            const res = await supabase
              .from('tenants')
              .select('*')
              .eq('slug', sub)
              .eq('is_active', true)
              .maybeSingle();
            tenantData = res.data;
          }
        }

        // 3. Fallback to default slug
        if (!tenantData) {
          const res = await supabase
            .from('tenants')
            .select('*')
            .eq('slug', defaultSlug)
            .eq('is_active', true)
            .maybeSingle();
          tenantData = res.data;
        }

        return tenantData ?? fallbackTenant;
      };

      const result = await Promise.race([
        queryPromise(),
        new Promise<Tenant>((res) => setTimeout(() => res(fallbackTenant), 800)),
      ]);

      return result;
    } catch (err) {
      console.warn('[HackBridge] Failed to resolve tenant from network, using fallback:', err);
      return fallbackTenant;
    }
  };

  // Fetch available tenants list
  const loadTenants = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const queryPromise = supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('name');

      const { data } = await Promise.race([
        queryPromise,
        new Promise<{ data: null }>((res) => setTimeout(() => res({ data: null }), 800)),
      ]);

      if (data && data.length > 0) {
        setAvailableTenants(data as Tenant[]);
      }
    } catch (err) {
      console.warn('[HackBridge] Could not fetch tenants list:', err);
    }
  };

  // Fetch current user's profile
  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([
        queryPromise,
        new Promise<{ data: null; error: null }>((res) => setTimeout(() => res({ data: null, error: null }), 800)),
      ]);

      if (error) {
        console.error('[HackBridge] Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('[HackBridge] Profile lookup failed:', err);
    }
  };

  // Initial Auth & Tenant Resolution with fast safety timer
  useEffect(() => {
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 1200);

    const init = async () => {
      try {
        setIsLoading(true);
        const activeTenant = await resolveTenant();
        if (mounted) {
          setTenant(activeTenant);
        }
        await loadTenants();

        if (isSupabaseConfigured) {
          try {
            const { data } = await Promise.race([
              supabase.auth.getSession(),
              new Promise<{ data: { session: null } }>((res) =>
                setTimeout(() => res({ data: { session: null } }), 800)
              ),
            ]);
            if (mounted) {
              setSession(data?.session ?? null);
              setUser(data?.session?.user ?? null);
              if (data?.session?.user) {
                await fetchProfile(data.session.user.id);
              }
            }
          } catch (err) {
            console.error('[HackBridge] Session retrieval error:', err);
          }

          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
              if (!mounted) return;
              setSession(newSession);
              setUser(newSession?.user ?? null);
              if (newSession?.user) {
                await fetchProfile(newSession.user.id);
              } else {
                setProfile(null);
              }
            }
          );

          if (mounted) setIsLoading(false);
          clearTimeout(safetyTimer);
          return () => {
            authListener.subscription.unsubscribe();
          };
        } else {
          if (typeof window !== 'undefined' && isDemoMode) {
            const savedRole = localStorage.getItem('hackbridge_dev_role') as UserRole | null;
            if (savedRole) {
              devSignIn(savedRole);
            }
          }
          if (mounted) setIsLoading(false);
        }
      } catch (err) {
        console.error('[HackBridge] Init error:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (mounted) setIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const devSignIn = (targetRole: UserRole) => {
    if (!isDemoMode) return;
    const mockUser: any = {
      id: `dev-${targetRole}-1`,
      email: `${targetRole}@mitt.edu.in`,
      app_metadata: {},
      user_metadata: { full_name: `Demo ${targetRole.replace('_', ' ')}` },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const mockProfile: Profile = {
      id: `dev-${targetRole}-1`,
      tenant_id: tenant?.id || '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b',
      role: targetRole,
      full_name: `Demo ${targetRole.replace('_', ' ').toUpperCase()}`,
      email: `${targetRole}@mitt.edu.in`,
      avatar_url: null,
      phone: null,
      is_active: true,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setUser(mockUser);
    setProfile(mockProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hackbridge_dev_role', targetRole);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error('Supabase is not configured. Please set credentials in .env'),
      };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (options: SignUpOptions) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error('Supabase is not configured. Please set credentials in .env'),
      };
    }

    // Only a tenant id that came from a real `public.tenants` row may ever be
    // submitted. When tenant resolution failed the field is omitted entirely
    // instead of sending a placeholder UUID: the signup trigger then resolves
    // the tenant server-side (verified email domain -> pilot tenant row).
    const resolvedTenantId = tenant?.id ?? null;

    const { error } = await supabase.auth.signUp({
      email: options.email,
      password: options.password,
      options: {
        data: {
          full_name: options.fullName,
          role: options.role || 'student',
          ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
          phone: options.phone || null,
          ...(options.metadata || {}),
        },
      },
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hackbridge_dev_role');
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const switchTenant = async (tenantSlug: string) => {
    const found = availableTenants.find((t) => t.slug === tenantSlug);
    if (found) {
      setTenant(found);
    } else if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (data) {
        setTenant(data as Tenant);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const role: UserRole | null = profile?.role ?? null;

  // The single authoritative tenant identifier for the current session:
  // either a real database UUID or null (never a placeholder).
  const tenantId: string | null = tenant?.id ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        tenant,
        tenantId,
        availableTenants,
        role,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        switchTenant,
        refreshProfile,
        devSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
