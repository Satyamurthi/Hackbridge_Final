import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Trophy,
  Award,
  Medal,
  Search,
  Github,
  Globe,
  Presentation,
  Video,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  fetchLeaderboard,
  fetchLeaderboardHackathons,
  getAwardBadgeMeta,
  LEADERBOARD_MIGRATION_FILE,
} from '../../lib/leaderboard';
import type { LeaderboardEntry, Hackathon } from '../../types/database';

export const LeaderboardPage: React.FC = () => {
  const { tenant, tenantId } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);

  // Load Hackathons
  const loadHackathons = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { hackathons: list, error } = await fetchLeaderboardHackathons(tenantId ?? undefined);
    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
      return;
    }

    setHackathons(list);

    // Pick active or most recent hackathon
    let active = list.find((h) => h.status === 'completed' || h.status === 'evaluation');
    if (!active && list.length > 0) active = list[0];

    if (active) {
      setSelectedHackathonId(active.id);
    } else {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadHackathons();
  }, [loadHackathons]);

  // Load Leaderboard entries for selected hackathon
  const loadEntries = useCallback(async (hackathonId: string) => {
    if (!hackathonId) return;

    setIsLoading(true);
    setErrorMessage(null);
    setIsMigrationMissing(false);

    const { entries, error, isMigrationMissing: missing } = await fetchLeaderboard(hackathonId);

    if (error) {
      setErrorMessage(error);
      if (missing) setIsMigrationMissing(true);
    } else {
      setLeaderboard(entries);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedHackathonId) {
      loadEntries(selectedHackathonId);
    }
  }, [selectedHackathonId, loadEntries]);

  const activeHackathon = hackathons.find((h) => h.id === selectedHackathonId);
  const isResultsFinal = activeHackathon?.status === 'completed' || !!activeHackathon?.results_announced_at;

  // Filtered domains list
  const availableDomains = Array.from(
    new Set(leaderboard.map((e) => e.problem_domain).filter(Boolean))
  ) as string[];

  // Filtered entries
  const filteredEntries = leaderboard.filter((entry) => {
    const matchesSearch =
      entry.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.submission_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.company_name && entry.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.problem_title && entry.problem_title.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDomain =
      domainFilter === 'all' || entry.problem_domain?.toLowerCase() === domainFilter.toLowerCase();

    return matchesSearch && matchesDomain;
  });

  // Podium (Top 3 overall)
  const firstPlace = leaderboard.find((e) => e.rank_overall === 1);
  const secondPlace = leaderboard.find((e) => e.rank_overall === 2);
  const thirdPlace = leaderboard.find((e) => e.rank_overall === 3);

  return (
    <div className="space-y-8 py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header & Hackathon Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-200">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Official Hackathon Leaderboard
                </h1>
                <Badge variant="success">Live Standings</Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Aggregated, normalized judge scores across multi-criterion rubrics for {tenant?.name || 'MITT'}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hackathons.length > 0 && (
            <div className="w-56">
              <Select
                value={selectedHackathonId}
                onChange={(e) => setSelectedHackathonId(e.target.value)}
                className="text-xs h-9 bg-white"
              >
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} ({h.status.toUpperCase()})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedHackathonId && loadEntries(selectedHackathonId)}
            className="text-xs h-9 text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Migration Notice Banner if missing */}
      {isMigrationMissing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Leaderboard Setup Pending</p>
            <p className="mt-1">
              The <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">public.leaderboard</code> view is not yet applied in Supabase.
              Please execute <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded">{LEADERBOARD_MIGRATION_FILE}</code> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Lifecycle Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
        <div className="flex items-center gap-3">
          {isResultsFinal ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {isResultsFinal ? 'Official Final Results Announced' : 'Live Evaluation Standings (Deliberation Phase)'}
              </span>
              <Badge variant={isResultsFinal ? 'success' : 'default'} className="text-[10px]">
                {activeHackathon?.status?.toUpperCase() || 'EVALUATION'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isResultsFinal
                ? `Results finalized and officially declared on ${new Date(activeHackathon?.results_announced_at || Date.now()).toLocaleDateString('en-US', { dateStyle: 'medium' })}.`
                : 'Scoring underway by appointed double-blind evaluators. Standings update in real time as rubrics are locked.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 shrink-0">
          <span>Total Final Submissions: <strong className="text-slate-900">{leaderboard.length}</strong></span>
        </div>
      </div>

      {/* Top 3 Visual Podium (Only displayed if we have at least 1 entry) */}
      {leaderboard.length > 0 && (
        <div className="py-2">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/70">
              Championship Podium
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Top Innovators & Award Recipients</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto">
            {/* 2nd Place (Silver) */}
            <div className="order-2 md:order-1">
              {secondPlace ? (
                <div className="bg-white border-2 border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative group text-center">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-200 border-2 border-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-sm">
                    2
                  </div>
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                    <Medal className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="mb-2 text-[10px]">
                    1st Runner Up 🥈
                  </Badge>
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1">{secondPlace.team_name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{secondPlace.submission_title}</p>
                  <div className="mt-4 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Weighted Score</span>
                    <span className="font-bold text-slate-900 text-sm">{secondPlace.score?.toFixed(1) || '0.0'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 text-xs text-slate-600 hover:text-slate-900"
                    onClick={() => setSelectedEntry(secondPlace)}
                  >
                    View Deliverables
                  </Button>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  2nd Place Pending
                </div>
              )}
            </div>

            {/* 1st Place (Gold / Center Podium) */}
            <div className="order-1 md:order-2 -mt-4">
              {firstPlace ? (
                <div className="bg-gradient-to-b from-amber-500/10 via-white to-white border-2 border-amber-400 rounded-3xl p-7 shadow-lg shadow-amber-500/10 hover:shadow-xl transition-all relative text-center">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 border-2 border-white text-white flex items-center justify-center font-bold text-sm shadow-md shadow-amber-300">
                    👑
                  </div>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3 shadow-inner">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <Badge variant="default" className="bg-amber-600 hover:bg-amber-600 text-white mb-2 text-xs font-bold px-3 py-0.5">
                    Grand Champion 🏆
                  </Badge>
                  <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{firstPlace.team_name}</h3>
                  <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{firstPlace.submission_title}</p>
                  {firstPlace.company_name && (
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      Challenge: {firstPlace.company_name}
                    </p>
                  )}
                  <div className="mt-4 py-2.5 px-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                    <span className="text-amber-800 font-semibold">Winning Score</span>
                    <span className="font-bold text-amber-900 text-base">{firstPlace.score?.toFixed(1) || '0.0'}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    onClick={() => setSelectedEntry(firstPlace)}
                  >
                    Inspect Winning Solution
                  </Button>
                </div>
              ) : (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400">
                  1st Place Pending
                </div>
              )}
            </div>

            {/* 3rd Place (Bronze) */}
            <div className="order-3">
              {thirdPlace ? (
                <div className="bg-white border-2 border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative group text-center">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-700/10 border-2 border-white text-amber-800 flex items-center justify-center font-bold text-xs shadow-sm">
                    3
                  </div>
                  <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-3">
                    <Award className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="mb-2 text-[10px] text-amber-800 border-amber-600/30">
                    2nd Runner Up 🥉
                  </Badge>
                  <h3 className="font-bold text-slate-900 text-base line-clamp-1">{thirdPlace.team_name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{thirdPlace.submission_title}</p>
                  <div className="mt-4 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Weighted Score</span>
                    <span className="font-bold text-slate-900 text-sm">{thirdPlace.score?.toFixed(1) || '0.0'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 text-xs text-slate-600 hover:text-slate-900"
                    onClick={() => setSelectedEntry(thirdPlace)}
                  >
                    View Deliverables
                  </Button>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  3rd Place Pending
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search teams, projects, sponsors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        {/* Domain Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
          <Button
            size="sm"
            variant={domainFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setDomainFilter('all')}
            className="text-xs h-8 rounded-full px-3"
          >
            All Tracks ({leaderboard.length})
          </Button>
          {availableDomains.map((domain) => (
            <Button
              key={domain}
              size="sm"
              variant={domainFilter === domain ? 'primary' : 'outline'}
              onClick={() => setDomainFilter(domain)}
              className="text-xs h-8 rounded-full px-3"
            >
              {domain}
            </Button>
          ))}
        </div>
      </div>

      {/* Standings Table */}
      <Card className="overflow-hidden border-slate-200/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 text-center w-16">Rank</th>
                <th className="py-3.5 px-4">Team & Solution Title</th>
                <th className="py-3.5 px-4">Challenge & Track</th>
                <th className="py-3.5 px-4 text-center">Score</th>
                <th className="py-3.5 px-4 text-center">Award Tier</th>
                <th className="py-3.5 px-4 text-center">Deliverables</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => {
                const badge = getAwardBadgeMeta(entry.final_decision, entry.rank_overall);
                const isTopThree = entry.rank_overall <= 3;

                return (
                  <tr
                    key={entry.submission_id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isTopThree ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        {entry.rank_overall === 1 && (
                          <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shadow-xs border border-amber-200 text-xs">
                            🥇
                          </span>
                        )}
                        {entry.rank_overall === 2 && (
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shadow-xs border border-slate-200 text-xs">
                            🥈
                          </span>
                        )}
                        {entry.rank_overall === 3 && (
                          <span className="w-7 h-7 rounded-full bg-amber-50 text-amber-900 font-bold flex items-center justify-center shadow-xs border border-amber-200/80 text-xs">
                            🥉
                          </span>
                        )}
                        {entry.rank_overall > 3 && (
                          <span className="font-bold text-slate-500 text-xs">
                            #{entry.rank_overall}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Team & Title */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5 max-w-sm">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-semibold text-xs">{entry.team_name}</strong>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            SUB-{entry.submission_id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-slate-600 font-medium truncate">{entry.submission_title}</p>
                      </div>
                    </td>

                    {/* Challenge & Domain */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-800 truncate max-w-xs">
                          {entry.problem_title || 'Open Innovation Track'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-indigo-600 font-medium">
                            {entry.problem_domain || 'General'}
                          </span>
                          {entry.company_name && (
                            <>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {entry.company_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-sm font-bold text-slate-900">
                          {entry.score != null ? entry.score.toFixed(1) : '—'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {entry.evaluator_count} {entry.evaluator_count === 1 ? 'judge' : 'judges'}
                        </span>
                      </div>
                    </td>

                    {/* Award Tier */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Deliverables */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {entry.repo_url && (
                          <a
                            href={entry.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="GitHub Repository"
                          >
                            <Github className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {entry.demo_url && (
                          <a
                            href={entry.demo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                            title="Live Demo"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {entry.video_url && (
                          <a
                            href={entry.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                            title="Video Demo"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {entry.presentation_url && (
                          <a
                            href={entry.presentation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                            title="Pitch Deck"
                          >
                            <Presentation className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEntry(entry)}
                        className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold h-7 px-2"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredEntries.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">No matching submissions found</p>
                    <p className="text-[11px] mt-1">Adjust search parameters or domain filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Project Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Rank #{selectedEntry.rank_overall}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">{selectedEntry.team_name}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedEntry.submission_title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Score Bar */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-semibold">Normalized Weighted Score</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {selectedEntry.score?.toFixed(1) || '0.0'} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 font-semibold">Jury Consensus</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">
                    {selectedEntry.advance_votes} Advance · {selectedEntry.evaluator_count} Judges
                  </p>
                </div>
              </div>

              {/* Problem statement */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Assigned Challenge</h4>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedEntry.problem_title || 'Open Innovation Challenge'}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Track: <strong className="text-slate-700">{selectedEntry.problem_domain || 'General'}</strong>
                  {selectedEntry.company_name && ` · Sponsored by ${selectedEntry.company_name}`}
                </p>
              </div>

              {/* Abstract */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Executive Summary</h4>
                <p className="text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  {selectedEntry.submission_abstract}
                </p>
              </div>

              {/* Tech Stack */}
              {selectedEntry.tech_stack && selectedEntry.tech_stack.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1.5">Technology Stack</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntry.tech_stack.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium text-[11px] border border-indigo-100"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliverable Buttons */}
              <div className="pt-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-2">Project Deliverables</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedEntry.repo_url && (
                    <a
                      href={selectedEntry.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-1.5 font-semibold text-slate-700 transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      Code Repo
                    </a>
                  )}
                  {selectedEntry.demo_url && (
                    <a
                      href={selectedEntry.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 flex items-center justify-center gap-1.5 font-semibold text-indigo-700 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      Live Demo
                    </a>
                  )}
                  {selectedEntry.video_url && (
                    <a
                      href={selectedEntry.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-50 flex items-center justify-center gap-1.5 font-semibold text-rose-700 transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      Video Demo
                    </a>
                  )}
                  {selectedEntry.presentation_url && (
                    <a
                      href={selectedEntry.presentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 flex items-center justify-center gap-1.5 font-semibold text-amber-800 transition-colors"
                    >
                      <Presentation className="w-4 h-4" />
                      Pitch Deck
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button size="sm" onClick={() => setSelectedEntry(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
