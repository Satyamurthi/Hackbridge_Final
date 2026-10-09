import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { UserRole } from '../../types/database';

export const RegisterPage: React.FC = () => {
  const { signUp, tenant, tenantId, isConfigured } = useAuth();

  const [role, setRole] = useState<UserRole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Student specific
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [gradYear, setGradYear] = useState('2027');

  // Company specific
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');

  // Evaluator specific
  const [affiliation, setAffiliation] = useState('');
  const [expertise, setExpertise] = useState('Full Stack / Cloud');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fail closed: registration requires a live Supabase connection so that the
    // database trigger can resolve the role and tenant server-side.
    if (!isConfigured) {
      setError('Registration is unavailable because this deployment is not connected to Supabase.');
      return;
    }

    setIsLoading(true);

    try {
      let metadata: Record<string, any> = {};

      if (role === 'student') {
        metadata = { usn, department, year: gradYear };
      } else if (role === 'company_rep') {
        metadata = { company_name: companyName, designation };
      } else if (role === 'evaluator') {
        metadata = { affiliation, expertise: expertise.split(',').map((s) => s.trim()) };
      }

      const { error: signUpError } = await signUp({
        email,
        password,
        fullName,
        role,
        phone,
        metadata,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Registration Successful</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Your account has been registered for <strong className="text-slate-800">{tenant?.name}</strong>. Please check your email to verify your address or sign in directly.
          </p>
          <div className="pt-4">
            <Link to="/login">
              <Button size="lg" className="w-full bg-indigo-600 text-white font-semibold">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Create Your Account
          </h2>
          <p className="text-xs text-slate-500">
            Join the HackBridge network at <strong className="text-slate-800">{tenant?.name || 'HackBridge'}</strong>
          </p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6 sm:p-8 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Tenant resolution notice (Phase 1.5). The tenant comes from the
                `tenants` table; when it cannot be resolved we never substitute a
                placeholder id - the database trigger resolves it server-side. */}
            {isConfigured && !tenantId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                Your institution tenant could not be resolved, so the account will be created without a
                tenant assignment. A college admin can assign it afterwards.
              </div>
            )}
            {!isConfigured && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
                Registration is unavailable because this deployment is not connected to Supabase.
              </div>
            )}

            {/* Stakeholder Role Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Select Your Stakeholder Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'student', label: '🎓 Student' },
                  { id: 'company_rep', label: '🏢 Company' },
                  { id: 'evaluator', label: '⚖️ Evaluator' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as UserRole)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      role === item.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name *"
                  placeholder="e.g. Arjun Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <Input
                label="Email Address *"
                type="email"
                placeholder={role === 'student' ? 'usn@example.com' : 'name@organization.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Password *"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />

              {/* Dynamic Role-Specific Metadata Fields */}
              {role === 'student' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Student Details
                  </p>
                  <Input
                    label="University Seat Number (USN) *"
                    placeholder="1RV22CS045"
                    value={usn}
                    onChange={(e) => setUsn(e.target.value)}
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Department
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option>Computer Science</option>
                        <option>Information Science</option>
                        <option>Electronics & Comm</option>
                        <option>Artificial Intelligence</option>
                        <option>Mechanical Eng</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Graduation Year
                      </label>
                      <select
                        value={gradYear}
                        onChange={(e) => setGradYear(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option>2025</option>
                        <option>2026</option>
                        <option>2027</option>
                        <option>2028</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {role === 'company_rep' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Company Information
                  </p>
                  <Input
                    label="Company / Enterprise Name *"
                    placeholder="e.g. Bosch Global, Razorpay"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                  <Input
                    label="Your Designation *"
                    placeholder="e.g. Lead Architect, Tech Recruiter"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    required
                  />
                </div>
              )}

              {role === 'evaluator' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Evaluator Credentials
                  </p>
                  <Input
                    label="Academic / Industry Affiliation *"
                    placeholder="e.g. Professor at your institution / Senior Engineer at Google"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    required
                  />
                  <Input
                    label="Domain Expertise (comma-separated)"
                    placeholder="e.g. Distributed Systems, AI/ML, Cloud"
                    value={expertise}
                    onChange={(e) => setExpertise(e.target.value)}
                  />
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                isLoading={isLoading}
              >
                Complete Registration
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="ml-1 font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
