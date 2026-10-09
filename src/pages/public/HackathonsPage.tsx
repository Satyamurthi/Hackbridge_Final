import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Users, Trophy, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const HackathonsPage: React.FC = () => {
  const { tenant } = useAuth();

  // Representative Foundation Hackathons for the College
  const sampleHackathons = [
    {
      id: 'h-1',
      slug: 'mitt-innovate-2026',
      title: 'MITT Innovate 2026',
      tagline: 'Karnataka Inter-Departmental Grand Challenge',
      status: 'registration',
      phaseLabel: 'Registration Open',
      dates: 'Oct 15 - Oct 17, 2026',
      teamSize: '2 - 4 Members',
      prizePool: '₹2,50,000',
      domains: ['Fintech', 'HealthTech', 'Smart Cities', 'Sustainability'],
      registeredTeams: 84,
      maxTeams: 150,
    },
    {
      id: 'h-2',
      slug: 'karnataka-ai-challenge',
      title: 'Bengaluru AI & Cloud Sprint',
      tagline: 'Industry-partnered applied intelligence challenge',
      status: 'problem_intake',
      phaseLabel: 'Problem Intake',
      dates: 'Nov 05 - Nov 07, 2026',
      teamSize: '3 - 4 Members',
      prizePool: '₹1,50,000',
      domains: ['AI/ML', 'Computer Vision', 'GenAI'],
      registeredTeams: 0,
      maxTeams: 100,
    },
    {
      id: 'h-3',
      slug: 'iot-mobility-hack-2026',
      title: 'Urban Mobility & IoT Sprint',
      tagline: 'Hardware and embedded software solutions for urban transport',
      status: 'draft',
      phaseLabel: 'Upcoming',
      dates: 'Dec 01 - Dec 03, 2026',
      teamSize: '2 - 4 Members',
      prizePool: '₹1,00,000',
      domains: ['IoT', 'Logistics', 'Robotics'],
      registeredTeams: 0,
      maxTeams: 80,
    }
  ];

  return (
    <div className="space-y-8 py-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              College Hackathons
            </h1>
            <Badge variant="default" className="text-[11px]">
              {tenant?.slug.toUpperCase() || 'HackBridge'}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              Sample data
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Discover and participate in ongoing innovation competitions hosted at {tenant?.name || 'HackBridge'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/register">
            <Button size="sm" className="bg-indigo-600 text-white">
              Create Team / Register
            </Button>
          </Link>
        </div>
      </div>

      {/* Hackathons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleHackathons.map((h) => (
          <Card key={h.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={
                      h.status === 'registration'
                        ? 'success'
                        : h.status === 'problem_intake'
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {h.phaseLabel}
                  </Badge>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    {h.prizePool}
                  </span>
                </div>
                <CardTitle className="text-base sm:text-lg hover:text-indigo-600 transition-colors">
                  <Link to={`/hackathons/${h.slug}`}>{h.title}</Link>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {h.tagline}
                </p>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{h.dates}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Team: {h.teamSize}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {h.domains.map((domain) => (
                    <span
                      key={domain}
                      className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </CardContent>
            </div>

            <CardFooter className="p-5 pt-3 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {h.registeredTeams > 0 ? `${h.registeredTeams} teams enrolled` : 'Intake open'}
              </span>
              <Link to={`/hackathons/${h.slug}`}>
                <Button size="sm" variant="outline" className="text-xs gap-1">
                  Details
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
