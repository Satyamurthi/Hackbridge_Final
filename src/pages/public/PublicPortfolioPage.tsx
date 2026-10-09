import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Briefcase,
  Github,
  Linkedin,
  Globe,
  FileText,
  MapPin,
  Calendar,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  Share2,
  Check,
  AlertCircle,
  Code2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  fetchPublicTalentProfile,
  getTalentBadgeInfo,
  PublicTalentProfileView,
} from '../../lib/talentProfiles';

export const PublicPortfolioPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<PublicTalentProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!userId) {
        setError('Missing candidate ID in portfolio link.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data: profileView, error: fetchErr } = await fetchPublicTalentProfile(userId);

      if (!isMounted) return;

      if (fetchErr || !profileView) {
        setError(fetchErr || 'Candidate profile not found.');
      } else {
        setData(profileView);
      }
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading verified talent portfolio...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Profile Unavailable</h2>
          <p className="text-xs text-slate-600 mb-6">
            {error || 'This candidate profile is either private or does not exist.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/">
              <Button variant="outline" size="sm" className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                HackBridge Home
              </Button>
            </Link>
            <Link to="/leaderboard">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                View Hackathon Leaderboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { profile, user } = data;
  const badgeInfo = getTalentBadgeInfo(profile.badge);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-indigo-700 transition-colors">
              HB
            </div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">HackBridge</span>
            <span className="text-slate-400 text-xs">/ Verified Talent</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="text-xs h-8 text-slate-700"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Copied Link
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Share Profile
                </>
              )}
            </Button>

            <Link to="/login">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
                Recruiter Portal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-0 shadow-lg overflow-hidden relative">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-amber-400 flex items-center justify-center text-white font-black text-3xl shadow-lg shrink-0">
                  {user.fullName ? user.fullName[0].toUpperCase() : 'C'}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{user.fullName}</h1>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                    >
                      <span>{badgeInfo.emoji}</span>
                      <span>{badgeInfo.label}</span>
                    </span>
                  </div>

                  <p className="text-indigo-200 text-sm font-medium mt-1">
                    {profile.headline || 'Student Innovator & Engineer'}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
                    {user.department && (
                      <span>{user.department} {user.year ? `· Year ${user.year}` : ''}</span>
                    )}
                    {user.usn && <span>USN: {user.usn}</span>}
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified Hackathon Candidate
                    </span>
                  </div>
                </div>
              </div>

              {/* Contest Metrics */}
              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Contest Rank</p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {profile.overall_rank ? `#${profile.overall_rank}` : 'Top Rank'}
                  </p>
                </div>

                <div className="w-px h-10 bg-white/20" />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Percentile</p>
                  <p className="text-2xl font-black text-amber-400 mt-0.5">
                    {profile.percentile ? `Top ${(100 - profile.percentile).toFixed(1)}%` : 'Top 5%'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="max-w-5xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bio, Credentials & Skills (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {profile.bio && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Candidate Overview
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {profile.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Verified Contest Credentials */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Verified Hackathon Awards</h3>
                </div>
                <Badge variant="success" className="text-[11px]">Official University Record</Badge>
              </div>

              {profile.achievements && profile.achievements.length > 0 ? (
                <div className="space-y-3">
                  {profile.achievements.map((ach, idx) => {
                    const achBadge = getTalentBadgeInfo(ach.badge);
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{ach.project_title}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${achBadge.bgClass} ${achBadge.textClass} ${achBadge.borderClass}`}
                            >
                              <span>{achBadge.emoji}</span>
                              <span>{achBadge.label}</span>
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Contest: <span className="font-semibold text-slate-800">{ach.hackathon_title}</span> · Team: <span className="font-semibold text-slate-800">{ach.team_name}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          {ach.rank_overall && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                              Rank #{ach.rank_overall}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-xs text-slate-500 italic">
                    Awarded participant status across institutional challenges.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technical Skills Inventory */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Technical Skills &amp; Stack</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-lg bg-indigo-50/80 text-indigo-700 font-semibold text-xs border border-indigo-100"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No specific skills listed.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Career Preferences & Links (1 col) */}
        <div className="space-y-6">
          {/* Professional Links */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Professional Links
              </h3>

              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-xs font-medium text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <Github className="w-4 h-4 text-slate-700" />
                    <span>GitHub Profile</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}

              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-xs font-medium text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <Linkedin className="w-4 h-4 text-blue-600" />
                    <span>LinkedIn Profile</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}

              {profile.portfolio_url && (
                <a
                  href={profile.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-xs font-medium text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Personal Website</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}

              {profile.resume_url && (
                <a
                  href={profile.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors text-xs font-semibold text-indigo-700"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>View Resume / CV</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                </a>
              )}

              {!profile.github_url && !profile.linkedin_url && !profile.portfolio_url && !profile.resume_url && (
                <p className="text-xs text-slate-400 italic">No external links provided.</p>
              )}
            </CardContent>
          </Card>

          {/* Career & Availability */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Career Preferences
              </h3>

              {/* Looking For */}
              {profile.looking_for && profile.looking_for.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Seeking Roles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.looking_for.map((type) => (
                      <Badge key={type} variant="secondary" className="capitalize text-[11px]">
                        {type.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferred Locations */}
              {profile.preferred_location && profile.preferred_location.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Preferred Locations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.preferred_location.map((loc) => (
                      <span
                        key={loc}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs"
                      >
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{loc}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Date */}
              {profile.available_from && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">Available To Start</p>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(profile.available_from).toLocaleDateString()}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corporate Recruiter Inquiries CTA */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50/50 border-indigo-100">
            <CardContent className="p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Briefcase className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Interested in this candidate?</h4>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Connect with this student directly through the HackBridge Corporate Recruiter Portal.
              </p>
              <Link to="/login">
                <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">
                  Sign in as Partner Company
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
