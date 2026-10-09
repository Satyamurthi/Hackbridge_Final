-- ============================================================================
-- HackBridge Production-Ready Seed Data
-- ============================================================================

-- 1. Pilot Institution Tenant (MITT)
INSERT INTO tenants (id, slug, name, custom_domain, subdomain, primary_color, secondary_color, plan, is_active)
VALUES (
    '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b',
    'mitt',
    'Maharaja Institute of Technology Thandavapura',
    'mitt.edu.in',
    'mitt',
    '#4F46E5',
    '#7C3AED',
    'enterprise',
    true
) ON CONFLICT (slug) DO NOTHING;

-- 2. Seed Users across all stakeholder roles (passwords hashed for PBKDF2: "Password123!")
-- Hash of 'Password123!' with salt 'a1b2c3d4e5f67890'
-- 'a1b2c3d4e5f67890:5a415a7703fd88d9047b85848bb220194488b0a9446fecddc1103c800880313837943ff7eb56e897931f618a096c4295982823a85010620c388a101f3089d71c'
INSERT INTO users (id, email, password_hash, role, tenant_id, full_name, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@mitt.edu.in', 'a1b2c3d4e5f67890:5a415a7703fd88d9047b85848bb220194488b0a9446fecddc1103c800880313837943ff7eb56e897931f618a096c4295982823a85010620c388a101f3089d71c', 'college_admin', '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b', 'Dr. Ramesh Kumar (Dean R&D)', true),
    ('a0000000-0000-0000-0000-000000000002', 'student@mitt.edu.in', 'a1b2c3d4e5f67890:5a415a7703fd88d9047b85848bb220194488b0a9446fecddc1103c800880313837943ff7eb56e897931f618a096c4295982823a85010620c388a101f3089d71c', 'student', '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b', 'Aditi Sharma', true),
    ('a0000000-0000-0000-0000-000000000003', 'evaluator@mitt.edu.in', 'a1b2c3d4e5f67890:5a415a7703fd88d9047b85848bb220194488b0a9446fecddc1103c800880313837943ff7eb56e897931f618a096c4295982823a85010620c388a101f3089d71c', 'evaluator', '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b', 'Prof. Suresh Verma', true),
    ('a0000000-0000-0000-0000-000000000004', 'recruiter@bosch.com', 'a1b2c3d4e5f67890:5a415a7703fd88d9047b85848bb220194488b0a9446fecddc1103c800880313837943ff7eb56e897931f618a096c4295982823a85010620c388a101f3089d71c', 'company_rep', '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b', 'Pooja Hegde (Bosch Engineering)', true)
ON CONFLICT (email) DO NOTHING;

-- 3. Live Pilot Hackathon
INSERT INTO hackathons (
    id, tenant_id, title, slug, tagline, description, status,
    registration_start, registration_end, hacking_start, hacking_end,
    evaluation_start, evaluation_end, min_team_size, max_team_size,
    evaluation_rubric, tracks, created_by
) VALUES (
    'h0000000-0000-0000-0000-000000000001',
    '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b',
    'MITT Innovate 2026',
    'mitt-innovate-2026',
    'Flagship Annual Technology & Engineering Hackathon',
    'Autonomous Edge AI, Sustainable Smart Cities, and Embedded IoT Solutions.',
    'hacking',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '5 days',
    2,
    4,
    '[
      {"id": "crit_tech", "name": "Technical Innovation", "max_score": 10, "weight": 0.35},
      {"id": "crit_arch", "name": "System Architecture & Execution", "max_score": 10, "weight": 0.25},
      {"id": "crit_ux", "name": "Design & Usability", "max_score": 10, "weight": 0.20},
      {"id": "crit_impact", "name": "Feasibility & Practical Impact", "max_score": 10, "weight": 0.20}
    ]'::jsonb,
    '["Edge Computing & AI", "Smart Infrastructure", "Fintech & Security"]'::jsonb,
    'a0000000-0000-0000-0000-000000000001'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 4. Industry Partner Company
INSERT INTO companies (id, tenant_id, name, slug, industry, website, verified, created_by)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    '26e6c65a-b7a6-4caf-9d6a-1c6f85e9835b',
    'Bosch Engineering India',
    'bosch-engineering',
    'Automotive & IoT',
    'https://www.bosch.in',
    true,
    'a0000000-0000-0000-0000-000000000004'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 5. Published Problem Statement
INSERT INTO problem_statements (
    id, hackathon_id, company_id, title, slug, description,
    track, difficulty, status, created_by
) VALUES (
    'p0000000-0000-0000-0000-000000000001',
    'h0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Edge-AI Emergency Vehicle Corridor Preemption',
    'edge-ai-emergency-preemption',
    'Develop an edge computer vision pipeline running quantized YOLO to detect sirens/emergency vehicles and automatically trigger dynamic green corridor phase intervals.',
    'Edge Computing & AI',
    'hard',
    'published',
    'a0000000-0000-0000-0000-000000000004'
) ON CONFLICT (hackathon_id, slug) DO NOTHING;
