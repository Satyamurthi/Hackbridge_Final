import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Award, 
  Users, 
  Briefcase, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  GraduationCap
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const LandingPage: React.FC = () => {
  const { tenant } = useAuth();

  return (
    <div className="space-y-16 py-4 sm:py-8">
      {/* Institution Banner & Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 lg:p-16 shadow-2xl">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-indigo-200">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Karnataka Engineering Colleges Hackathon Network</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
            Transforming College Hackathons into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
              High-Impact Innovation Hubs
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Welcome to the official hackathon management portal for{' '}
            <strong className="text-white font-semibold">{tenant?.name || 'HackBridge'}</strong>.
            HackBridge connects students, faculty committees, industry problem setters, and expert evaluators into a seamless white-label ecosystem.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/hackathons">
              <Button size="lg" className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold">
                Explore Active Hackathons
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/register">
              <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                Register as Student / Partner
              </Button>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-white">500+</p>
              <p className="text-xs text-slate-400">Engineering Teams</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">40+</p>
              <p className="text-xs text-slate-400">Industry Problems</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">100%</p>
              <p className="text-xs text-slate-400">Rubric Transparency</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">VTU Ready</p>
              <p className="text-xs text-slate-400">Karnataka Colleges</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Key Stakeholders Architecture */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-xs font-semibold">
            Unified Stakeholder Portals
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            One Platform, Every Role Empowered
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Built specifically around the four essential pillars described in the HackBridge specification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* College Admin */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">College Admin & Committee</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lifecycle management, automated state machine transitions, rubric setup, conflict-of-interest detection, and real-time dashboard analytics.
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Configurable rounds & rubrics</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Fair evaluator assignment</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Industry Company */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Industry Problem Setters</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Submit domain-specific challenges, provide sample datasets, define hiring intent, and scout top percentile student performers post-event.
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Domain & difficulty tagging</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Direct talent pipeline</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Students */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Student Innovators</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Form multi-disciplinary teams with invite codes, browse problem statements, submit live demos/repos, and build a verified talent portfolio.
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>Team formation & invite codes</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>Verified performance badges</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Evaluators */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Judges & Evaluators</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Structured multi-criterion rubric scoring, anonymized peer score benchmarks, conflict of interest declarations, and constructive feedback.
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Normalized weighted scoring</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Transparent qualitative notes</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* White-Label SaaS Architecture Highlight */}
      <section className="bg-slate-100/70 border border-slate-200 rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-3 max-w-xl">
          <Badge variant="outline" className="bg-white">
            Architecture Highlights
          </Badge>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Multi-Tenant Isolation Powered by Supabase RLS
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Every college operates inside a logically isolated tenant environment with its own domain, branding, participants, and scoring integrity. Strict PostgreSQL Row Level Security guarantees data isolation at the engine level.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link to="/hackathons" className="w-full sm:w-auto">
            <Button size="lg" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              View Active Events
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full">
              Sign In to Portal
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
