import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import {
  fetchStudentInquiries,
  respondToStudentInquiry,
  StudentInquiryView,
  HIRING_PIPELINE_MIGRATION_FILE,
} from '../../lib/hiringPipeline';
import type { StudentHiringResponse } from '../../types/database';

export const StudentOffersPage: React.FC = () => {
  const { user } = useAuth();

  const [inquiries, setInquiries] = useState<StudentInquiryView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Response Modal State
  const [selectedInquiry, setSelectedInquiry] = useState<StudentInquiryView | null>(null);
  const [responseType, setResponseType] = useState<StudentHiringResponse>('accepted');
  const [studentNotes, setStudentNotes] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  const loadInquiries = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const effectiveUserId = user.id;

    setIsLoading(true);
    setErrorMessage(null);
    setIsMigrationMissing(false);

    try {
      const { inquiries: data, error, isMigrationMissing: missing } = await fetchStudentInquiries(effectiveUserId);

      if (error) {
        setErrorMessage(error);
        if (missing) setIsMigrationMissing(true);
      } else {
        setInquiries(data);
      }
    } catch (err: any) {
      console.warn('[StudentOffersPage] Error loading inquiries:', err);
      setErrorMessage(err?.message || 'Unable to load offers.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadInquiries().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadInquiries]);

  // Open Response Modal
  const handleOpenResponse = (inq: StudentInquiryView, type: StudentHiringResponse) => {
    setSelectedInquiry(inq);
    setResponseType(type);
    setStudentNotes(
      type === 'accepted'
        ? 'Thank you for reaching out! I would love to connect and discuss this opportunity further.'
        : 'Thank you for your interest. Unfortunately, I cannot pursue this opportunity at this time.'
    );
  };

  // Submit Response
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;

    setIsSubmittingResponse(true);
    const { success, error } = await respondToStudentInquiry(
      selectedInquiry.inquiry.id,
      responseType,
      studentNotes
    );

    setIsSubmittingResponse(false);

    if (!success) {
      setErrorMessage(error || 'Failed to submit response.');
    } else {
      setActionSuccess(
        responseType === 'accepted'
          ? `You have accepted the opportunity with ${selectedInquiry.company.name}!`
          : `You have declined the opportunity with ${selectedInquiry.company.name}.`
      );
      setSelectedInquiry(null);
      loadInquiries();
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Quick stats
  const totalCount = inquiries.length;
  const pendingCount = inquiries.filter((i) => i.inquiry.student_response === 'pending').length;
  const acceptedCount = inquiries.filter((i) => i.inquiry.student_response === 'accepted').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Career Inquiries &amp; Recruiter Outreach</h1>
            <Badge variant="success">Active Opportunities</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review interview requests, job offers, and recruiter messages dispatched by verified corporate partners.
          </p>
        </div>

        <Link to="/student/portfolio">
          <Button size="sm" variant="outline" className="text-xs h-9 text-indigo-600 border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Manage My Talent Profile
          </Button>
        </Link>
      </div>

      {/* Migration Notice */}
      {isMigrationMissing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Offers Database Setup Pending</p>
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

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Opportunities</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Awaiting Your Reply</p>
              <p className="text-2xl font-bold text-amber-600 mt-0.5">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accepted</p>
              <p className="text-2xl font-bold text-emerald-600 mt-0.5">{acceptedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inquiries List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Incoming Inquiries &amp; Offers</h2>

        {isLoading ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-500">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading career inquiries...
          </div>
        ) : inquiries.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Inquiries Received Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Partner companies review top hackathon finalists and talent profiles. Ensure your profile is set to visible and your skills and links are updated.
            </p>
            <div className="mt-4">
              <Link to="/student/portfolio">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                  Update Talent Profile
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {inquiries.map((item) => {
              const inq = item.inquiry;
              const comp = item.company;

              return (
                <Card
                  key={inq.id}
                  className="hover:border-slate-300 transition-all overflow-hidden border-slate-200/90"
                >
                  <CardContent className="p-6 space-y-4">
                    {/* Header: Company & Role */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-xl shrink-0 overflow-hidden">
                          {comp.logoUrl ? (
                            <img src={comp.logoUrl} alt={comp.name} className="w-full h-full object-cover" />
                          ) : (
                            comp.name[0].toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{inq.role_title}</h3>
                            <Badge
                              variant={
                                inq.interest_type === 'offer_made'
                                  ? 'default'
                                  : inq.interest_type === 'interview_requested'
                                  ? 'success'
                                  : 'secondary'
                              }
                              className="text-[11px] capitalize"
                            >
                              {inq.interest_type.replace('_', ' ')}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-medium mt-1">
                            <span className="font-semibold text-slate-800">{comp.name}</span>
                            {comp.industry && <span>· {comp.industry}</span>}
                            {comp.website && (
                              <a
                                href={comp.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Website</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Compensation & Date */}
                      <div className="text-left sm:text-right shrink-0">
                        {inq.compensation_range && (
                          <span className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                            {inq.compensation_range}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Received {new Date(inq.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Recruiter Message */}
                    {inq.message && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Message from Recruiter</span>
                        </div>
                        <p className="whitespace-pre-line leading-relaxed italic">"{inq.message}"</p>
                      </div>
                    )}

                    {/* Student Response Bar */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        {inq.student_response === 'accepted' ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              You Accepted This Opportunity
                            </span>
                            {inq.responded_at && (
                              <span className="text-[11px] text-slate-400">
                                on {new Date(inq.responded_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : inq.student_response === 'declined' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            You Declined This Opportunity
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending Your Review
                          </span>
                        )}

                        {inq.student_notes && (
                          <p className="text-xs text-slate-500 italic mt-1.5">
                            Your note: "{inq.student_notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Buttons for Pending */}
                      {inq.student_response === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResponse(item, 'declined')}
                            className="text-xs h-8 text-slate-600 hover:text-rose-600 hover:border-rose-200"
                          >
                            <ThumbsDown className="w-3 h-3 mr-1" />
                            Decline
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenResponse(item, 'accepted')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            Accept Opportunity
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* RESPONSE ACTION MODAL */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl rounded-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900">
                  {responseType === 'accepted' ? 'Accept Opportunity' : 'Decline Opportunity'}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmitResponse}>
              <CardContent className="p-6 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-900">{selectedInquiry.inquiry.role_title}</p>
                  <p className="text-[11px] text-slate-600">{selectedInquiry.company.name}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Response Note to Recruiter
                  </label>
                  <Textarea
                    rows={4}
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    placeholder="Provide your availability for an interview or contact preferences..."
                    className="text-xs"
                  />
                </div>
              </CardContent>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedInquiry(null)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmittingResponse}
                  className={`text-white font-semibold text-xs h-9 px-4 ${
                    responseType === 'accepted'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {responseType === 'accepted' ? 'Confirm Acceptance' : 'Confirm Decline'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
