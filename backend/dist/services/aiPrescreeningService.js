"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPrescreeningService = void 0;
class AIPrescreeningService {
    /**
     * Automated heuristic & similarity pre-screening engine
     */
    analyzeSubmission(sub) {
        const flags = [];
        const feedback = [];
        let score = 100;
        const title = (sub.title || '').trim();
        const abstract = (sub.abstract || '').trim();
        const approach = (sub.approach || '').trim();
        const repo = (sub.repo_url || '').trim();
        const demo = (sub.demo_url || '').trim();
        const presentation = (sub.presentation_url || '').trim();
        const video = (sub.video_url || '').trim();
        const techStack = sub.tech_stack || [];
        // 1. Placeholder & dummy content detection
        const placeholderRegex = /\b(test|asdf|qwerty|lorem ipsum|todo|dummy|temp|sample|abc)\b/i;
        if (placeholderRegex.test(title) || placeholderRegex.test(abstract)) {
            flags.push('PLACEHOLDER_CONTENT_DETECTED');
            feedback.push('Submission contains generic placeholder text. Provide substantive project details.');
            score -= 30;
        }
        // 2. Abstract depth
        if (abstract.length < 50) {
            flags.push('ABSTRACT_INSUFFICIENT');
            feedback.push('Project abstract is too brief. Provide at least 50 characters describing the problem and solution.');
            score -= 20;
        }
        else if (abstract.length >= 150) {
            score += 5; // bonus for comprehensive abstract
        }
        // 3. Technical approach
        if (approach.length < 50) {
            flags.push('APPROACH_INSUFFICIENT');
            feedback.push('Technical approach lacks architectural depth. Describe system components and data flow.');
            score -= 20;
        }
        // 4. Code repository verification
        if (!repo) {
            flags.push('MISSING_REPO_LINK');
            feedback.push('No source code repository provided. Include a valid GitHub or GitLab URL.');
            score -= 25;
        }
        else if (!repo.startsWith('https://github.com/') && !repo.startsWith('https://gitlab.com/')) {
            flags.push('INVALID_REPO_DOMAIN');
            feedback.push('Repository URL must be an active HTTPS link to GitHub or GitLab.');
            score -= 10;
        }
        // 5. Working deliverables (Demo, Presentation, Video)
        const deliverableCount = [demo, presentation, video].filter(Boolean).length;
        if (deliverableCount === 0) {
            flags.push('NO_LIVE_DEMO_OR_SLIDES');
            feedback.push('At least one live demo, presentation deck, or video walkthrough is strongly recommended.');
            score -= 15;
        }
        else {
            score += deliverableCount * 5;
        }
        // 6. Tech stack
        if (techStack.length === 0) {
            flags.push('EMPTY_TECH_STACK');
            feedback.push('List the key programming languages, frameworks, and tools used.');
            score -= 10;
        }
        // Clamp score between 0 and 100
        const finalScore = Math.max(0, Math.min(100, score));
        let recommendation = 'ready';
        if (finalScore < 40) {
            recommendation = 'rejected';
        }
        else if (finalScore < 70) {
            recommendation = 'needs_revision';
        }
        if (flags.length === 0) {
            flags.push('PASSED_TRIAGE');
            feedback.push('Submission satisfies all automated pre-screening criteria.');
        }
        return {
            readinessScore: finalScore,
            flags,
            recommendation,
            feedback
        };
    }
}
exports.AIPrescreeningService = AIPrescreeningService;
