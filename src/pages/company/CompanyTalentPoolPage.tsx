import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase,
  Search,
  Trophy,
  ExternalLink,
  Github,
  Linkedin,
  FileText,
  MapPin,
  Calendar,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import {
  fetchCompanyTalentPool,
  fetchCompanyOutreachPipeline,
  expressHiringInterest,
  CandidateScoutingProfile,
  HIRING_PIPELINE_MIGRATION_FILE,
} from '../../lib/hiringPipeline';
import { getTalentBadgeInfo } from '../../lib/talentProfiles';
import type { HiringInterestType } from '../../types/database';

export const CompanyTalentPoolPage: React.FC = () => {
  const { profile, tenant, tenantId } = useAuth();

  const [activeTab, setActiveTab] = useState<'discover' | 'pipeline'>('discover');
  const [candidates, setCandidates] = useState<CandidateScoutingProfile[]>([]);
  const [pipeline, setPipeline] = useState<CandidateScoutingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');

  // Outreach Modal State
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateScoutingProfile | null>(null);
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [roleTitle, setRoleTitle] = useState('');
  const [compensationRange, setCompensationRange] = useState('');
  const [interestType, setInterestType] = useState<HiringInterestType>('interview_requested');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [isSubmittingOutreach, setIsSubmittingOutreach] = useState(false);
  const [outreachSuccess, setOutreachSuccess] = useState<string | null>(null);

  const companyId = profile?.company_id || 'sample-company';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsMigrationMissing(false);

    try {
      const [poolRes, pipeRes] = await Promise.all([
        fetchCompanyTalentPool(companyId, tenantId || 'mitt', {
          search: searchQuery,
          badge: selectedBadge,
          skill: selectedSkill !== 'all' ? selectedSkill : undefined,
        }),
        fetchCompanyOutreachPipeline(companyId),
      ]);

      if (poolRes.error) {
        setErrorMessage(poolRes.error);
        if (poolRes.isMigrationMissing) setIsMigrationMissing(true);
      } else {
        setCandidates(poolRes.candidates);
      }

      if (pipeRes.pipeline) {
        setPipeline(pipeRes.pipeline);
      }
    } catch (err: any) {
      console.warn('[CompanyTalentPoolPage] Error loading talent pool:', err);
      setErrorMessage(err?.message || 'Unable to load talent pool.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, tenantId, searchQuery, selectedBadge, selectedSkill]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // Open Modal
  const handleOpenOutreach = (cand: CandidateScoutingProfile) => {
    setSelectedCandidate(cand);
    setRoleTitle(cand.currentInterest?.role_title || 'Software Development Engineer');
    setCompensationRange(cand.currentInterest?.compensation_range || '₹10,00,000 – ₹14,00,000 / year');
    setInterestType(cand.currentInterest?.interest_type || 'interview_requested');
    setOutreachMessage(
      cand.currentInterest?.message ||
        `Hi ${cand.user.fullName.split(' ')[0]}, we were very impressed by your verified hackathon achievements at ${tenant?.name || 'MITT'}. We would love to discuss an interview opportunity with our engineering team.`
    );
    setIsOutreachModalOpen(true);
  };

  // Submit Outreach
  const handleSubmitOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    setIsSubmittingOutreach(true);
    setErrorMessage(null);

    const res = await expressHiringInterest(companyId, selectedCandidate.talentProfile.id, {
      role_title: roleTitle,
      compensation_range: compensationRange,
      interest_type: interestType,
      message: outreachMessage,
    });

    setIsSubmittingOutreach(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to dispatch outreach request.');
    } else {
      setOutreachSuccess(`Outreach successfully sent to ${selectedCandidate.user.fullName}!`);
      setIsOutreachModalOpen(false);
      loadData();
      setTimeout(() => setOutreachSuccess(null), 4000);
    }
  };

  // Extract unique skills from candidates for filter
  const allAvailableSkills = Array.from(
    new Set(candidates.flatMap((c) => c.talentProfile.skills || []))
  ).slice(0, 12);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Talent Pool &amp; Candidate Scouting</h1>
            <Badge variant="success">Verified Pool</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Discover verified hackathon finalists, review technical capabilities, and dispatch in-app interview requests.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'discover'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Discover Candidates</span>
            <span className="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
              {candidates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pipeline'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Outreach Pipeline</span>
            {pipeline.length > 0 && (
              <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold">
                {pipeline.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Migration Notice */}
      {isMigrationMissing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Candidate Pipeline Initializing</p>
            <p className="mt-1">
              Please apply <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{HIRING_PIPELINE_MIGRATION_FILE}</code> in the Supabase SQL Editor to enable database persistence for candidate outreach.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Success Notification */}
      {outreachSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{outreachSuccess}</span>
        </div>
      )}

      {/* TAB 1: DISCOVER CANDIDATES */}
      {activeTab === 'discover' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate name, headline, skills (e.g. PyTorch, React)..."
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBadge('all');
                      setSelectedSkill('all');
                    }}
                    className="text-xs h-9 text-slate-600"
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>

              {/* Badges Filters */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  Award Tier:
                </span>
                {[
                  { key: 'all', label: 'All Verified' },
                  { key: 'winner', label: '🏆 Winners' },
                  { key: 'runner_up', label: '🥈 1st Runner Up' },
                  { key: 'second_runner_up', label: '🥉 2nd Runner Up' },
                  { key: 'top_10', label: '⭐ Top 10' },
                  { key: 'shortlisted', label: '🎯 Shortlisted' },
                ].map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setSelectedBadge(b.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      selectedBadge === b.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Skills Quick Filters */}
              {allAvailableSkills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Skills:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSkill('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      selectedSkill === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {allAvailableSkills.map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSelectedSkill(sk)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        selectedSkill === sk
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sk}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidate Grid */}
          {isLoading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-500">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Scanning verified talent pool...
            </div>
          ) : candidates.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No candidates match your current filter.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the search terms or award tier filters.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((cand) => {
                const badgeInfo = getTalentBadgeInfo(cand.talentProfile.badge);
                const interest = cand.currentInterest;

                return (
                  <Card
                    key={cand.talentProfile.id}
                    className="hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Top Row: Name, Badge & Rank */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                            {cand.user.fullName ? cand.user.fullName[0].toUpperCase() : 'U'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-900">{cand.user.fullName}</h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                              >
                                <span>{badgeInfo.emoji}</span>
                                <span>{badgeInfo.label}</span>
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 mt-0.5">
                              {cand.user.department || 'Engineering'} {cand.user.year ? `· Year ${cand.user.year}` : ''}
                              {cand.user.usn && ` · USN: ${cand.user.usn}`}
                            </p>
                          </div>
                        </div>

                        {/* Rank Badge */}
                        <div className="text-right shrink-0">
                          {cand.talentProfile.overall_rank && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                              Rank #{cand.talentProfile.overall_rank}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Headline */}
                      {cand.talentProfile.headline && (
                        <p className="text-xs font-semibold text-slate-700 leading-snug">
                          {cand.talentProfile.headline}
                        </p>
                      )}

                      {/* Skills Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {cand.talentProfile.skills.slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {cand.talentProfile.skills.length > 6 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{cand.talentProfile.skills.length - 6} more
                          </span>
                        )}
                      </div>

                      {/* Availability & Career Preferences */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cand.talentProfile.preferred_location.join(', ') || 'Bangalore'}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {cand.talentProfile.available_from
                              ? `Available: ${new Date(cand.talentProfile.available_from).toLocaleDateString()}`
                              : 'Immediate Availability'}
                          </span>
                        </div>
                      </div>

                      {/* Outreach Status & External Links */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {/* External Links */}
                        <div className="flex items-center gap-2">
                          {cand.talentProfile.github_url && (
                            <a
                              href={cand.talentProfile.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              title="GitHub Profile"
                            >
                              <Github className="w-4 h-4" />
                            </a>
                          )}
                          {cand.talentProfile.linkedin_url && (
                            <a
                              href={cand.talentProfile.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="LinkedIn Profile"
                            >
                              <Linkedin className="w-4 h-4" />
                            </a>
                          )}
                          {cand.talentProfile.resume_url && (
                            <a
                              href={cand.talentProfile.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Resume CV"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            to={`/portfolio/${cand.user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 ml-1"
                          >
                            <span>Portfolio</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>

                        {/* Action CTA */}
                        <div>
                          {interest ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenOutreach(cand)}
                              className="text-xs h-8 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                            >
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              {interest.interest_type === 'interview_requested'
                                ? 'Interview Sent'
                                : interest.interest_type === 'offer_made'
                                ? 'Offer Sent'
                                : 'Shortlisted'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenOutreach(cand)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-semibold"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Request Interview
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OUTREACH PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {pipeline.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Candidates Contacted Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Switch to the "Discover Candidates" tab to find top performers and send direct interview requests.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pipeline.map((item) => {
                const interest = item.currentInterest!;
                const badgeInfo = getTalentBadgeInfo(item.talentProfile.badge);

                return (
                  <Card key={interest.id} className="hover:border-slate-300 transition-colors">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Candidate Details */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg shrink-0">
                          {item.user.fullName ? item.user.fullName[0].toUpperCase() : 'C'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{item.user.fullName}</h4>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                            >
                              <span>{badgeInfo.emoji}</span>
                              <span>{badgeInfo.label}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mt-1">
                            Role Target: <span className="font-semibold text-slate-900">{interest.role_title}</span>
                            {interest.compensation_range && ` · ${interest.compensation_range}`}
                          </p>

                          {interest.message && (
                            <p className="text-xs text-slate-500 italic mt-1 line-clamp-1">
                              "{interest.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Outreach & Student Response Status */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                        {/* Response Pill */}
                        <div>
                          {interest.student_response === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Interview Accepted
                            </span>
                          ) : interest.student_response === 'declined' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Candidate Declined
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Awaiting Candidate Response
                            </span>
                          )}

                          {interest.responded_at && (
                            <p className="text-[10px] text-slate-400 text-right mt-1">
                              Responded {new Date(interest.responded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        {/* Edit Outreach Action */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenOutreach(item)}
                          className="text-xs h-8 text-slate-700"
                        >
                          Edit Terms
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* OUTREACH / INTERVIEW REQUEST MODAL */}
      {isOutreachModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-lg bg-white shadow-2xl rounded-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Dispatch Career Opportunity
                  </CardTitle>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOutreachModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmitOutreach}>
              <CardContent className="p-6 space-y-4">
                {/* Candidate Snippet */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedCandidate.user.fullName}</p>
                    <p className="text-[11px] text-slate-600">
                      {selectedCandidate.user.department} · {selectedCandidate.talentProfile.headline}
                    </p>
                  </div>
                  {selectedCandidate.talentProfile.overall_rank && (
                    <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded shadow-xs">
                      Rank #{selectedCandidate.talentProfile.overall_rank}
                    </span>
                  )}
                </div>

                {/* Interest Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Engagement Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'interview_requested', label: 'Interview Request' },
                      { key: 'offer_made', label: 'Direct Job Offer' },
                      { key: 'shortlisted', label: 'Shortlist' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setInterestType(item.key as HiringInterestType)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                          interestType === item.key
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Title <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Associate AI Engineer, SDE Intern (Summer 2026)"
                    className="text-xs h-9"
                  />
                </div>

                {/* Compensation Range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Compensation / Stipend Range
                  </label>
                  <Input
                    value={compensationRange}
                    onChange={(e) => setCompensationRange(e.target.value)}
                    placeholder="e.g. ₹12,00,000 – ₹15,00,000 / year or ₹40,000 / month"
                    className="text-xs h-9"
                  />
                </div>

                {/* Personalized Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recruiter Invitation Message
                  </label>
                  <Textarea
                    rows={4}
                    value={outreachMessage}
                    onChange={(e) => setOutreachMessage(e.target.value)}
                    placeholder="Describe your team, next steps, and why this candidate is a great match..."
                    className="text-xs"
                  />
                </div>
              </CardContent>

              {/* Modal Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOutreachModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmittingOutreach}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 px-4"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Dispatch Opportunity
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
