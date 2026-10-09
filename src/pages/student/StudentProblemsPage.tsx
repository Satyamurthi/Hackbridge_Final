import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileQuestion,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { fetchPublishedProblemStatements } from '../../lib/problemStatements';
import { fetchMyTeam, selectTeamProblem } from '../../lib/teams';
import type { Hackathon, ProblemStatement, TeamWithDetails } from '../../types/database';

export const StudentProblemsPage: React.FC = () => {
  const { user, tenant, tenantId } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [myTeam, setMyTeam] = useState<TeamWithDetails | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedDomain, setSelectedDomain] = useState('all');

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // ── Load Hackathons, Problems & Team ───────────────────────────────────────

  const loadData = useCallback(async () => {

    setIsLoading(true);
    setError(null);

    // 1. Fetch hackathons
    const effectiveTenantId = tenantId || tenant?.id || '';
    const effectiveUserId = user?.id || '';

    try {
      const { hackathons: hList, error: hError } = await fetchTenantHackathons(effectiveTenantId);
      if (hError) setError(hError);

      const availableHackathons = hList ?? [];
      setHackathons(availableHackathons);

      const currentHackathonId = selectedHackathonId || availableHackathons[0]?.id || '';
      if (!selectedHackathonId && currentHackathonId) {
        setSelectedHackathonId(currentHackathonId);
      }

      if (currentHackathonId) {
        // 2. Fetch published problems for this hackathon
        const { problemStatements: psList, error: psError } =
          await fetchPublishedProblemStatements(currentHackathonId);
        if (psError) setError(psError);
        setProblemStatements(psList ?? []);

        // 3. Fetch user's team
        const { team } = await fetchMyTeam(currentHackathonId, effectiveUserId);
        setMyTeam(team);
      }
    } catch (err: any) {
      console.warn('[StudentProblemsPage] Error loading data:', err);
      setError(err?.message || 'Unable to load problem statements.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, user?.id, selectedHackathonId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── Handle Hackathon Switch ────────────────────────────────────────────────

  const handleHackathonChange = async (newId: string) => {
    setSelectedHackathonId(newId);
    setIsLoading(true);
    setError(null);

    const { problemStatements: psList, error: psError } =
      await fetchPublishedProblemStatements(newId);
    if (psError) setError(psError);
    setProblemStatements(psList ?? []);

    if (user?.id) {
      const { team } = await fetchMyTeam(newId, user.id);
      setMyTeam(team);
    }

    setIsLoading(false);
  };

  // ── Select Problem for Team ────────────────────────────────────────────────

  const handleSelectProblem = async (problemId: string) => {
    if (!myTeam) return;
    setActionLoadingId(problemId);
    setError(null);
    setSuccessNotice(null);

    const result = await selectTeamProblem(myTeam.id, problemId);
    setActionLoadingId(null);

    if (result.error) {
      setError(result.error);
    } else {
      setMyTeam({
        ...myTeam,
        problem_id: problemId,
        problem_statement: problemStatements.find((p) => p.id === problemId) ?? null,
      });
      setSuccessNotice('Problem statement selected successfully for your team!');
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  // ── Filtered List ──────────────────────────────────────────────────────────

  const filteredProblems = problemStatements.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.problem_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.domain && p.domain.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDifficulty =
      selectedDifficulty === 'all' || p.difficulty === selectedDifficulty;

    const matchesDomain =
      selectedDomain === 'all' || (p.domain && p.domain.toLowerCase() === selectedDomain.toLowerCase());

    return matchesSearch && matchesDifficulty && matchesDomain;
  });

  const domains = Array.from(
    new Set(problemStatements.map((p) => p.domain).filter(Boolean))
  ) as string[];

  const isLeader = myTeam?.created_by === user?.id;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Problem Statements Directory</h1>
            <Badge variant="default" className="bg-indigo-600 text-white">
              Published Challenges
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified industry challenges submitted by company partners for{' '}
            <strong className="text-slate-800">{tenant?.name || 'MITT'}</strong> hackathons.
          </p>
        </div>

        {/* Hackathon Selector */}
        {hackathons.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Hackathon:</span>
            <Select
              value={selectedHackathonId}
              onChange={(e) => handleHackathonChange(e.target.value)}
              className="text-xs min-w-[200px]"
            >
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Team Status Banner */}
      {myTeam ? (
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-950">
                Team: {myTeam.name} ({myTeam.members.length} members)
              </p>
              <p className="text-[11px] text-indigo-700">
                {myTeam.problem_id ? (
                  <>
                    Current Selection:{' '}
                    <strong>
                      {myTeam.problem_statement?.title || 'Problem selected'}
                    </strong>
                  </>
                ) : (
                  'No problem statement selected yet.'
                )}
              </p>
            </div>
          </div>

          <Link to="/student/team">
            <Button size="sm" variant="outline" className="text-xs border-indigo-300 text-indigo-700">
              Manage Team Roster
            </Button>
          </Link>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2.5 text-xs">
            <Users className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>
              You need to form or join a team before you can lock in a problem statement.
            </span>
          </div>
          <Link to="/student/team">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs">
              Go to My Team
            </Button>
          </Link>
        </div>
      )}

      {/* Notifications */}
      {successNotice && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search problems, keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <Select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="text-xs"
        >
          <option value="all">All Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </Select>

        <Select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="text-xs"
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
      </div>

      {/* Problems List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-xs">Loading problem statements...</span>
        </div>
      ) : filteredProblems.length === 0 ? (
        <div className="text-center py-12 p-6 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-2">
          <FileQuestion className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-xs text-slate-700">No problem statements found</p>
          <p className="text-[11px] text-slate-500">
            {problemStatements.length === 0
              ? 'No problem statements have been approved and published for this hackathon yet.'
              : 'Try clearing your filters to see more results.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProblems.map((problem) => {
            const isSelectedByMyTeam = myTeam?.problem_id === problem.id;

            return (
              <Card
                key={problem.id}
                className={`transition-all ${
                  isSelectedByMyTeam ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' : 'hover:border-slate-300'
                }`}
              >
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {problem.domain && (
                          <Badge variant="outline" className="capitalize">
                            {problem.domain}
                          </Badge>
                        )}
                        <Badge
                          variant={
                            problem.difficulty === 'easy'
                              ? 'success'
                              : problem.difficulty === 'hard'
                              ? 'danger'
                              : 'secondary'
                          }
                          className="capitalize"
                        >
                          {problem.difficulty}
                        </Badge>
                        {problem.datasets_provided && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Dataset Provided
                          </Badge>
                        )}
                        {problem.hiring_potential && problem.hiring_potential !== 'none' && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Hiring Intent
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {problem.title}
                      </h3>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      {isSelectedByMyTeam ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                          <Check className="w-3.5 h-3.5" />
                          Selected for Your Team
                        </span>
                      ) : (
                        myTeam && isLeader && (
                          <Button
                            size="sm"
                            onClick={() => handleSelectProblem(problem.id)}
                            disabled={actionLoadingId === problem.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs whitespace-nowrap"
                          >
                            {actionLoadingId === problem.id ? 'Selecting...' : 'Select for My Team'}
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {problem.problem_description}
                  </p>

                  {problem.expected_outcome && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <span className="font-semibold text-slate-700">Expected Outcome:</span>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {problem.expected_outcome}
                      </p>
                    </div>
                  )}

                  {problem.tech_preferences && problem.tech_preferences.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-400 font-medium text-[11px]">Tech Preferences:</span>
                      {problem.tech_preferences.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
