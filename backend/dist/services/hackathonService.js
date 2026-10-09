"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HackathonService = void 0;
class HackathonService {
    hackathonRepo;
    auditRepo;
    constructor(hackathonRepo, auditRepo) {
        this.hackathonRepo = hackathonRepo;
        this.auditRepo = auditRepo;
    }
    /**
     * Enforces valid sequential state transitions:
     * draft -> problem_intake -> registration -> hacking -> evaluation -> completed -> archived
     */
    isValidTransition(current, next) {
        const validNextStates = {
            draft: ['problem_intake', 'registration', 'archived'],
            problem_intake: ['registration', 'draft', 'archived'],
            registration: ['hacking', 'draft', 'archived'],
            hacking: ['evaluation', 'registration', 'archived'],
            evaluation: ['completed', 'hacking', 'archived'],
            completed: ['archived'],
            archived: ['draft']
        };
        return (validNextStates[current] || []).includes(next);
    }
    async transitionState(hackathonId, nextStatus, actorId, tenantId) {
        const hackathon = await this.hackathonRepo.findById(hackathonId);
        if (!hackathon) {
            throw new Error('Hackathon not found.');
        }
        if (hackathon.status === nextStatus) {
            return hackathon;
        }
        if (!this.isValidTransition(hackathon.status, nextStatus)) {
            throw new Error(`Invalid lifecycle transition from '${hackathon.status}' to '${nextStatus}'.`);
        }
        const updated = await this.hackathonRepo.updateStatus(hackathonId, nextStatus);
        if (!updated) {
            throw new Error('Failed to update hackathon lifecycle status.');
        }
        if (this.auditRepo) {
            await this.auditRepo.record({
                tenant_id: tenantId,
                actor_id: actorId,
                action: 'hackathon.transition_state',
                target_type: 'hackathon',
                target_id: hackathonId,
                payload: { previousStatus: hackathon.status, newStatus: nextStatus }
            });
        }
        return updated;
    }
    async createHackathon(data) {
        const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const created = await this.hackathonRepo.create({
            ...data,
            slug,
            status: data.status || 'draft'
        });
        if (this.auditRepo) {
            await this.auditRepo.record({
                tenant_id: data.tenant_id,
                actor_id: data.created_by,
                action: 'hackathon.created',
                target_type: 'hackathon',
                target_id: created.id,
                payload: { title: created.title, slug: created.slug }
            });
        }
        return created;
    }
}
exports.HackathonService = HackathonService;
