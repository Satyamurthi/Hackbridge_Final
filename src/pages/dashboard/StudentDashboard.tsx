import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  FolderGit2,
  Sparkles,
  PlusCircle,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { fetchMyTeam } from '../../lib/teams';
import { fetchTeamSubmission } from '../../lib/submissions';
import type { TeamWithDetails, SubmissionWithDetails } from '../../types/database';

export const StudentDashboard: React.FC = () => {
  const { user, profile, tenant, tenantId } = useAuth();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [submission, setSubmission] = useState<SubmissionWithDetails | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const effectiveUserId = user.id;
    const effectiveTenantId = tenantId || tenant?.id || '';

    // Load active hackathon & user's team
    fetchTenantHackathons(effectiveTenantId).then(({ hackathons }) => {
      const activeH = (hackathons ?? []).find(
        (h) => h.status === 'registration' || h.status === 'problem_intake' || h.status === 'hacking'
      ) || (hackathons ?? [])[0];

      if (activeH) {
        fetchMyTeam(activeH.id, effectiveUserId).then(({ team: myTeam }) => {
          setTeam(myTeam);

          if (myTeam) {
            setLoadingSub(true);
            fetchTeamSubmission(myTeam.id, 1).then(({ submission: mySub }) => {
              setSubmission(mySub);
              setLoadingSub(false);
            });
          }
        });
      }
    });
  }, [tenantId, user?.id]);

  const copyCode = () => {
    if (!team?.invite_code) return;
    navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Student Innovation Portal</h1>
            <Badge variant="default" className="capitalize">
              {profile?.role?.replace('_', ' ') || 'Student'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800">{profile?.full_name || 'Innovator'}</strong> · {tenant?.name || 'MITT'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {team ? (
            <Badge variant="success" className="capitalize">
              Team: {team.name} ({team.status})
            </Badge>
          ) : (
            <Badge variant="outline">No Team Registered</Badge>
          )}
        </div>
      </div>

      {/* Team Card (Real Data from Phase 4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                {team ? (
                  <>
                    Team Information: <span className="text-indigo-600 font-bold">{team.name}</span>
                  </>
                ) : (
                  'Team Information'
                )}
              </CardTitle>
              {team && (
                <button
                  onClick={copyCode}
                  className="text-xs font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 flex items-center gap-1.5 transition-colors"
                  title="Click to copy invite code"
                >
                  Code: {team.invite_code}
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {team ? (
              <>
                {/* Selected Problem */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">Problem Statement Chosen:</p>
                    <p className="text-slate-600 mt-0.5 truncate">
                      {team.problem_statement?.title || 'No problem statement selected yet.'}
                    </p>
                    {team.problem_statement?.domain && (
                      <p className="text-[11px] text-indigo-600 font-medium">
                        Domain: {team.problem_statement.domain}
                      </p>
                    )}
                  </div>
                  <Link to="/student/problems">
                    <Button size="sm" variant="outline" className="text-xs flex-shrink-0">
                      {team.problem_statement ? 'Change' : 'Select'}
                    </Button>
                  </Link>
                </div>

                {/* Team Members */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-700">
                      Team Members ({team.members.length}/
                      {team.hackathon?.max_team_size || 4}):
                    </p>
                    <Link to="/student/team" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5">
                      Manage team <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {team.members.map((member) => {
                      const isCurrent = member.user_id === user?.id;
                      const isMemLeader = member.role === 'leader';
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2.5 rounded-md bg-white border border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {member.profile?.full_name || 'Team Member'}
                              {isMemLeader && ' (Leader)'}
                            </span>
                            {isCurrent && (
                              <Badge variant="default" className="text-[10px]">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 capitalize">
                            {member.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Empty Team State */
              <div className="p-6 text-center space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">You have not joined a team yet</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5 max-w-sm mx-auto">
                    Form a new team or join with an invite code to begin working on problem statements.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Link to="/student/team">
                    <Button size="sm" className="bg-indigo-600 text-white font-semibold text-xs">
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      Create or Join Team
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Talent Profile Card (Sample Data - Phase 9 Scope) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Verified Talent Profile
              </CardTitle>
              <Badge variant="secondary" className="text-[9px]">Sample</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-slate-500">
              Your hackathon performance directly builds your cross-college industry talent profile.
            </p>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>Percentile Ranking</span>
                <span>Top 5%</span>
              </div>
              <p className="text-[11px] text-purple-600">
                Badge: Winner 🏆 (Ready for corporate scouting)
              </p>
            </div>
            <Link to="/student/portfolio">
              <Button size="sm" variant="outline" className="w-full text-xs">
                View My Talent Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Project Submission Desk (Real Data - Phase 5) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-emerald-600" />
              Project Submission (Multi-Format)
            </CardTitle>
            {submission?.is_final ? (
              <Badge variant="success">Finalized &amp; Locked</Badge>
            ) : submission ? (
              <Badge variant="default">Draft in Progress</Badge>
            ) : (
              <Badge variant="outline">Not Submitted</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {loadingSub ? (
            <div className="py-6 text-center text-slate-400">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[11px]">Checking submission status...</p>
            </div>
          ) : submission ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 border border-slate-200 rounded-lg">
                  <p className="font-semibold text-slate-700 truncate">{submission.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {submission.abstract}
                  </p>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg">
                  <p className="font-semibold text-slate-700">Code Repository</p>
                  <p className="text-[11px] text-indigo-600 mt-1 truncate">
                    {submission.repo_url || <span className="text-slate-400 italic">No repo URL added</span>}
                  </p>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg">
                  <p className="font-semibold text-slate-700">Live Demo / Deployed App</p>
                  <p className="text-[11px] text-indigo-600 mt-1 truncate">
                    {submission.demo_url || <span className="text-slate-400 italic">No demo URL added</span>}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {submission.is_final
                    ? `Finalized on ${new Date(submission.submitted_at).toLocaleString()}`
                    : `Last saved ${new Date(submission.last_edited_at).toLocaleTimeString()}`}
                </span>
                <Link to="/student/submissions">
                  <Button size="sm" variant={submission.is_final ? 'outline' : 'primary'} className="text-xs">
                    {submission.is_final ? 'View Submission Receipt' : 'Continue Editing Draft'}
                  </Button>
                </Link>
              </div>
            </div>
          ) : team ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-800">No project submission draft created yet</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Submit your team's code repository, live demo, and presentation slides to enter evaluation.
                </p>
              </div>
              <Link to="/student/submissions" className="flex-shrink-0">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                  <FolderGit2 className="w-3.5 h-3.5 mr-1" />
                  Open Submission Desk
                </Button>
              </Link>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
              <p className="text-xs">Join or create a team to unlock project submissions.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
