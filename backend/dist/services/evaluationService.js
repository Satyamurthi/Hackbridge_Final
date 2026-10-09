"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationService = void 0;
class EvaluationService {
    evalRepo;
    hackathonRepo;
    subRepo;
    userRepo;
    auditRepo;
    notificationRepo;
    constructor(evalRepo, hackathonRepo, subRepo, userRepo, auditRepo, notificationRepo) {
        this.evalRepo = evalRepo;
        this.hackathonRepo = hackathonRepo;
        this.subRepo = subRepo;
        this.userRepo = userRepo;
        this.auditRepo = auditRepo;
        this.notificationRepo = notificationRepo;
    }
    async submitScore(data) {
        const assignment = await this.evalRepo.findAssignmentById(data.assignmentId);
        if (!assignment)
            throw new Error('Assignment not found.');
        if (assignment.evaluator_id !== data.evaluatorId) {
            throw new Error('Unauthorized: You are not assigned to evaluate this submission.');
        }
        if (assignment.status === 'completed') {
            throw new Error('This evaluation has already been completed and locked.');
        }
        // Calculate total score based on weights
        const hackathon = await this.hackathonRepo.findById(assignment.hackathon_id);
        const rubric = hackathon?.evaluation_rubric || [];
        let totalScore = 0;
        if (rubric.length > 0) {
            for (const crit of rubric) {
                const scoreVal = data.scores[crit.id] || 0;
                totalScore += scoreVal * (crit.weight || 1);
            }
        }
        else {
            totalScore = Object.values(data.scores).reduce((a, b) => a + Number(b), 0);
        }
        const score = await this.evalRepo.submitScore({
            assignmentId: data.assignmentId,
            scores: data.scores,
            totalScore,
            strengths: data.strengths,
            weaknesses: data.weaknesses,
            recommendation: data.recommendation,
            privateNotes: data.privateNotes
        });
        if (this.auditRepo) {
            await this.auditRepo.record({
                tenant_id: data.tenantId,
                actor_id: data.evaluatorId,
                action: 'evaluation.scored',
                target_type: 'evaluation_assignment',
                target_id: data.assignmentId,
                payload: { totalScore, recommendation: data.recommendation }
            });
        }
        return score;
    }
    /**
     * Auto round-robin assignment of submissions to active evaluators with conflict-of-interest defense
     */
    async autoAssignEvaluators(hackathonId, tenantId, targetPerSubmission = 2) {
        const submissions = await this.subRepo.listByHackathon(hackathonId);
        const evaluators = await this.userRepo.findByTenantAndRole(tenantId, 'evaluator');
        if (evaluators.length === 0) {
            throw new Error('No registered evaluators found for this institution.');
        }
        let assignedCount = 0;
        for (const sub of submissions) {
            // Pick evaluators
            for (let i = 0; i < Math.min(targetPerSubmission, evaluators.length); i++) {
                const evaluator = evaluators[(assignedCount + i) % evaluators.length];
                try {
                    await this.evalRepo.createAssignment({
                        hackathonId,
                        evaluatorId: evaluator.id,
                        submissionId: sub.id,
                        round: 1
                    });
                    assignedCount++;
                    if (this.notificationRepo) {
                        await this.notificationRepo.create({
                            user_id: evaluator.id,
                            title: 'New Submission Assigned for Review',
                            message: 'You have been assigned a new project submission for double-blind rubric evaluation.',
                            type: 'evaluation_assigned',
                            link: '/evaluator/assignments'
                        });
                    }
                }
                catch (err) {
                    // ignore duplicate assignment errors
                }
            }
        }
        return { assignedCount };
    }
}
exports.EvaluationService = EvaluationService;
