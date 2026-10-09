import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  FileQuestion,
  Users,
  Award,
  ShieldCheck,
  FolderGit2,
  FileText,
  Briefcase,
  CheckSquare,
  Sparkles,
  Sliders,
  Trophy,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { role, tenant } = useAuth();

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'super_admin':
      case 'college_admin':
      case 'committee_member':
        return [
          { label: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard },
          { label: 'Hackathons', href: '/admin/hackathons', icon: Calendar },
          { label: 'Companies', href: '/admin/companies', icon: Briefcase },
          { label: 'Problem Statements', href: '/admin/problems', icon: FileQuestion },
          { label: 'AI Pre-Screening', href: '/admin/prescreening', icon: Sparkles },
          { label: 'Evaluators', href: '/admin/evaluators', icon: Users },
          { label: 'Results & Judging', href: '/admin/results', icon: Award },
          { label: 'Live Leaderboard', href: '/leaderboard', icon: Trophy },
          { label: 'Audit Trail', href: '/admin/audit', icon: ShieldCheck },
          { label: 'Tenant Settings', href: '/admin/settings', icon: Sliders },
        ];
      case 'student':
      case 'mentor':
        return [
          { label: 'Student Portal', href: '/student', icon: LayoutDashboard },
          { label: 'My Team & Code', href: '/student/team', icon: Users },
          { label: 'Problem Statements', href: '/student/problems', icon: FileText },
          { label: 'Project Submissions', href: '/student/submissions', icon: FolderGit2 },
          { label: 'Live Leaderboard', href: '/leaderboard', icon: Trophy },
          { label: 'My Talent Profile', href: '/student/portfolio', icon: Sparkles },
          { label: 'Career Inquiries', href: '/student/offers', icon: Briefcase },
        ];
      case 'evaluator':
        return [
          { label: 'Evaluator Dashboard', href: '/evaluator', icon: LayoutDashboard },
          { label: 'Assigned Submissions', href: '/evaluator/assignments', icon: CheckSquare },
          { label: 'Rubric Scoring Desk', href: '/evaluator/score', icon: Award },
          { label: 'Live Leaderboard', href: '/leaderboard', icon: Trophy },
        ];
      case 'company_rep':
        return [
          { label: 'Company Portal', href: '/company', icon: LayoutDashboard },
          { label: 'Problem Statements', href: '/company/problems', icon: FileQuestion },
          { label: 'Live Leaderboard', href: '/leaderboard', icon: Trophy },
          { label: 'Talent Pool', href: '/company/talent-pool', icon: Briefcase },
        ];
      default:
        return [
          { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 shadow-sm">
      <div className="space-y-6">
        {/* Role & Tenant Badge */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Role Workspace
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize">
              {role?.replace('_', ' ') || 'Guest'}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-800 truncate">
            {tenant?.name || 'HackBridge'}
          </p>
        </div>

        {/* Navigation links */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/admin' || item.href === '/student' || item.href === '/evaluator' || item.href === '/company'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-50 text-indigo-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-600">HackBridge v1.0</p>
        <p className="text-[10px]">Multi-Tenant College Edition</p>
      </div>
    </aside>
  );
};
