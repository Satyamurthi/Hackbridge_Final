import { SubmissionRepository, TeamRepository, HackathonRepository, AuditRepository, NotificationRepository } from '../repositories';
import { AIPrescreeningService } from './aiPrescreeningService';
import { Submission } from '../models';

export class SubmissionService {
  constructor(
    private submissionRepo: SubmissionRepository,
    private teamRepo: TeamRepository,
    private hackathonRepo: HackathonRepository,
    private aiPrescreeningService: AIPrescreeningService,
    private auditRepo?: AuditRepository,
    private notificationRepo?: NotificationRepository
  ) {}

  async saveDraft(data: Partial<Submission> & {
    hackathon_id: string;
    team_id: string;
    title: string;
    abstract: string;
    approach: string;
    submitted_by: string;
    tenant_id: string;
  }): Promise<Submission> {
    const hackathon = await this.hackathonRepo.findById(data.hackathon_id);
    if (!hackathon) throw new Error('Hackathon not found.');

    if (hackathon.status !== 'hacking' && hackathon.status !== 'registration') {
      throw new Error(`Submissions are closed. The hackathon is currently in '${hackathon.status}' phase.`);
    }

    // Verify user belongs to the team
    const team = await this.teamRepo.findById(data.team_id);
    if (!team) throw new Error('Team not found.');
    const isMember = team.members?.some((m) => m.user_id === data.submitted_by);
    if (!isMember && team.created_by !== data.submitted_by) {
      throw new Error('You are not authorized to submit for this team.');
    }

    // Run AI prescreening check
    const triage = this.aiPrescreeningService.analyzeSubmission(data);

    const submission = await this.submissionRepo.upsertDraft(data);

    // Save AI screening score
    await this.submissionRepo.updateAIPreScreening(
      submission.id,
      triage.flags,
      triage.readinessScore
    );

    submission.ai_flags = triage.flags;
    submission.ai_readiness_score = triage.readinessScore;

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: data.tenant_id,
        actor_id: data.submitted_by,
        action: 'submission.saved_draft',
        target_type: 'submission',
        target_id: submission.id,
        payload: { title: submission.title, readinessScore: triage.readinessScore }
      });
    }

    return submission;
  }

  async lockSubmission(
    submissionId: string,
    userId: string,
    tenantId: string
  ): Promise<Submission> {
    const sub = await this.submissionRepo.findById(submissionId);
    if (!sub) throw new Error('Submission not found.');

    const team = await this.teamRepo.findById(sub.team_id);
    if (!team) throw new Error('Team not found.');
    if (team.created_by !== userId) {
      throw new Error('Only the team leader can finalize and lock the project submission.');
    }

    const locked = await this.submissionRepo.lockSubmission(submissionId, userId);

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'submission.locked',
        target_type: 'submission',
        target_id: locked.id,
        payload: { title: locked.title, lockedAt: locked.lock_timestamp }
      });
    }

    // Notify all team members
    if (this.notificationRepo && team.members) {
      for (const m of team.members) {
        await this.notificationRepo.create({
          user_id: m.user_id,
          title: 'Project Submission Finalized',
          message: `Your team's submission '${locked.title}' has been locked for judging.`,
          type: 'submission_status',
          link: '/student/submissions'
        });
      }
    }

    return locked;
  }
}
