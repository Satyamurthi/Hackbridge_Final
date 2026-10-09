import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase,
  Github,
  Linkedin,
  Globe,
  FileText,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import {
  fetchStudentTalentProfile,
  saveStudentTalentProfile,
  getTalentBadgeInfo,
  TALENT_PROFILES_MIGRATION_FILE,
} from '../../lib/talentProfiles';
import { STORAGE_BUCKETS } from '../../lib/storage';
import { FileUploadDropzone } from '../../components/ui/FileUploadDropzone';
import type {
  TalentProfile,
  JobTypePreference,
} from '../../types/database';

const COMMON_SKILLS_SUGGESTIONS = [
  'Python',
  'React',
  'TypeScript',
  'Node.js',
  'PyTorch',
  'FastAPI',
  'Docker',
  'PostgreSQL',
  'Tailwind CSS',
  'TensorFlow',
  'AWS',
  'GraphQL',
  'Next.js',
  'Solidity',
  'C++',
];

export const StudentPortfolioPage: React.FC = () => {
  const { user, profile: userProfile, tenant, tenantId } = useAuth();

  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form Fields
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [lookingFor, setLookingFor] = useState<JobTypePreference[]>([]);
  const [preferredLocation, setPreferredLocation] = useState<string[]>([]);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  const studentMeta = (userProfile?.metadata as any) || {};

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const effectiveUserId = user.id;
    const effectiveTenantId = tenantId || tenant?.id || '';

    setIsLoading(true);
    setErrorMessage(null);
    setIsMigrationMissing(false);

    try {
      const { profile, error, isMigrationMissing: missing } = await fetchStudentTalentProfile(
        effectiveUserId,
        effectiveTenantId
      );

      if (error) {
        setErrorMessage(error);
        if (missing) setIsMigrationMissing(true);
      } else if (profile) {
        setTalentProfile(profile);
        setHeadline(profile.headline || '');
        setBio(profile.bio || '');
        setSkills(profile.skills || []);
        setGithubUrl(profile.github_url || '');
        setLinkedinUrl(profile.linkedin_url || '');
        setPortfolioUrl(profile.portfolio_url || '');
        setResumeUrl(profile.resume_url || '');
        setAvailableFrom(profile.available_from || '');
        setLookingFor(profile.looking_for || ['internship', 'full_time']);
        setPreferredLocation(profile.preferred_location || ['Bangalore', 'Remote']);
        setIsVisible(profile.is_visible);
      }
    } catch (err: any) {
      console.warn('[StudentPortfolioPage] Error loading profile:', err);
      setErrorMessage(err?.message || 'Unable to load talent profile.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tenantId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadProfile().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadProfile]);

  // Skill Management
  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Location Management
  const handleAddLocation = () => {
    const trimmed = newLocationInput.trim();
    if (trimmed && !preferredLocation.includes(trimmed)) {
      setPreferredLocation([...preferredLocation, trimmed]);
      setNewLocationInput('');
    }
  };

  const handleRemoveLocation = (loc: string) => {
    setPreferredLocation(preferredLocation.filter((l) => l !== loc));
  };

  // Job Type Toggle
  const toggleJobType = (type: JobTypePreference) => {
    if (lookingFor.includes(type)) {
      setLookingFor(lookingFor.filter((t) => t !== type));
    } else {
      setLookingFor([...lookingFor, type]);
    }
  };

  // Save Profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { success, profile, error } = await saveStudentTalentProfile(
      user.id,
      tenantId || 'mitt',
      {
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        skills,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        resume_url: resumeUrl.trim() || null,
        available_from: availableFrom || null,
        looking_for: lookingFor,
        preferred_location: preferredLocation,
        is_visible: isVisible,
      }
    );

    setIsSaving(false);

    if (!success) {
      setErrorMessage(error || 'Failed to save talent profile.');
    } else {
      if (profile) setTalentProfile(profile);
      setSuccessMessage('Talent profile saved successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Copy Public Link
  const handleCopyLink = () => {
    if (!user?.id) return;
    const url = `${window.location.origin}/portfolio/${user.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const badgeInfo = getTalentBadgeInfo(talentProfile?.badge);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">My Verified Talent Profile</h1>
            <Badge variant="success">Verified Credentials</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Showcase verified hackathon achievements, technical skills, and career preferences to corporate recruiters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="text-xs h-9 text-slate-700"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Copied Link!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Share Link
              </>
            )}
          </Button>

          {user?.id && (
            <Link to={`/portfolio/${user.id}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="text-xs h-9 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                View Public Profile
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Profile
          </Button>
        </div>
      </div>

      {/* Migration Notice */}
      {isMigrationMissing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Profile Setup Pending</p>
            <p className="mt-1">
              Please apply <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{TALENT_PROFILES_MIGRATION_FILE}</code> in the Supabase SQL Editor to enable database persistence for talent profiles.
            </p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && !errorMessage.includes('does not exist') && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Banner: Verified Credentials Card */}
      <Card className="bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/40 border-slate-200/90 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-2xl shadow-md shadow-indigo-200 shrink-0">
                {userProfile?.full_name ? userProfile.full_name[0].toUpperCase() : 'U'}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {userProfile?.full_name || 'Student Innovator'}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                  >
                    <span>{badgeInfo.emoji}</span>
                    <span>{badgeInfo.label}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium mt-1">
                  {studentMeta.department || 'Engineering'} · {tenant?.name || 'MITT'}
                  {studentMeta.usn && ` · USN: ${studentMeta.usn}`}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Best Rank</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">
                  {talentProfile?.overall_rank ? `#${talentProfile.overall_rank}` : 'Finalist'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Top Percentile</p>
                <p className="text-xl font-bold text-indigo-600 mt-0.5">
                  {talentProfile?.percentile ? `Top ${(100 - talentProfile.percentile).toFixed(1)}%` : 'Top 10%'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  Verified
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Recruiter Visibility & Discovery Consent */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm">Corporate Recruiter Discovery</CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsVisible(!isVisible)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isVisible
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isVisible ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Profile Visible to Recruiters
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Profile Private
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-600">
            <p>
              When enabled, verified partner companies (e.g. Bosch, Razorpay, Siemens) can discover your profile in the talent pool, review your verified hackathon submissions, and send direct interview requests.
            </p>
          </CardContent>
        </Card>

        {/* Profile Headline & Bio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Professional Headline &amp; Bio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Headline (e.g. AI Engineer | Full-Stack Developer | 3rd Year CSE)
              </label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Full-Stack Developer passionate about Distributed Systems"
                className="text-xs h-9"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Professional Bio &amp; Technical Interests
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Briefly describe your engineering background, favorite tech stacks, and what kind of technical challenges you love solving..."
                rows={4}
                className="text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Technical Skills Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Technical Skills &amp; Stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Skills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Active Skills ({skills.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-100"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="hover:text-indigo-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {skills.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No skills added yet.</p>
                )}
              </div>
            </div>

            {/* Add Custom Skill */}
            <div className="flex gap-2">
              <Input
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(newSkillInput);
                  }
                }}
                placeholder="Type a skill and press Enter..."
                className="text-xs h-9 max-w-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleAddSkill(newSkillInput)}
                className="text-xs h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Skill
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Suggested Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SKILLS_SUGGESTIONS.filter((s) => !skills.includes(s)).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleAddSkill(suggestion)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Career Preferences & Locations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Career Preferences &amp; Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Looking For */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Seeking Opportunities (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'full_time', label: 'Full-Time Role' },
                  { key: 'internship', label: 'Internship' },
                  { key: 'part_time', label: 'Part-Time' },
                  { key: 'contract', label: 'Contract / Project' },
                ].map((item) => {
                  const active = lookingFor.includes(item.key as JobTypePreference);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleJobType(item.key as JobTypePreference)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred Locations */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Locations
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {preferredLocation.map((loc) => (
                  <span
                    key={loc}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-xs"
                  >
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc)}
                      className="hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value)}
                  placeholder="e.g. Bangalore, Remote, Mysore..."
                  className="text-xs h-9 max-w-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddLocation}
                  className="text-xs h-9"
                >
                  Add Location
                </Button>
              </div>
            </div>

            {/* Available From */}
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Available to Start
              </label>
              <Input
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Links & Resume */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Professional Links &amp; Resume</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GitHub Profile URL
              </label>
              <div className="relative">
                <Github className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username"
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <Linkedin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Portfolio / Personal Website URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://myportfolio.dev"
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Official Candidate Resume (Direct Upload or Link)
              </label>
              <FileUploadDropzone
                bucket={STORAGE_BUCKETS.RESUMES}
                pathPrefix={user?.id || 'anonymous'}
                currentUrl={resumeUrl}
                onUploadComplete={(res) => {
                  setResumeUrl(res.url);
                  setSuccessMessage('Resume uploaded securely to storage! Remember to click Save Profile.');
                }}
                onRemove={() => setResumeUrl('')}
                helperText="Upload your PDF/DOCX resume (max 10MB) or specify an external link below."
              />

              <div className="mt-3">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Or provide external Resume / Drive link:
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    placeholder="https://drive.google.com/... or storage url"
                    className="pl-9 text-xs h-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs text-slate-500">
            Remember to save your changes before leaving this workspace.
          </p>

          <Button
            type="submit"
            isLoading={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 h-9"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Talent Profile
          </Button>
        </div>
      </form>
    </div>
  );
};
