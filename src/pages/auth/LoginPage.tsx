import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isDemoMode } from '../../lib/supabase';
import { ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { UserRole } from '../../types/database';

export const LoginPage: React.FC = () => {
  const { signIn, devSignIn, tenant, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const previewTargets: Array<{ role: UserRole; label: string; path: string }> = [
    { role: 'college_admin', label: 'College Admin', path: '/admin' },
    { role: 'student', label: 'Student Portal', path: '/student' },
    { role: 'evaluator', label: 'Evaluator Desk', path: '/evaluator' },
    { role: 'company_rep', label: 'Company Portal', path: '/company' },
  ];

  const handleDevRolePreview = (targetRole: UserRole) => {
    if (!isDemoMode) return;
    devSignIn?.(targetRole);
    const target = previewTargets.find((item) => item.role === targetRole);
    navigate(target ? target.path : '/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fail closed in production. In local development without Supabase credentials,
    // allow entering the respective stakeholder preview seamlessly.
    if (!isConfigured) {
      if (isDemoMode) {
        const lower = email.toLowerCase();
        const detectedRole: UserRole = lower.includes('admin')
          ? 'college_admin'
          : lower.includes('eval')
            ? 'evaluator'
            : lower.includes('comp')
              ? 'company_rep'
              : 'student';
        handleDevRolePreview(detectedRole);
        return;
      }
      setError('Sign-in is unavailable because this deployment is not connected to Supabase.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
      } else {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-600 text-white items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-200">
            H
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Sign In to HackBridge
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Tenant: <strong className="text-slate-800">{tenant?.name || 'HackBridge'}</strong>
          </p>
        </div>

        {/* Card */}
        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6 sm:p-8 space-y-5">
            {!isConfigured && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold text-amber-900">Local Dev Preview Mode</p>
                <p>
                  To connect live Supabase Auth, set <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
                </p>
                <p className="text-amber-700">
                  For immediate testing, click any <strong>Dev Preview</strong> button below or submit the form.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Institution / College Email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                isLoading={isLoading}
              >
                {isConfigured ? 'Sign In with Supabase' : 'Enter Dev Preview'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Development-only stakeholder shortcuts. Gated on import.meta.env.DEV
                (inlined as false by vite build), so the block is compiled out of
                production bundles; the handler also refuses to navigate. */}
            {isDemoMode && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Dev preview · stakeholder workspaces (no auth)</span>
                <Sparkles className="w-3 h-3 text-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleDevRolePreview('college_admin')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left font-medium text-slate-700 transition-colors"
                >
                  🛡️ College Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleDevRolePreview('student')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left font-medium text-slate-700 transition-colors"
                >
                  🎓 Student Portal
                </button>
                <button
                  type="button"
                  onClick={() => handleDevRolePreview('evaluator')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left font-medium text-slate-700 transition-colors"
                >
                  ⚖️ Evaluator Desk
                </button>
                <button
                  type="button"
                  onClick={() => handleDevRolePreview('company_rep')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left font-medium text-slate-700 transition-colors"
                >
                  🏢 Company Portal
                </button>
              </div>
            </div>
            )}
          </CardContent>

          <CardFooter className="justify-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="ml-1 font-semibold text-indigo-600 hover:text-indigo-700">
              Register here
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
