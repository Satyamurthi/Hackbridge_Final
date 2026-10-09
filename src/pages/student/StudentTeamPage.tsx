import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Copy,
  Check,
  PlusCircle,
  LogIn,
  AlertTriangle,
  RefreshCw,
  LogOut,
  FileQuestion,
  Tag,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { fetchTenantHackathons } from '../../lib/hackathons';
import {
  fetchMyTeam,
  fetchTeamByInviteCode,
  createTeam,
  joinTeamWithInviteCode,
  leaveTeam,
  updateTeamSettings,
  TEAMS_MIGRATION_FILE,
  type TeamResult,
} from '../../lib/teams';
import type { Hackathon, TeamWithDetails } from '../../types/database';

export const StudentTeamPage: React.FC = () => {
  const { user, tenant, tenantId } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [myTeam, setMyTeam] = useState<TeamWithDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mode: 'create' | 'join'
  const [formMode, setFormMode] = useState<'create' | 'join'>('create');

  // Create form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [previewTeam, setPreviewTeam] = useState<TeamWithDetails | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── 1. Load Hackathons & Current Team ───────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const effectiveTenantId = tenantId || tenant?.id || '';
    const effectiveUserId = user.id;

    setIsLoading(true);
    setError(null);

    try {
      const { hackathons: hList, error: hError } = await fetchTenantHackathons(effectiveTenantId);
      if (hError) setError(hError);

      const availableHackathons = hList ?? [];
      setHackathons(availableHackathons);

      // Pick active or first hackathon
      let activeHackathon = availableHackathons.find(
        (h) => h.status === 'registration' || h.status === 'problem_intake' || h.status === 'hacking'
      );
      if (!activeHackathon && availableHackathons.length > 0) {
        activeHackathon = availableHackathons[0];
      }

      const currentHackathonId = selectedHackathonId || activeHackathon?.id || '';
      if (!selectedHackathonId && currentHackathonId) {
        setSelectedHackathonId(currentHackathonId);
      }

      if (currentHackathonId) {
        const { team, error: tError } = await fetchMyTeam(currentHackathonId, effectiveUserId);
        if (tError) setError(tError);
        setMyTeam(team);
      }
    } catch (err: any) {
      console.warn('[StudentTeamPage] Error loading data:', err);
      setError(err?.message || 'Unable to load team status.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user?.id, selectedHackathonId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── 2. Handle Hackathon Change ─────────────────────────────────────────────

  const handleHackathonChange = async (newId: string) => {
    setSelectedHackathonId(newId);
    if (user?.id && newId) {
      setIsLoading(true);
      setError(null);
      const { team, error: tError } = await fetchMyTeam(newId, user.id);
      if (tError) setError(tError);
      setMyTeam(team);
      setIsLoading(false);
    }
  };

  // ── 3. Team Actions ────────────────────────────────────────────────────────

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHackathonId) {
      setError('Please select a hackathon first.');
      return;
    }
    if (!newTeamName.trim()) {
      setError('Team name is required.');
      return;
    }

    setActionLoading(true);
    setError(null);

    const slugPrefix = tenant?.slug || 'MITT';
    const result: TeamResult = await createTeam(
      selectedHackathonId,
      newTeamName,
      newTeamDescription,
      slugPrefix
    );

    setActionLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setMyTeam(result.team);
      setNewTeamName('');
      setNewTeamDescription('');
    }
  };

  const handlePreviewJoinCode = async (code: string) => {
    setJoinCode(code);
    setPreviewError(null);
    if (code.trim().length >= 4) {
      const result = await fetchTeamByInviteCode(code);
      if (result.error) {
        setPreviewError(result.error);
        setPreviewTeam(null);
      } else {
        setPreviewTeam(result.team);
      }
    } else {
      setPreviewTeam(null);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!joinCode.trim()) {
      setError('Please enter a team invite code.');
      return;
    }

    setActionLoading(true);
    setError(null);

    const result = await joinTeamWithInviteCode(joinCode, user.id);
    setActionLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setMyTeam(result.team);
      setJoinCode('');
      setPreviewTeam(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!myTeam || !user?.id) return;
    const isLeader = myTeam.created_by === user.id;
    const confirmMessage = isLeader
      ? 'As the leader, leaving will disband and delete this team. Are you sure?'
      : 'Are you sure you want to leave this team?';

    if (!window.confirm(confirmMessage)) return;

    setActionLoading(true);
    setError(null);

    const result = await leaveTeam(myTeam.id, user.id, isLeader);
    setActionLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setMyTeam(null);
    }
  };

  const handleToggleRecruitment = async () => {
    if (!myTeam) return;
    setActionLoading(true);
    const newStatus = !myTeam.is_open;
    const result = await updateTeamSettings(myTeam.id, { is_open: newStatus });
    setActionLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setMyTeam({ ...myTeam, is_open: newStatus });
    }
  };

  const copyInviteCode = () => {
    if (!myTeam?.invite_code) return;
    navigator.clipboard.writeText(myTeam.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentHackathon = hackathons.find((h) => h.id === selectedHackathonId);
  const isLeader = myTeam?.created_by === user?.id;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">My Team &amp; Code</h1>
            <Badge variant="default" className="bg-indigo-600 text-white">
              Registration Open
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Form or join a team for <strong className="text-slate-800">{tenant?.name || 'MITT'}</strong> hackathons.
          </p>
        </div>

        {/* Hackathon Selector */}
        {hackathons.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Event:</span>
            <Select
              value={selectedHackathonId}
              onChange={(e) => handleHackathonChange(e.target.value)}
              className="text-xs min-w-[200px]"
            >
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} ({h.status.replace('_', ' ')})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Error / Migration Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <p className="font-semibold">Team Operation Error</p>
            <p>{error}</p>
            {error.includes('does not exist') && (
              <p className="text-[11px] font-mono text-rose-700">
                Run {TEAMS_MIGRATION_FILE} in the Supabase SQL Editor.
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-xs">Loading team status...</span>
        </div>
      ) : myTeam ? (
        /* ── ACTIVE TEAM VIEW ── */
        <div className="space-y-6">
          {/* Hero Team Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    {myTeam.status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-slate-300 border-slate-600">
                    {myTeam.hackathon?.title || currentHackathon?.title || 'Hackathon Team'}
                  </Badge>
                  {myTeam.is_open ? (
                    <Badge variant="outline" className="text-blue-300 border-blue-500/30 bg-blue-500/10">
                      Recruiting Members
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-300 border-amber-500/30 bg-amber-500/10">
                      Team Roster Closed
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold">{myTeam.name}</h2>
                {myTeam.description && (
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    {myTeam.description}
                  </p>
                )}
              </div>

              {/* Shareable Invite Code Box */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 flex flex-col items-center gap-2 min-w-[220px]">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
                  Shareable Invite Code
                </span>
                <span className="text-2xl font-mono font-black tracking-wider text-amber-300">
                  {myTeam.invite_code}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copyInviteCode}
                  className="w-full text-xs font-semibold gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
            </div>

            {/* Sub-bar: Team Controls */}
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-300">
                Team Size: <strong>{myTeam.members.length}</strong> /{' '}
                {myTeam.hackathon?.max_team_size || currentHackathon?.max_team_size || 4} members
              </span>

              <div className="flex items-center gap-2">
                {isLeader && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleRecruitment}
                    disabled={actionLoading}
                    className="text-xs bg-white/5 border-white/20 text-white hover:bg-white/15"
                  >
                    {myTeam.is_open ? 'Close Recruitment' : 'Open Recruitment'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLeaveTeam}
                  disabled={actionLoading}
                  className="text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  {isLeader ? 'Disband Team' : 'Leave Team'}
                </Button>
              </div>
            </div>
          </div>

          {/* Grid: Members & Problem Statement */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Members Roster (2 Cols) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Team Roster ({myTeam.members.length})
                  </div>
                  <span className="text-xs font-normal text-slate-400">
                    Max: {myTeam.hackathon?.max_team_size || currentHackathon?.max_team_size || 4}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myTeam.members.map((member) => {
                  const isCurrent = member.user_id === user?.id;
                  const isMemLeader = member.role === 'leader';
                  const usn = member.profile?.metadata?.usn;
                  const dept = member.profile?.metadata?.department;

                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'border-indigo-200 bg-indigo-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            isMemLeader
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {member.profile?.full_name?.slice(0, 2) || 'ST'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {member.profile?.full_name || 'Student Innovator'}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {member.profile?.email}
                            {usn && ` · USN: ${usn}`}
                            {dept && ` · ${dept}`}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={isMemLeader ? 'default' : 'secondary'}
                        className="capitalize text-[10px] flex-shrink-0"
                      >
                        {member.role}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Problem Statement Card (1 Col) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-indigo-600" />
                  Problem Statement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {myTeam.problem_statement ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize">
                          {myTeam.problem_statement.domain || 'General'}
                        </Badge>
                        <Badge variant="secondary" className="capitalize">
                          {myTeam.problem_statement.difficulty}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-slate-900 leading-snug">
                        {myTeam.problem_statement.title}
                      </h4>
                      <p className="text-slate-600 line-clamp-3 text-[11px] leading-relaxed">
                        {myTeam.problem_statement.problem_description}
                      </p>
                    </div>

                    {isLeader && (
                      <Link to="/student/problems">
                        <Button size="sm" variant="outline" className="w-full text-xs">
                          Change Problem Statement
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4">
                    <Tag className="w-8 h-8 text-slate-300 mx-auto" />
                    <div>
                      <p className="font-semibold text-slate-700">No Problem Chosen</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Your team needs an approved problem statement to compete.
                      </p>
                    </div>
                    <Link to="/student/problems">
                      <Button size="sm" className="bg-indigo-600 text-white font-semibold text-xs">
                        Browse &amp; Select Problem
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ── NO TEAM VIEW (CREATE OR JOIN TABS) ── */
        <div className="max-w-xl mx-auto space-y-6 pt-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-slate-900">You are not in a team yet</h2>
            <p className="text-xs text-slate-500">
              Create a new team to recruit teammates, or enter an invite code to join an existing team.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormMode('create')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                formMode === 'create'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Create New Team
            </button>
            <button
              type="button"
              onClick={() => setFormMode('join')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                formMode === 'join'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Join with Code
            </button>
          </div>

          {/* Form Card */}
          <Card>
            <CardContent className="p-6">
              {formMode === 'create' ? (
                /* Create Team Form */
                <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Team Name *
                    </label>
                    <Input
                      placeholder="e.g., QuantumCoders, NeuralByte"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Team Vision / Description (Optional)
                    </label>
                    <Textarea
                      placeholder="Briefly describe your team focus, skills, or idea..."
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Team Formation Rules:
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-indigo-700 space-y-0.5">
                      <li>You will automatically be designated as the Team Leader.</li>
                      <li>A shareable invite code will be generated immediately.</li>
                      <li>You can belong to only one team for this hackathon.</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    disabled={actionLoading || !newTeamName.trim()}
                    className="w-full bg-indigo-600 text-white font-semibold py-2.5"
                  >
                    {actionLoading ? 'Creating Team...' : 'Create Team & Get Code'}
                  </Button>
                </form>
              ) : (
                /* Join Team Form */
                <form onSubmit={handleJoinTeam} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Enter Team Invite Code *
                    </label>
                    <Input
                      placeholder="e.g., MITT-8821"
                      value={joinCode}
                      onChange={(e) => handlePreviewJoinCode(e.target.value)}
                      className="font-mono uppercase text-sm tracking-wider"
                      required
                    />
                  </div>

                  {previewError && (
                    <p className="text-rose-600 text-[11px]">{previewError}</p>
                  )}

                  {previewTeam && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{previewTeam.name}</span>
                        <Badge variant={previewTeam.is_open ? 'success' : 'outline'}>
                          {previewTeam.is_open ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Members: {previewTeam.members?.length ?? 1} / {previewTeam.hackathon?.max_team_size || 4}
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={actionLoading || !joinCode.trim()}
                    className="w-full bg-indigo-600 text-white font-semibold py-2.5"
                  >
                    {actionLoading ? 'Joining...' : 'Join Team'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
