import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Clock, ArrowLeft, Award, FileQuestion, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  fetchPublishedProblemStatements,
  DIFFICULTY_LABELS,
  HIRING_POTENTIAL_LABELS,
} from '../../lib/problemStatements';
import type { ProblemStatement } from '../../types/database';

export const HackathonDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { tenant, isConfigured } = useAuth();

  const hackathonTitle = slug
    ? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'MITT Innovate 2026';

  // Phase 3A: load published problem statements for this hackathon.
  // Until the public page resolves slugs→UUIDs, we try the slug as a UUID
  // (returns empty if not a UUID) and show a sensible empty state.
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [psLoading, setPsLoading] = useState(false);

  useEffect(() => {
    if (!isConfigured || !slug) return;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(slug)) return;
    setPsLoading(true);
    fetchPublishedProblemStatements(slug).then((result) => {
      setProblemStatements(result.problemStatements ?? []);
      setPsLoading(false);
    });
  }, [isConfigured, slug]);

  return (
    <div className="space-y-8 py-4">
      {/* Back button */}
      <div>
        <Link
          to="/hackathons"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Hackathons
        </Link>
      </div>

      {/* Hero Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Registration Live</Badge>
              <Badge variant="outline">{tenant?.name || 'HackBridge'}</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {hackathonTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Karnataka engineering colleges flagship collaborative challenge. Solve high-priority
              problems submitted by vetted industry enterprises, be evaluated through transparent
              multi-criterion rubrics, and qualify for pre-placement interviews.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 min-w-[200px]">
            <Link to="/register">
              <Button size="lg" className="w-full bg-indigo-600 text-white font-semibold">
                Register My Team
              </Button>
            </Link>
            <Link to="/leaderboard">
              <Button size="lg" variant="outline" className="w-full">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Key Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Timeline & Phases */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Event Phases &amp; Lifecycle Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative pl-6 border-l-2 border-indigo-200 space-y-6">
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                <p className="text-xs font-bold text-emerald-700 uppercase">Stage 1: Problem Intake (Completed)</p>
                <p className="text-xs text-slate-500">Companies submit real-world industrial challenges &amp; datasets.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white ring-4 ring-indigo-100"></div>
                <p className="text-xs font-bold text-indigo-700 uppercase">Stage 2: Team Registration (Active)</p>
                <p className="text-xs text-slate-500">Student teams form (2-4 members), select problem statements, and submit abstracts.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></div>
                <p className="text-xs font-bold text-slate-500 uppercase">Stage 3: 36-Hour Hacking Period</p>
                <p className="text-xs text-slate-400">Intensive development sprint with mentor check-ins and milestone reviews.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></div>
                <p className="text-xs font-bold text-slate-500 uppercase">Stage 4: Double-Blind Evaluation</p>
                <p className="text-xs text-slate-400">Evaluator scoring against normalized rubrics with conflict of interest filtering.</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></div>
                <p className="text-xs font-bold text-slate-500 uppercase">Stage 5: Results &amp; Talent Pool Release</p>
                <p className="text-xs text-slate-400">Winners announced; top percentiles unlocked in company recruiting pool.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Rubrics Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                Evaluation Rubric
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Technical Complexity', weight: '30%' },
                { name: 'Innovation & Approach', weight: '25%' },
                { name: 'Feasibility & Architecture', weight: '20%' },
                { name: 'Working Demo & UI', weight: '15%' },
                { name: 'Presentation & Defense', weight: '10%' },
              ].map((r) => (
                <div key={r.name} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                  <span className="font-medium text-slate-700">{r.name}</span>
                  <Badge variant="outline">{r.weight}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Prizes &amp; Incentives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-600">
              <p>🥇 <strong>1st Place:</strong> ₹1,00,000 + Pre-placement Interview</p>
              <p>🥈 <strong>2nd Place:</strong> ₹60,000 + Summer Internship</p>
              <p>🥉 <strong>3rd Place:</strong> ₹40,000 + Partner Fast-track</p>
              <p>⭐ <strong>Top 10%:</strong> Verified Talent Profile badge</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Phase 3A — Published Problem Statements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <FileQuestion className="w-4 h-4 text-indigo-600" />
              Problem Statements
            </span>
            {isConfigured && (
              <Badge variant="success">Real database data</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isConfigured ? (
            <p className="text-xs text-slate-500 italic">
              Problem statements will appear here once the platform is configured and companies
              submit their challenges.
            </p>
          ) : psLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Loading published problem statements…
            </div>
          ) : problemStatements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-1">
              <FileQuestion className="w-5 h-5 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No published problem statements yet</p>
              <p className="text-[11px] text-slate-500">
                Problem statements will appear here once the committee approves and publishes them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {problemStatements.map((ps) => (
                <div key={ps.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {ps.difficulty && (
                      <Badge variant="outline">{DIFFICULTY_LABELS[ps.difficulty] ?? ps.difficulty}</Badge>
                    )}
                    {ps.domain && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />
                        {ps.domain}
                      </span>
                    )}
                    {ps.hiring_potential && ps.hiring_potential !== 'none' && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {HIRING_POTENTIAL_LABELS[ps.hiring_potential] ?? ps.hiring_potential}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{ps.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {ps.problem_description}
                  </p>
                  {ps.tech_preferences && ps.tech_preferences.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ps.tech_preferences.slice(0, 5).map((t) => (
                        <span key={t} className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
