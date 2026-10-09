"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dbAdapter_1 = require("../repositories/dbAdapter");
const repositories_1 = require("../repositories");
const services_1 = require("../services");
async function runTests() {
    console.log('🧪 Starting HackBridge Backend Automated Test Suite...\n');
    let passed = 0;
    let failed = 0;
    function assert(condition, testName) {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passed++;
        }
        else {
            console.error(`  ❌ FAIL: ${testName}`);
            failed++;
        }
    }
    const db = new dbAdapter_1.MemoryDatabaseAdapter();
    const userRepo = new repositories_1.UserRepository(db);
    const tenantRepo = new repositories_1.TenantRepository(db);
    const hackathonRepo = new repositories_1.HackathonRepository(db);
    const teamRepo = new repositories_1.TeamRepository(db);
    const subRepo = new repositories_1.SubmissionRepository(db);
    const evalRepo = new repositories_1.EvaluationRepository(db);
    const leaderboardRepo = new repositories_1.LeaderboardRepository(db);
    const auditRepo = new repositories_1.AuditRepository(db);
    const notifRepo = new repositories_1.NotificationRepository(db);
    const authService = new services_1.AuthService(userRepo, tenantRepo, auditRepo);
    const hackathonService = new services_1.HackathonService(hackathonRepo, auditRepo);
    const teamService = new services_1.TeamService(teamRepo, hackathonRepo, {}, auditRepo, notifRepo);
    const aiService = new services_1.AIPrescreeningService();
    const subService = new services_1.SubmissionService(subRepo, teamRepo, hackathonRepo, aiService, auditRepo, notifRepo);
    const evalService = new services_1.EvaluationService(evalRepo, hackathonRepo, subRepo, userRepo, auditRepo, notifRepo);
    // ── TEST 1: Tenant & User Creation ──
    console.log('--- 1. Auth & RBAC Security ---');
    const tenant = await tenantRepo.create({
        name: 'MITT Engineering',
        slug: 'mitt'
    });
    assert(tenant.slug === 'mitt', 'Tenant creation with unique slug');
    const { token, user } = await authService.register({
        email: 'aditi@mitt.edu.in',
        password: 'Password123!',
        fullName: 'Aditi Sharma',
        role: 'student',
        tenantSlugOrId: 'mitt'
    });
    assert(user.email === 'aditi@mitt.edu.in', 'Student registration success');
    assert(user.role === 'student', 'Student role properly assigned');
    assert(typeof token === 'string' && token.length > 20, 'JWT token issued');
    // Verify privilege escalation rejection
    try {
        await authService.register({
            email: 'attacker@mitt.edu.in',
            password: 'Password123!',
            fullName: 'Hacker',
            role: 'super_admin',
            tenantSlugOrId: 'mitt'
        });
        assert(false, 'Should reject self-registration as super_admin');
    }
    catch (err) {
        assert(err.message.includes('prohibited'), 'Privilege escalation defense works (super_admin blocked)');
    }
    // ── TEST 2: Hackathon Lifecycle State Machine ──
    console.log('\n--- 2. Hackathon Lifecycle State Machine ---');
    const hackathon = await hackathonService.createHackathon({
        tenant_id: tenant.id,
        title: 'MITT Hack 2026',
        created_by: user.id,
        status: 'draft',
        registration_start: new Date().toISOString(),
        registration_end: new Date(Date.now() + 86400000).toISOString(),
        hacking_start: new Date(Date.now() + 86400000 * 2).toISOString(),
        hacking_end: new Date(Date.now() + 86400000 * 4).toISOString(),
        evaluation_start: new Date(Date.now() + 86400000 * 4).toISOString(),
        evaluation_end: new Date(Date.now() + 86400000 * 6).toISOString()
    });
    assert(hackathon.status === 'draft', 'Hackathon starts in draft state');
    const advanced = await hackathonService.transitionState(hackathon.id, 'registration', user.id, tenant.id);
    assert(advanced.status === 'registration', 'Valid transition: draft -> registration');
    try {
        // Attempt invalid jump: registration -> completed (must fail)
        await hackathonService.transitionState(hackathon.id, 'completed', user.id, tenant.id);
        assert(false, 'Should reject invalid skip transition');
    }
    catch (err) {
        assert(err.message.includes('Invalid lifecycle transition'), 'Invalid state transition rejected');
    }
    // ── TEST 3: AI Pre-Screening Engine ──
    console.log('\n--- 3. AI Pre-Screening & Triage Engine ---');
    const triageClean = aiService.analyzeSubmission({
        title: 'NeuralEdge Traffic Optimization',
        abstract: 'An autonomous computer vision system running quantized YOLO on edge devices to detect emergency vehicles and clear traffic corridors in real-time.',
        approach: 'Deployed on NVIDIA Jetson with MQTT telemetry bus connecting to central metropolitan traffic controller.',
        repo_url: 'https://github.com/neuraledge/traffic',
        demo_url: 'https://demo.neuraledge.io',
        tech_stack: ['Python', 'YOLOv8', 'TensorRT', 'FastAPI']
    });
    assert(triageClean.readinessScore >= 80, `Clean submission gets high readiness score (${triageClean.readinessScore}/100)`);
    assert(triageClean.flags.includes('PASSED_TRIAGE'), 'Clean submission passes automated triage');
    const triageBogus = aiService.analyzeSubmission({
        title: 'Test App',
        abstract: 'lorem ipsum placeholder',
        approach: 'todo',
        repo_url: '',
        tech_stack: []
    });
    assert(triageBogus.readinessScore < 40, `Incomplete submission gets low readiness score (${triageBogus.readinessScore}/100)`);
    assert(triageBogus.flags.includes('PLACEHOLDER_CONTENT_DETECTED'), 'Placeholder content flag triggered');
    assert(triageBogus.flags.includes('MISSING_REPO_LINK'), 'Missing repo link flag triggered');
    // Summary
    console.log(`\n===========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`===========================================\n`);
}
if (require.main === module) {
    runTests().catch(console.error);
}
