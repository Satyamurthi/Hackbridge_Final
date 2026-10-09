import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type RecoveryStatus = 'checking' | 'ready' | 'link-invalid' | 'unconfigured' | 'success';

/**
 * Password-recovery completion page (Supabase Auth supported flow).
 *
 * There is no bespoke token handling here: the client is created with
 * `detectSessionInUrl: true`, so when the user follows the emailed recovery
 * link Supabase parses the token, establishes the short-lived recovery session
 * and emits a `PASSWORD_RECOVERY` event. This page then calls
 * `supabase.auth.updateUser({ password })`.
 */
export const ResetPasswordPage: React.FC = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<RecoveryStatus>(
    isSupabaseConfigured ? 'checking' : 'unconfigured'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkErrored, setLinkErrored] = useState(false);

  // Detect the recovery session created from the emailed link.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    const hasLinkError =
      window.location.hash.includes('error_description') ||
      window.location.search.includes('error_description');

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && !!session)) {
        setStatus('ready');
      }
    });

    const resolveStatus = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          setStatus('ready');
        } else {
          setLinkErrored(hasLinkError);
          setStatus('link-invalid');
        }
      } catch (err) {
        console.error('[HackBridge] Recovery session lookup failed:', err);
        if (!cancelled) {
          setLinkErrored(true);
          setStatus('link-invalid');
        }
      }
    };

    resolveStatus();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');
    } catch (err: any) {
      setError(err?.message || 'The password could not be updated. Please request a new link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToSignIn = async () => {
    // End the recovery session so the user signs in with the new password.
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-600 text-white items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-200">
            H
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Set a New Password</h2>
          <p className="text-xs text-slate-500">
            Password recovery for{' '}
            <strong className="text-slate-700">{tenant?.name || 'HackBridge'}</strong>
          </p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6 sm:p-8 space-y-4">
            {/* Configuration unavailable — recovery is refused, never faked */}
            {status === 'unconfigured' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                Password recovery is unavailable because this deployment is not connected to Supabase.
              </div>
            )}

            {status === 'checking' && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Verifying your recovery link...
              </div>
            )}

            {status === 'link-invalid' && (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Recovery link required</h3>
                <p className="text-xs text-slate-500">
                  {linkErrored
                    ? 'The recovery link was rejected by Supabase — it has expired or was already used.'
                    : 'Open the password reset link from your email in this browser to continue.'}{' '}
                  Request a fresh reset email if needed.
                </p>
                <Link to="/forgot-password">
                  <Button size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                    Request a New Link
                  </Button>
                </Link>
              </div>
            )}

            {status === 'ready' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="New Password *"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

                <Input
                  label="Confirm New Password *"
                  type="password"
                  placeholder="Re-enter the new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  isLoading={isSubmitting}
                >
                  Update Password
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            {status === 'success' && (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Password updated
                </h3>
                <p className="text-xs text-slate-500">
                  Your new password is active. Sign in again to continue.
                </p>
                <Button
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  onClick={handleReturnToSignIn}
                >
                  Continue to Sign In
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-center text-xs text-slate-500">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};