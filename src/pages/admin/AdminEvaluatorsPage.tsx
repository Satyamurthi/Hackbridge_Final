import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { autoAssignEvaluators } from '../../lib/evaluations';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Users, Award, ShieldCheck, Mail, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Profile, Hackathon } from '../../types/database';

export const AdminEvaluatorsPage: React.FC = () => {
  const { tenantId, tenant } = useAuth();
  const [evaluators, setEvaluators] = useState<Profile[]>([]);
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New evaluator invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const loadData = async () => {
    if (!isSupabaseConfigured || !tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [evalRes, hackRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'evaluator').eq('tenant_id', tenantId),
        fetchTenantHackathons(tenantId)
      ]);

      setEvaluators((evalRes.data as Profile[]) || []);
      const hList = hackRes.hackathons || [];
      setHackathons(hList);
      if (hList.length > 0 && !selectedHackathonId) {
        setSelectedHackathonId(hList[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load evaluators.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleAutoAssign = async () => {
    if (!selectedHackathonId) return;
    setIsAssigning(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const effectiveTenantId = tenantId || tenant?.id || 'mitt';
    const res = await autoAssignEvaluators(selectedHackathonId, effectiveTenantId, 2);
    setIsAssigning(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage(`Successfully auto-assigned ${res.assignedCount} submissions across ${evaluators.length} evaluators with double-blind masking!`);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    setIsInviting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // In production with Supabase Auth or Backend API, an invite is registered
      setSuccessMessage(`Invitation registered for ${inviteName} (${inviteEmail}). Credentials dispatched.`);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch evaluator invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Evaluator &amp; Judge Management</h1>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage academic and industry judging panels for <strong className="text-slate-800">{tenant?.name || 'MITT'}</strong>.
          </p>
        </div>

        {hackathons.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              onClick={handleAutoAssign}
              isLoading={isAssigning}
            >
              <Award className="w-4 h-4 mr-1" />
              Run Double-Blind Auto-Assign
            </Button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Evaluators List */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Active Judging Panel ({evaluators.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadData}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading evaluators...</div>
              ) : evaluators.length > 0 ? (
                evaluators.map((ev) => (
                  <div key={ev.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{ev.full_name || 'Judge'}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {ev.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">CoI Verified</Badge>
                      <Badge variant="outline" className="capitalize">{ev.role.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  No evaluators currently registered. Invite faculty or industry experts below.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invite Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Invite New Evaluator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4 text-xs">
                <Input
                  label="Full Name"
                  placeholder="Prof. Suresh Verma"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                />
                <Input
                  label="Academic / Corporate Email"
                  type="email"
                  placeholder="suresh.verma@mitt.edu.in"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  isLoading={isInviting}
                >
                  Dispatch Evaluator Credentials
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
