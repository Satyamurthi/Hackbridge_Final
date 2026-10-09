import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const ForgotPasswordPage: React.FC = () => {
  const { tenant, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Fail closed: without Supabase there is no recovery flow to invoke, and we
    // must never pretend that a reset email was dispatched.
    if (!isConfigured) {
      setError('Password recovery is unavailable because this deployment is not connected to Supabase.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // Must also be registered under Supabase Auth -> URL Configuration ->
        // Redirect URLs, otherwise Supabase falls back to the Site URL.
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
          <p className="text-xs text-slate-500">
            Enter your college email for <strong className="text-slate-700">{tenant?.name || 'HackBridge'}</strong>
          </p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6 sm:p-8 space-y-4">
            {submitted ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Check Your Inbox</h3>
                <p className="text-xs text-slate-500">
                  If an account exists for <strong className="text-slate-800">{email}</strong>, a password reset link has been dispatched.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {error}
                  </p>
                )}
                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  isLoading={isLoading}
                >
                  Send Password Reset Link
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center text-xs text-slate-500">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-700">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
