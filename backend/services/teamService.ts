import { TeamRepository, HackathonRepository, ProblemRepository, AuditRepository, NotificationRepository } from '../repositories';
import { Team } from '../models';

export class TeamService {
  constructor(
    private teamRepo: TeamRepository,
    private hackathonRepo: HackathonRepository,
    private problemRepo: ProblemRepository,
    private auditRepo?: AuditRepository,
    private notificationRepo?: NotificationRepository
  ) {}

  async createTeam(
    hackathonId: string,
    name: string,
    userId: string,
    tenantId: string
  ): Promise<Team> {
    const hackathon = await this.hackathonRepo.findById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');

    if (hackathon.status !== 'registration' && hackathon.status !== 'hacking' && hackathon.status !== 'problem_intake') {
      throw new Error(`Team formation is closed because the hackathon is currently in '${hackathon.status}' phase.`);
    }

    if (!name || name.trim().length < 3) {
      throw new Error('Team name must be at least 3 characters long.');
    }

    const team = await this.teamRepo.createTeam(hackathonId, name, userId, {
      maxMembers: hackathon.max_team_size || 4
    });

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'team.created',
        target_type: 'team',
        target_id: team.id,
        payload: { teamName: team.name, inviteCode: team.invite_code }
      });
    }

    return team;
  }

  async joinTeamWithCode(
    hackathonId: string,
    inviteCode: string,
    userId: string,
    tenantId: string
  ): Promise<Team> {
    const hackathon = await this.hackathonRepo.findById(hackathonId);
    if (!hackathon) throw new Error('Hackathon not found.');

    if (hackathon.status !== 'registration' && hackathon.status !== 'hacking') {
      throw new Error(`Joining teams is closed because the event is currently in '${hackathon.status}' phase.`);
    }

    const team = await this.teamRepo.joinTeamWithCode(hackathonId, inviteCode, userId);

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'team.joined',
        target_type: 'team',
        target_id: team.id,
        payload: { teamName: team.name, inviteCode }
      });
    }

    // Notify team leader
    if (this.notificationRepo && team.created_by && team.created_by !== userId) {
      await this.notificationRepo.create({
        user_id: team.created_by,
        title: 'New Team Member Joined',
        message: `A new member has joined your team '${team.name}'.`,
        type: 'team_update',
        link: '/student/team'
      });
    }

    return team;
  }

  async selectProblem(
    teamId: string,
    problemId: string,
    userId: string,
    tenantId: string
  ): Promise<Team> {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new Error('Team not found.');

    if (team.created_by !== userId) {
      throw new Error('Only the team leader can select or change the problem statement challenge.');
    }

    const problem = await this.problemRepo.findById(problemId);
    if (!problem) throw new Error('Problem statement not found.');
    if (problem.hackathon_id !== team.hackathon_id) {
      throw new Error('This problem statement does not belong to the active hackathon.');
    }

    const updated = await this.teamRepo.selectProblem(teamId, problemId);
    if (!updated) throw new Error('Failed to lock problem statement.');

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'team.selected_problem',
        target_type: 'team',
        target_id: team.id,
        payload: { problemId, problemTitle: problem.title }
      });
    }

    return updated;
  }
}
