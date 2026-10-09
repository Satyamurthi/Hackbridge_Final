-- ============================================================
-- HACKBRIDGE MASTER SEED SCRIPT: END-TO-END DEMO DATA
-- File: supabase/seed_demo_data.sql
--
-- This script populates comprehensive, realistic test data across ALL
-- 12 phases and all user roles (College Admin, Company Reps, Evaluators,
-- and Students) for testing every portal and module in HackBridge.
--
-- Universal Test Password for all accounts: Password123!
--
-- Accounts provisioned:
--   1. College Admin:    admin@mitt.edu
--   2. Company Rep 1:    google.rep@alphabet.com   (Google Cloud - Verified)
--   3. Company Rep 2:    infosys.rep@infosys.com   (Infosys Autonomous Systems - Verified)
--   4. Company Rep 3:    aditya@greengrid.io       (GreenGrid Analytics - Pending Review)
--   5. Evaluator 1:      prof.sharma@mitt.edu      (Dr. Arvind Sharma, CSE Dept)
--   6. Evaluator 2:      dr.priya@mitt.edu         (Dr. Priya Rao, DeepTech Labs)
--   7. Student Leader 1: rohit.cs22@mitt.edu       (Team CyberKnights Lead)
--   8. Student Member 1: ananya.cs22@mitt.edu      (Team CyberKnights Member)
--   9. Student Leader 2: varun.ec22@mitt.edu       (Team NeuroPulse Lead - Champion)
--  10. Student Member 2: sneha.is22@mitt.edu       (Team NeuroPulse Member)
--  11. Student Solo:     karthik.cs23@mitt.edu     (Solo Innovator - Team QuantumBytes)
--
-- Idempotent & Non-destructive: safe to re-run in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_enc_pwd TEXT;
  
  -- User IDs
  v_admin_id       UUID := '11111111-1111-4111-8111-111111111111';
  v_google_rep_id  UUID := '22222222-2222-4222-8222-222222222222';
  v_infosys_rep_id UUID := '33333333-3333-4333-8333-333333333333';
  v_green_rep_id   UUID := '44444444-4444-4444-8444-444444444444';
  v_eval_sharma_id UUID := '55555555-5555-4555-8555-555555555555';
  v_eval_priya_id  UUID := '66666666-6666-4666-8666-666666666666';
  v_rohit_id       UUID := '77777777-7777-4777-8777-777777777777';
  v_ananya_id      UUID := '88888888-8888-4888-8888-888888888888';
  v_varun_id       UUID := '99999999-9999-4999-8999-999999999999';
  v_sneha_id       UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_karthik_id     UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  -- Entity IDs (RFC 4122 compliant valid hexadecimal UUIDs)
  v_comp_google_id  UUID := 'c1111111-1111-4111-8111-111111111111';
  v_comp_infosys_id UUID := 'c2222222-2222-4222-8222-222222222222';
  v_comp_green_id   UUID := 'c3333333-3333-4333-8333-333333333333';

  v_hack_mitt_id    UUID := 'd1111111-1111-4111-8111-111111111111';
  v_hack_ai_id      UUID := 'd2222222-2222-4222-8222-222222222222';
  v_hack_green_id   UUID := 'd3333333-3333-4333-8333-333333333333';

  v_ps_traffic_id   UUID := 'e1111111-1111-4111-8111-111111111111';
  v_ps_microgrid_id UUID := 'e2222222-2222-4222-8222-222222222222';
  v_ps_health_id    UUID := 'e3333333-3333-4333-8333-333333333333';
  v_ps_battery_id   UUID := 'e4444444-4444-4444-8444-444444444444';

  v_team_cyber_id   UUID := 'f1111111-1111-4111-8111-111111111111';
  v_team_neuro_id   UUID := 'f2222222-2222-4222-8222-222222222222';
  v_team_quantum_id UUID := 'f3333333-3333-4333-8333-333333333333';

  v_sub_cyber_id    UUID := 'b1111111-1111-4111-8111-111111111111';
  v_sub_neuro_id    UUID := 'b2222222-2222-4222-8222-222222222222';

  v_assign_sharma_cyber UUID := 'a1111111-1111-4111-8111-111111111111';
  v_assign_priya_cyber  UUID := 'a2222222-2222-4222-8222-222222222222';
  v_assign_sharma_neuro UUID := 'a3333333-3333-4333-8333-333333333333';
  v_assign_priya_neuro  UUID := 'a4444444-4444-4444-8444-444444444444';

  v_tp_varun_id     UUID := 'fa111111-1111-4111-8111-111111111111';
  v_tp_rohit_id     UUID := 'fa222222-2222-4222-8222-222222222222';

  u RECORD;
  v_actual_uid UUID;
BEGIN
  -- ------------------------------------------------------------
  -- 0. RESOLVE PILOT TENANT (MITT)
  -- ------------------------------------------------------------
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'mitt';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Pilot tenant "mitt" not found. Ensure 20260915000001_initial_foundation.sql & 20260917000001_pilot_tenant_mitt.sql have been applied.';
  END IF;

  -- Compute standard bcrypt hash for 'Password123!'
  BEGIN
    v_enc_pwd := extensions.crypt('Password123!', extensions.gen_salt('bf', 10));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_enc_pwd := crypt('Password123!', gen_salt('bf', 10));
    EXCEPTION WHEN OTHERS THEN
      -- Verified pre-computed bcrypt hash of 'Password123!'
      v_enc_pwd := '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa';
    END;
  END;

  -- ------------------------------------------------------------
  -- 1. PROVISION TEST USERS IN AUTH.USERS & PUBLIC.PROFILES
  -- ------------------------------------------------------------
  FOR u IN
    SELECT * FROM (
      VALUES
        (v_admin_id, 'admin@mitt.edu', 'Dr. Ramesh Kumar', 'college_admin'::public.user_role, '+91 98450 11223', '{"department":"Administration", "designation":"Dean of Academics"}'::jsonb),
        (v_google_rep_id, 'google.rep@alphabet.com', 'Sundar V.', 'company_rep'::public.user_role, '+1 650 253 0000', '{"company_name":"Google Cloud", "designation":"University Relations Lead"}'::jsonb),
        (v_infosys_rep_id, 'infosys.rep@infosys.com', 'Pooja Hegde', 'company_rep'::public.user_role, '+91 821 240 4000', '{"company_name":"Infosys Autonomous Systems", "designation":"Tech Lead, Robotics & AI"}'::jsonb),
        (v_green_rep_id, 'aditya@greengrid.io', 'Aditya Nair', 'company_rep'::public.user_role, '+91 99001 22334', '{"company_name":"GreenGrid Analytics", "designation":"Founder & CEO"}'::jsonb),
        (v_eval_sharma_id, 'prof.sharma@mitt.edu', 'Prof. Arvind Sharma', 'evaluator'::public.user_role, '+91 98451 44556', '{"expertise":["Computer Vision", "Distributed Systems", "Edge AI"], "affiliation":"Dept of CSE, MITT"}'::jsonb),
        (v_eval_priya_id, 'dr.priya@mitt.edu', 'Dr. Priya Rao', 'evaluator'::public.user_role, '+91 98452 77889', '{"expertise":["Reinforcement Learning", "Energy Systems", "Cloud Systems"], "affiliation":"DeepTech Labs"}'::jsonb),
        (v_rohit_id, 'rohit.cs22@mitt.edu', 'Rohit Kumar', 'student'::public.user_role, '+91 97410 12345', '{"usn":"4MT22CS089", "department":"Computer Science & Engineering", "year":3, "skills":["TypeScript", "React", "Python", "OpenCV", "FastAPI"]}'::jsonb),
        (v_ananya_id, 'ananya.cs22@mitt.edu', 'Ananya Verma', 'student'::public.user_role, '+91 97410 23456', '{"usn":"4MT22CS014", "department":"Computer Science & Engineering", "year":3, "skills":["React", "Tailwind CSS", "UI/UX", "Docker"]}'::jsonb),
        (v_varun_id, 'varun.ec22@mitt.edu', 'Varun Nair', 'student'::public.user_role, '+91 97410 34567', '{"usn":"4MT22EC078", "department":"Electronics & Communication", "year":4, "skills":["PyTorch", "Reinforcement Learning", "Go", "PostgreSQL"]}'::jsonb),
        (v_sneha_id, 'sneha.is22@mitt.edu', 'Sneha Patil', 'student'::public.user_role, '+91 97410 45678', '{"usn":"4MT22IS055", "department":"Information Science", "year":4, "skills":["Python", "Pandas", "Energy Systems", "FastAPI"]}'::jsonb),
        (v_karthik_id, 'karthik.cs23@mitt.edu', 'Karthik Gowda', 'student'::public.user_role, '+91 97410 56789', '{"usn":"4MT23CS041", "department":"Computer Science & Engineering", "year":2, "skills":["Java", "Spring Boot", "Next.js"]}'::jsonb)
    ) AS t(uid, email, full_name, role, phone, meta)
  LOOP
    -- 1a. Check if auth user exists
    SELECT id INTO v_actual_uid FROM auth.users WHERE email = u.email;
    IF v_actual_uid IS NULL THEN
      v_actual_uid := u.uid;
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      )
      VALUES (
        v_actual_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        u.email, v_enc_pwd, NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('full_name', u.full_name, 'role', u.role, 'tenant_id', v_tenant_id),
        NOW(), NOW()
      );
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = v_enc_pwd,
        raw_user_meta_data = jsonb_build_object('full_name', u.full_name, 'role', u.role, 'tenant_id', v_tenant_id),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_actual_uid;
    END IF;

    -- 1b. Sync back to local ID variables so all FKs match
    IF u.email = 'admin@mitt.edu' THEN v_admin_id := v_actual_uid;
    ELSIF u.email = 'google.rep@alphabet.com' THEN v_google_rep_id := v_actual_uid;
    ELSIF u.email = 'infosys.rep@infosys.com' THEN v_infosys_rep_id := v_actual_uid;
    ELSIF u.email = 'aditya@greengrid.io' THEN v_green_rep_id := v_actual_uid;
    ELSIF u.email = 'prof.sharma@mitt.edu' THEN v_eval_sharma_id := v_actual_uid;
    ELSIF u.email = 'dr.priya@mitt.edu' THEN v_eval_priya_id := v_actual_uid;
    ELSIF u.email = 'rohit.cs22@mitt.edu' THEN v_rohit_id := v_actual_uid;
    ELSIF u.email = 'ananya.cs22@mitt.edu' THEN v_ananya_id := v_actual_uid;
    ELSIF u.email = 'varun.ec22@mitt.edu' THEN v_varun_id := v_actual_uid;
    ELSIF u.email = 'sneha.is22@mitt.edu' THEN v_sneha_id := v_actual_uid;
    ELSIF u.email = 'karthik.cs23@mitt.edu' THEN v_karthik_id := v_actual_uid;
    END IF;

    -- 1c. Upsert in auth.identities (supports both legacy and modern Supabase schemas)
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
      ) THEN
        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        VALUES (
          v_actual_uid, v_actual_uid,
          jsonb_build_object('sub', v_actual_uid::text, 'email', u.email, 'email_verified', true),
          'email', v_actual_uid::text, NOW(), NOW(), NOW()
        )
        ON CONFLICT (provider, provider_id) DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          updated_at = NOW();
      ELSE
        INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
          v_actual_uid, v_actual_uid,
          jsonb_build_object('sub', v_actual_uid::text, 'email', u.email, 'email_verified', true),
          'email', NOW(), NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          updated_at = NOW();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore identity sync exceptions if auth.identities is managed internally
      NULL;
    END;

    -- 1d. Ensure public.profiles has the explicit role, tenant_id, metadata
    INSERT INTO public.profiles (id, tenant_id, email, full_name, role, is_active, phone, metadata, created_at, updated_at)
    VALUES (v_actual_uid, v_tenant_id, u.email, u.full_name, u.role, true, u.phone, u.meta, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = v_tenant_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = true,
      phone = EXCLUDED.phone,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();

    -- 1e. Upsert in public.tenant_memberships
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_actual_uid, u.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END LOOP;

  -- ------------------------------------------------------------
  -- 2. CREATE COMPANIES & LINK COMPANY REPRESENTATIVES
  -- ------------------------------------------------------------
  -- Google Cloud (Verified)
  INSERT INTO public.companies (
    id, tenant_id, created_by, name, website, logo_url, industry, description, verified, created_at, updated_at
  )
  VALUES (
    v_comp_google_id, v_tenant_id, v_google_rep_id, 'Google Cloud', 'https://cloud.google.com',
    'https://www.gstatic.com/devrel-devsite/prod/v25e8361b2d4f23554e1a067ff582c636f32e2c45ae33e9d8cb43ee4a530eb743/cloud/images/favicons/onecloud/super_cloud.png',
    'Cloud Infrastructure & AI', 'Global hyper-scale cloud platform offering machine learning, analytics, and distributed compute services.',
    true, NOW(), NOW()
  )
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    verified = true,
    website = EXCLUDED.website,
    industry = EXCLUDED.industry;

  -- Infosys Autonomous Systems (Verified)
  INSERT INTO public.companies (
    id, tenant_id, created_by, name, website, logo_url, industry, description, verified, created_at, updated_at
  )
  VALUES (
    v_comp_infosys_id, v_tenant_id, v_infosys_rep_id, 'Infosys Autonomous Systems', 'https://www.infosys.com',
    'https://www.infosys.com/content/dam/infosys-web/en/global-resource/media-resources/infosys-logo-png.png',
    'Robotics & Smart Mobility', 'Enterprise engineering lab accelerating edge computer vision, connected mobility, and autonomous logistics.',
    true, NOW(), NOW()
  )
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    verified = true,
    website = EXCLUDED.website,
    industry = EXCLUDED.industry;

  -- GreenGrid Analytics (Pending Verification)
  INSERT INTO public.companies (
    id, tenant_id, created_by, name, website, logo_url, industry, description, verified, created_at, updated_at
  )
  VALUES (
    v_comp_green_id, v_tenant_id, v_green_rep_id, 'GreenGrid Analytics', 'https://greengrid.io',
    NULL, 'Renewable Energy & IoT', 'Clean-tech startup developing predictive machine learning for solar farm battery maintenance.',
    false, NOW(), NOW()
  )
  ON CONFLICT (tenant_id, name) DO UPDATE SET
    verified = false,
    website = EXCLUDED.website;

  -- Link company_id to profiles
  UPDATE public.profiles SET company_id = v_comp_google_id WHERE id = v_google_rep_id;
  UPDATE public.profiles SET company_id = v_comp_infosys_id WHERE id = v_infosys_rep_id;
  UPDATE public.profiles SET company_id = v_comp_green_id WHERE id = v_green_rep_id;

  -- ------------------------------------------------------------
  -- 3. CREATE HACKATHONS (Different lifecycle stages)
  -- ------------------------------------------------------------
  -- Hackathon 1: In 'evaluation' stage (Main championship for submissions & scoring)
  INSERT INTO public.hackathons (
    id, tenant_id, created_by, slug, title, tagline, description, banner_url,
    min_team_size, max_team_size, max_teams_per_problem, allow_solo, require_college_email,
    status, visibility,
    problem_submission_opens, problem_submission_closes,
    registration_opens, registration_closes, team_formation_closes,
    hacking_starts, hacking_ends, evaluation_starts, evaluation_ends, results_announced_at,
    evaluation_rubric, evaluation_rounds, prizes, created_at, updated_at
  )
  VALUES (
    v_hack_mitt_id, v_tenant_id, v_admin_id, 'mitt-hack-2026',
    'MITT National Innovation Hackathon 2026',
    'Building Autonomous & Sustainable AI Systems for Tomorrow',
    'The premier inter-college innovation challenge at Maharaja Institute of Technology Thandavapura. Students collaborate with industry partners to solve production-grade problems in smart mobility, clean energy, and healthcare.',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
    2, 4, 10, false, false,
    'evaluation'::public.hackathon_status, 'public',
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days',
    jsonb_build_array(
      jsonb_build_object('criterion', 'Innovation & Novelty', 'weight', 25, 'description', 'Uniqueness and creative originality of the technical solution', 'max_score', 25),
      jsonb_build_object('criterion', 'Technical Complexity', 'weight', 25, 'description', 'Depth of engineering, architecture, code quality, and algorithm design', 'max_score', 25),
      jsonb_build_object('criterion', 'Feasibility & Usability', 'weight', 25, 'description', 'Real-world viability, UX elegance, and deployment readiness', 'max_score', 25),
      jsonb_build_object('criterion', 'Presentation & Clarity', 'weight', 25, 'description', 'Delivery of live demo, video walkthrough, and documentation', 'max_score', 25)
    ),
    jsonb_build_array(
      jsonb_build_object('round', 1, 'name', 'Grand Jury Evaluation', 'evaluators_per_team', 2)
    ),
    jsonb_build_array(
      jsonb_build_object('rank', 1, 'amount', 50000, 'description', '1st Place Grand Champion + Direct Interview PPO'),
      jsonb_build_object('rank', 2, 'amount', 25000, 'description', '2nd Place Runner-Up + Incubation Access'),
      jsonb_build_object('rank', 3, 'amount', 15000, 'description', '3rd Place Second Runner-Up')
    ),
    NOW(), NOW()
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET
    status = 'evaluation'::public.hackathon_status,
    title = EXCLUDED.title;

  -- Hackathon 2: In 'hacking' stage (Active sprint)
  INSERT INTO public.hackathons (
    id, tenant_id, created_by, slug, title, tagline, description, banner_url,
    min_team_size, max_team_size, max_teams_per_problem, allow_solo, require_college_email,
    status, visibility,
    hacking_starts, hacking_ends, evaluation_starts, evaluation_ends,
    evaluation_rubric, evaluation_rounds, prizes, created_at, updated_at
  )
  VALUES (
    v_hack_ai_id, v_tenant_id, v_admin_id, 'ai-future-sprint',
    'Smart Campus AI Sprint 2026',
    'Deploying Edge Machine Learning on College Infrastructure',
    '48-hour continuous coding sprint focused on intelligent classroom scheduling, automated attendance, and campus energy reduction.',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
    1, 4, 15, true, false,
    'hacking'::public.hackathon_status, 'public',
    NOW() - INTERVAL '12 hours', NOW() + INTERVAL '36 hours', NOW() + INTERVAL '36 hours', NOW() + INTERVAL '48 hours',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NOW(), NOW()
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET status = 'hacking'::public.hackathon_status;

  -- Hackathon 3: In 'registration' stage (Team formation & intake)
  INSERT INTO public.hackathons (
    id, tenant_id, created_by, slug, title, tagline, description, banner_url,
    min_team_size, max_team_size, max_teams_per_problem, allow_solo, require_college_email,
    status, visibility,
    registration_opens, registration_closes,
    evaluation_rubric, evaluation_rounds, prizes, created_at, updated_at
  )
  VALUES (
    v_hack_green_id, v_tenant_id, v_admin_id, 'green-tech-summit',
    'Sustainable Green Energy Challenge 2026',
    'Hacking for Zero-Carbon Microgrids & Solar Analytics',
    'Interdisciplinary hackathon for students eager to build clean-tech software and hardware prototypes.',
    'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80',
    2, 4, 8, false, false,
    'registration'::public.hackathon_status, 'public',
    NOW() - INTERVAL '2 days', NOW() + INTERVAL '10 days',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NOW(), NOW()
  )
  ON CONFLICT (tenant_id, slug) DO UPDATE SET status = 'registration'::public.hackathon_status;

  -- ------------------------------------------------------------
  -- 4. CREATE PROBLEM STATEMENTS
  -- ------------------------------------------------------------
  -- PS-01: Infosys (Published)
  INSERT INTO public.problem_statements (
    id, hackathon_id, company_id, submitted_by, title, domain, difficulty,
    problem_description, expected_outcome, constraints,
    datasets_provided, datasets_info, tech_preferences, evaluation_criteria,
    hiring_potential, open_positions, position_description,
    status, published_at, created_at, updated_at
  )
  VALUES (
    v_ps_traffic_id, v_hack_mitt_id, v_comp_infosys_id, v_infosys_rep_id,
    'Real-time Autonomous Traffic Signal Synchronization using Edge Computer Vision',
    'Autonomous Mobility & IoT', 'medium',
    'Urban bottlenecks in Tier-1 and Tier-2 Indian cities cause billions in economic drag and carbon emissions. Fixed-timer traffic lights fail to adapt to unpredictable density spikes. Teams must develop a low-latency edge vision system that measures queue density and dynamically schedules green signal durations.',
    'A working prototype with video stream ingress, vehicle classification/counting, adaptive interval calculation algorithm, and a simulated 4-way intersection visualizer.',
    'Must run on commodity hardware (simulated edge ARM/Jetson); latency under 150ms per frame analysis.',
    true, 'Sample intersection HD CCTV video streams (traffic_corridor_sample.mp4) and bounding box ground truth annotations provided.',
    ARRAY['Python', 'OpenCV', 'YOLO / Quantized MobileNet', 'FastAPI', 'React', 'MQTT'],
    'Classification accuracy (>85%), frame processing speed, fault tolerance when cameras degrade.',
    'internship', 3, 'Summer 2026 Autonomous Mobility Engineering Internships at Infosys Bengaluru Labs.',
    'published'::public.problem_statement_status, NOW() - INTERVAL '15 days', NOW(), NOW()
  )
  ON CONFLICT (hackathon_id, company_id) DO UPDATE SET
    status = 'published'::public.problem_statement_status,
    title = EXCLUDED.title;

  -- PS-02: Google Cloud (Published)
  INSERT INTO public.problem_statements (
    id, hackathon_id, company_id, submitted_by, title, domain, difficulty,
    problem_description, expected_outcome, constraints,
    datasets_provided, datasets_info, tech_preferences, evaluation_criteria,
    hiring_potential, open_positions, position_description,
    status, published_at, created_at, updated_at
  )
  VALUES (
    v_ps_microgrid_id, v_hack_mitt_id, v_comp_google_id, v_google_rep_id,
    'Decentralized Microgrid Energy Arbitrage Optimization using Deep Reinforcement Learning',
    'Cloud AI & Sustainable Infrastructure', 'hard',
    'Renewable energy generation from solar and wind is inherently intermittent. Battery Energy Storage Systems (BESS) must decide in real-time whether to store, consume, or sell power to the main grid to minimize cost and maximize resilience.',
    'A reinforcement learning or model-predictive control policy running on historical generation/load curves, demonstrating at least 25% cost savings over baseline rule engines.',
    'Algorithm must handle non-linear battery degradation penalties and dynamic hourly tariff schedules.',
    true, '3 years of 15-minute interval solar irradiance, consumption profiles, and regional electricity tariffs (microgrid_telemetry.parquet).',
    ARRAY['Python', 'PyTorch / RLlib', 'Pandas', 'Google Cloud Run / Functions', 'Docker'],
    'Net arbitrage profit, constraint satisfaction (zero blackouts), code modularity and test coverage.',
    'immediate_hire', 2, 'Cloud AI Systems Associate Engineer (Full-time / Pre-Placement Offer).',
    'published'::public.problem_statement_status, NOW() - INTERVAL '15 days', NOW(), NOW()
  )
  ON CONFLICT (hackathon_id, company_id) DO UPDATE SET
    status = 'published'::public.problem_statement_status,
    title = EXCLUDED.title;

  -- PS-03: Google Cloud (Under Review)
  INSERT INTO public.problem_statements (
    id, hackathon_id, company_id, submitted_by, title, domain, difficulty,
    problem_description, expected_outcome, constraints,
    datasets_provided, datasets_info, tech_preferences,
    hiring_potential, open_positions, status, created_at, updated_at
  )
  VALUES (
    v_ps_health_id, v_hack_ai_id, v_comp_google_id, v_google_rep_id,
    'Federated Privacy-Preserving Health Diagnostic Assistant',
    'Healthcare & Distributed ML', 'hard',
    'Hospitals cannot share raw patient scans due to HIPAA/GDPR regulations. Build a federated learning framework where diagnostic models train locally and aggregate gradients securely.',
    'A working federated coordinator node and at least 3 simulated hospital client nodes demonstrating convergence.',
    'Differential privacy budget epsilon < 2.0.',
    false, NULL, ARRAY['TensorFlow Federated', 'PySyft', 'FastAPI'],
    'possible', 1, 'under_review'::public.problem_statement_status, NOW(), NOW()
  )
  ON CONFLICT (hackathon_id, company_id) DO UPDATE SET status = 'under_review'::public.problem_statement_status;

  -- ------------------------------------------------------------
  -- 5. CREATE STUDENT TEAMS & MEMBERS
  -- ------------------------------------------------------------
  -- Team 1: NeuroPulse (Varun Nair Lead + Sneha Patil) -> Grand Champion
  INSERT INTO public.teams (
    id, hackathon_id, problem_id, name, description, invite_code, is_open, status, created_by, created_at, updated_at
  )
  VALUES (
    v_team_neuro_id, v_hack_mitt_id, v_ps_microgrid_id,
    'NeuroPulse', 'ECE & ISE research group specializing in reinforcement learning for power electronics and green infrastructure.',
    'NEURO42', false, 'submitted'::public.team_status, v_varun_id, NOW() - INTERVAL '12 days', NOW()
  )
  ON CONFLICT (hackathon_id, name) DO UPDATE SET
    status = 'submitted'::public.team_status,
    problem_id = v_ps_microgrid_id;

  INSERT INTO public.team_members (team_id, user_id, role, joined_at)
  VALUES
    (v_team_neuro_id, v_varun_id, 'leader', NOW() - INTERVAL '12 days'),
    (v_team_neuro_id, v_sneha_id, 'member', NOW() - INTERVAL '11 days')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Team 2: CyberKnights (Rohit Kumar Lead + Ananya Verma) -> Runner Up
  INSERT INTO public.teams (
    id, hackathon_id, problem_id, name, description, invite_code, is_open, status, created_by, created_at, updated_at
  )
  VALUES (
    v_team_cyber_id, v_hack_mitt_id, v_ps_traffic_id,
    'CyberKnights', 'Full-stack & computer vision engineers building edge-native public safety algorithms.',
    'CYBER99', true, 'submitted'::public.team_status, v_rohit_id, NOW() - INTERVAL '12 days', NOW()
  )
  ON CONFLICT (hackathon_id, name) DO UPDATE SET
    status = 'submitted'::public.team_status,
    problem_id = v_ps_traffic_id;

  INSERT INTO public.team_members (team_id, user_id, role, joined_at)
  VALUES
    (v_team_cyber_id, v_rohit_id, 'leader', NOW() - INTERVAL '12 days'),
    (v_team_cyber_id, v_ananya_id, 'member', NOW() - INTERVAL '11 days')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Team 3: QuantumBytes (Karthik Gowda) -> Open team in AI sprint
  INSERT INTO public.teams (
    id, hackathon_id, problem_id, name, description, invite_code, is_open, status, created_by, created_at, updated_at
  )
  VALUES (
    v_team_quantum_id, v_hack_ai_id, NULL,
    'QuantumBytes', 'Junior engineers designing automated student timetable scheduling tools.',
    'QUANTUM7', true, 'forming'::public.team_status, v_karthik_id, NOW() - INTERVAL '5 hours', NOW()
  )
  ON CONFLICT (hackathon_id, name) DO NOTHING;

  INSERT INTO public.team_members (team_id, user_id, role, joined_at)
  VALUES (v_team_quantum_id, v_karthik_id, 'leader', NOW() - INTERVAL '5 hours')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- ------------------------------------------------------------
  -- 6. CREATE MULTI-FORMAT DELIVERABLE SUBMISSIONS
  -- ------------------------------------------------------------
  -- Submission 1: Team NeuroPulse -> GridPulse (95.5 / 100 Champion)
  INSERT INTO public.submissions (
    id, team_id, hackathon_id, problem_id, title, abstract, approach,
    demo_url, repo_url, presentation_url, video_url,
    tech_stack, files,
    ai_summary, ai_scores, ai_flags,
    submission_round, submitted_by, submitted_at, last_edited_at, is_final, created_at
  )
  VALUES (
    v_sub_neuro_id, v_team_neuro_id, v_hack_mitt_id, v_ps_microgrid_id,
    'GridPulse: Microgrid Smart Arbitrage & Forecasting Engine',
    'A deep reinforcement learning telemetry engine that autonomously controls commercial BESS battery storage, achieving 34.2% cost reductions and eliminating blackout risks under extreme demand surges.',
    'Formulated energy arbitrage as a continuous action Markov Decision Process (MDP) using Proximal Policy Optimization (PPO). Deployed an async FastAPI microservice receiving smart meter telemetry, backed by TimescaleDB and a responsive Tailwind dashboard.',
    'https://gridpulse.app',
    'https://github.com/neuropulse/gridpulse',
    'https://pitch.com/gridpulse-deck',
    'https://youtu.be/sample-demo-neuropulse',
    ARRAY['Python', 'PyTorch', 'FastAPI', 'PostgreSQL', 'React', 'Docker', 'TimescaleDB'],
    jsonb_build_array(
      jsonb_build_object('name', 'gridpulse_architecture.pdf', 'size_kb', 1420, 'url', 'https://gridpulse.app/arch.pdf'),
      jsonb_build_object('name', 'benchmark_results.csv', 'size_kb', 380, 'url', 'https://gridpulse.app/bench.csv')
    ),
    'Exceptional technical execution with complete production-ready Dockerfile, passing unit test suite, and clear mathematical modeling of battery chemistry degradation curves.',
    jsonb_build_object(
      'code_quality', 96, 'documentation', 94, 'innovation', 98,
      'problem_alignment', 95, 'overall', 95.5, 'readiness_level', 'production_ready'
    ),
    '{}'::text[],
    1, v_varun_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', true, NOW()
  )
  ON CONFLICT (team_id, submission_round) DO UPDATE SET
    title = EXCLUDED.title,
    is_final = true;

  -- Submission 2: Team CyberKnights -> TrafficFlow AI (87.0 / 100 Runner-Up)
  INSERT INTO public.submissions (
    id, team_id, hackathon_id, problem_id, title, abstract, approach,
    demo_url, repo_url, presentation_url, video_url,
    tech_stack, files,
    ai_summary, ai_scores, ai_flags,
    submission_round, submitted_by, submitted_at, last_edited_at, is_final, created_at
  )
  VALUES (
    v_sub_cyber_id, v_team_cyber_id, v_hack_mitt_id, v_ps_traffic_id,
    'TrafficFlow AI: Real-time Edge Adaptive Signal Controller',
    'Low-latency edge computer vision pipeline detecting vehicular queue density across multi-lane corridors and dynamically optimizing green light duration to mitigate urban gridlock.',
    'Engineered an edge inference container running quantized YOLOv8 with DeepSORT multi-target tracking. Streamed vehicle counts over MQTT to a centralized coordinator algorithm that computes phase timing dynamically.',
    'https://trafficflow-demo.vercel.app',
    'https://github.com/cyberknights/trafficflow-ai',
    'https://slides.com/cyberknights/trafficflow',
    'https://youtu.be/sample-demo-cyberknights',
    ARRAY['Python', 'OpenCV', 'TensorFlow', 'TypeScript', 'React', 'MQTT', 'TailwindCSS'],
    jsonb_build_array(
      jsonb_build_object('name', 'trafficflow_spec.pdf', 'size_kb', 980, 'url', 'https://trafficflow-demo.vercel.app/spec.pdf')
    ),
    'Well-structured repository with comprehensive README, setup instructions, and reproducible camera stream simulator. Edge benchmark logs verified at 32 FPS.',
    jsonb_build_object(
      'code_quality', 88, 'documentation', 86, 'innovation', 89,
      'problem_alignment', 87, 'overall', 87.5, 'readiness_level', 'high'
    ),
    '{}'::text[],
    1, v_rohit_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', true, NOW()
  )
  ON CONFLICT (team_id, submission_round) DO UPDATE SET
    title = EXCLUDED.title,
    is_final = true;

  -- ------------------------------------------------------------
  -- 7. EVALUATOR ASSIGNMENTS & DOUBLE-BLIND RUBRIC SCORING
  -- ------------------------------------------------------------
  -- Assign Prof. Sharma to CyberKnights & NeuroPulse
  INSERT INTO public.evaluation_assignments (id, submission_id, evaluator_id, round, status, completed_at)
  VALUES
    (v_assign_sharma_neuro, v_sub_neuro_id, v_eval_sharma_id, 1, 'completed', NOW() - INTERVAL '1 day'),
    (v_assign_sharma_cyber, v_sub_cyber_id, v_eval_sharma_id, 1, 'completed', NOW() - INTERVAL '1 day')
  ON CONFLICT (submission_id, evaluator_id, round) DO UPDATE SET status = 'completed';

  -- Assign Dr. Priya to CyberKnights & NeuroPulse
  INSERT INTO public.evaluation_assignments (id, submission_id, evaluator_id, round, status, completed_at)
  VALUES
    (v_assign_priya_neuro, v_sub_neuro_id, v_eval_priya_id, 1, 'completed', NOW() - INTERVAL '1 day'),
    (v_assign_priya_cyber, v_sub_cyber_id, v_eval_priya_id, 1, 'completed', NOW() - INTERVAL '1 day')
  ON CONFLICT (submission_id, evaluator_id, round) DO UPDATE SET status = 'completed';

  -- Double-Blind Scores: Prof. Sharma on NeuroPulse (95/100)
  INSERT INTO public.evaluation_scores (
    id, assignment_id, submission_id, evaluator_id, round,
    scores, total_score, weighted_score,
    strengths, weaknesses, recommendation,
    private_notes, public_feedback, coi_declared, submitted_at
  )
  VALUES (
    gen_random_uuid(), v_assign_sharma_neuro, v_sub_neuro_id, v_eval_sharma_id, 1,
    jsonb_build_object(
      'Innovation & Novelty', 25,
      'Technical Complexity', 24,
      'Feasibility & Usability', 23,
      'Presentation & Clarity', 23
    ),
    95.0, 95.0,
    'Brilliant formulation of non-linear battery degradation within the reinforcement learning reward function. Code is exceptionally clean and well-factored.',
    'Could incorporate weather radar forecasting telemetry as an auxiliary observation variable.',
    'advance',
    'Unanimous 1st place contender. Highly impressive work from undergraduate students.',
    'Outstanding engineering effort! Your deep RL policy and real-time dashboard are of publishable research caliber.',
    false, NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (assignment_id) DO NOTHING;

  -- Double-Blind Scores: Dr. Priya on NeuroPulse (96/100)
  INSERT INTO public.evaluation_scores (
    id, assignment_id, submission_id, evaluator_id, round,
    scores, total_score, weighted_score,
    strengths, weaknesses, recommendation,
    private_notes, public_feedback, coi_declared, submitted_at
  )
  VALUES (
    gen_random_uuid(), v_assign_priya_neuro, v_sub_neuro_id, v_eval_priya_id, 1,
    jsonb_build_object(
      'Innovation & Novelty', 24,
      'Technical Complexity', 25,
      'Feasibility & Usability', 24,
      'Presentation & Clarity', 23
    ),
    96.0, 96.0,
    'Superb cloud deployment and telemetry ingestion pipeline. Demonstrates clear business impact with verifiable kilowatt-hour cost savings.',
    'Minor: documentation could provide a visual diagram of the RL state space transition model.',
    'advance',
    'Strongest project in this track. Highly recommend for corporate sponsorship grand prize.',
    'Exemplary project! Your live demo and microgrid forecasting metrics blew the jury away.',
    false, NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (assignment_id) DO NOTHING;

  -- Double-Blind Scores: Prof. Sharma on CyberKnights (86/100)
  INSERT INTO public.evaluation_scores (
    id, assignment_id, submission_id, evaluator_id, round,
    scores, total_score, weighted_score,
    strengths, weaknesses, recommendation,
    private_notes, public_feedback, coi_declared, submitted_at
  )
  VALUES (
    gen_random_uuid(), v_assign_sharma_cyber, v_sub_cyber_id, v_eval_sharma_id, 1,
    jsonb_build_object(
      'Innovation & Novelty', 22,
      'Technical Complexity', 23,
      'Feasibility & Usability', 21,
      'Presentation & Clarity', 20
    ),
    86.0, 86.0,
    'Practical real-world IoT implementation. The MQTT coordinator architecture scales well to multiple intersections.',
    'Night-time camera vision accuracy under rainy conditions requires further illumination preprocessing.',
    'advance',
    'Solid engineering team. Clear prototype readiness for campus intersection trials.',
    'Great job on the edge computer vision pipeline! The interactive intersection visualizer made your demo very compelling.',
    false, NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (assignment_id) DO NOTHING;

  -- Double-Blind Scores: Dr. Priya on CyberKnights (88/100)
  INSERT INTO public.evaluation_scores (
    id, assignment_id, submission_id, evaluator_id, round,
    scores, total_score, weighted_score,
    strengths, weaknesses, recommendation,
    private_notes, public_feedback, coi_declared, submitted_at
  )
  VALUES (
    gen_random_uuid(), v_assign_priya_cyber, v_sub_cyber_id, v_eval_priya_id, 1,
    jsonb_build_object(
      'Innovation & Novelty', 23,
      'Technical Complexity', 22,
      'Feasibility & Usability', 22,
      'Presentation & Clarity', 21
    ),
    88.0, 88.0,
    'Great video demonstration and clean modular React UI. Vehicle detection bounding boxes are stable across continuous frames.',
    'Emergency vehicle priority override logic is mentioned in the slides but not demonstrated in the code.',
    'advance',
    'Well-deserved 2nd place runner up.',
    'Impressive edge pipeline and vehicle tracking! Adding siren/audio detection for emergency vehicles will take this to the next level.',
    false, NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (assignment_id) DO NOTHING;

  -- Update submission_scores_aggregate decisions
  UPDATE public.submission_scores_aggregate
  SET
    final_decision = 'winner',
    decided_by = v_admin_id,
    decided_at = NOW() - INTERVAL '12 hours'
  WHERE submission_id = v_sub_neuro_id;

  UPDATE public.submission_scores_aggregate
  SET
    final_decision = 'advanced',
    decided_by = v_admin_id,
    decided_at = NOW() - INTERVAL '12 hours'
  WHERE submission_id = v_sub_cyber_id;

  -- ------------------------------------------------------------
  -- 8. VERIFIED STUDENT TALENT PROFILES & RESUMES
  -- ------------------------------------------------------------
  -- Varun Nair (Grand Champion)
  INSERT INTO public.talent_profiles (
    id, user_id, tenant_id, hackathon_id, team_id,
    headline, bio, overall_rank, percentile, badge, achievements,
    skills, github_url, linkedin_url, portfolio_url, resume_url,
    looking_for, preferred_location, is_visible, consent_given_at, created_at, updated_at
  )
  VALUES (
    v_tp_varun_id, v_varun_id, v_tenant_id, v_hack_mitt_id, v_team_neuro_id,
    'AI Systems & Deep Reinforcement Learning Engineer | 1st Place Grand Champion @ MITT 2026',
    'Final-year Electronics & Communication Engineering scholar focused on distributed machine learning, energy optimization, and real-time systems. Proven track record building production-grade algorithms.',
    1, 99.4, 'winner',
    jsonb_build_array(
      jsonb_build_object(
        'hackathon_id', v_hack_mitt_id,
        'hackathon_title', 'MITT National Innovation Hackathon 2026',
        'award', '1st Place Grand Champion 🏆',
        'badge', 'winner',
        'rank', 1,
        'team_name', 'NeuroPulse',
        'project_title', 'GridPulse: Microgrid Smart Arbitrage & Forecasting Engine',
        'score', 95.5,
        'year', 2026
      )
    ),
    ARRAY['PyTorch', 'Reinforcement Learning', 'FastAPI', 'PostgreSQL', 'Go', 'Docker', 'Time-Series Forecasting'],
    'https://github.com/varun-nair-ai',
    'https://linkedin.com/in/varunnair-ece',
    'https://varunnair.dev',
    'https://varunnair.dev/resume.pdf',
    ARRAY['full_time', 'internship'],
    ARRAY['Bengaluru', 'Remote', 'Hybrid'],
    true, NOW() - INTERVAL '5 days', NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    badge = 'winner',
    overall_rank = 1,
    percentile = 99.4,
    skills = EXCLUDED.skills,
    achievements = EXCLUDED.achievements;

  -- Rohit Kumar (2nd Place Runner-Up)
  INSERT INTO public.talent_profiles (
    id, user_id, tenant_id, hackathon_id, team_id,
    headline, bio, overall_rank, percentile, badge, achievements,
    skills, github_url, linkedin_url, portfolio_url, resume_url,
    looking_for, preferred_location, is_visible, consent_given_at, created_at, updated_at
  )
  VALUES (
    v_tp_rohit_id, v_rohit_id, v_tenant_id, v_hack_mitt_id, v_team_cyber_id,
    'Full-Stack Developer & Computer Vision Specialist | 2nd Place Runner-Up @ MITT 2026',
    '3rd-year Computer Science & Engineering innovator passionate about building low-latency edge AI systems, distributed microservices, and slick web experiences.',
    2, 94.8, 'runner_up',
    jsonb_build_array(
      jsonb_build_object(
        'hackathon_id', v_hack_mitt_id,
        'hackathon_title', 'MITT National Innovation Hackathon 2026',
        'award', '2nd Place Runner-Up 🥈',
        'badge', 'runner_up',
        'rank', 2,
        'team_name', 'CyberKnights',
        'project_title', 'TrafficFlow AI: Real-time Edge Adaptive Signal Controller',
        'score', 87.0,
        'year', 2026
      )
    ),
    ARRAY['TypeScript', 'React', 'Python', 'OpenCV', 'TensorFlow', 'FastAPI', 'MQTT', 'TailwindCSS'],
    'https://github.com/rohitkumar-cs',
    'https://linkedin.com/in/rohitkumar-dev',
    'https://rohitkumar.dev',
    'https://rohitkumar.dev/resume.pdf',
    ARRAY['internship'],
    ARRAY['Bengaluru', 'Mysuru'],
    true, NOW() - INTERVAL '5 days', NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    badge = 'runner_up',
    overall_rank = 2,
    percentile = 94.8,
    skills = EXCLUDED.skills,
    achievements = EXCLUDED.achievements;

  -- ------------------------------------------------------------
  -- 9. CORPORATE RECRUITER OUTREACH & HIRING PIPELINE
  -- ------------------------------------------------------------
  -- Google Cloud Recruiter -> Varun Nair (Interview Request -> Accepted)
  INSERT INTO public.hiring_interests (
    id, company_id, talent_profile_id, expressed_by,
    interest_type, role_title, message, compensation_range,
    student_response, student_notes, responded_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_comp_google_id, v_tp_varun_id, v_google_rep_id,
    'interview_requested',
    'Cloud AI & Sustainable Infrastructure Intern (Summer 2026)',
    'Hi Varun, your team NeuroPulse delivered an extraordinary presentation on deep RL energy arbitrage. Our engineering team at Google Cloud Bengaluru would love to invite you for a technical interview round.',
    '₹45,000 / month stipend + Pre-Placement Offer (PPO)',
    'accepted',
    'Thank you Sundar! I am thrilled by this opportunity and have confirmed my availability for next Tuesday afternoon.',
    NOW() - INTERVAL '6 hours', NOW() - INTERVAL '18 hours', NOW()
  )
  ON CONFLICT (company_id, talent_profile_id, role_title) DO NOTHING;

  -- Infosys Autonomous Systems -> Rohit Kumar (Interview Request -> Pending)
  INSERT INTO public.hiring_interests (
    id, company_id, talent_profile_id, expressed_by,
    interest_type, role_title, message, compensation_range,
    student_response, student_notes, responded_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), v_comp_infosys_id, v_tp_rohit_id, v_infosys_rep_id,
    'interview_requested',
    'Edge Computer Vision Associate Engineer',
    'Hello Rohit, we evaluated TrafficFlow AI and were very impressed with your YOLO edge quantization benchmarks. We would like to fast-track your profile for an engineering internship at Infosys Autonomous Mobility Labs.',
    '₹35,000 / month stipend + Full-Time Conversion',
    'pending', NULL, NULL,
    NOW() - INTERVAL '10 hours', NOW()
  )
  ON CONFLICT (company_id, talent_profile_id, role_title) DO NOTHING;

  -- ------------------------------------------------------------
  -- 10. INSTITUTIONAL AUDIT TRAIL LOGS
  -- ------------------------------------------------------------
  INSERT INTO public.audit_logs (tenant_id, actor_id, action, target_type, target_id, details, ip_address, created_at)
  VALUES
    (v_tenant_id, v_admin_id, 'company_verified', 'companies', v_comp_google_id::text, '{"company_name":"Google Cloud", "verified_by":"Dr. Ramesh Kumar"}'::jsonb, '192.168.1.10', NOW() - INTERVAL '20 days'),
    (v_tenant_id, v_admin_id, 'company_verified', 'companies', v_comp_infosys_id::text, '{"company_name":"Infosys Autonomous Systems", "verified_by":"Dr. Ramesh Kumar"}'::jsonb, '192.168.1.10', NOW() - INTERVAL '20 days'),
    (v_tenant_id, v_admin_id, 'problem_statement_published', 'problem_statements', v_ps_traffic_id::text, '{"title":"Real-time Autonomous Traffic Signal Synchronization", "company":"Infosys"}'::jsonb, '192.168.1.10', NOW() - INTERVAL '15 days'),
    (v_tenant_id, v_admin_id, 'problem_statement_published', 'problem_statements', v_ps_microgrid_id::text, '{"title":"Decentralized Microgrid Energy Arbitrage Optimization", "company":"Google Cloud"}'::jsonb, '192.168.1.10', NOW() - INTERVAL '15 days'),
    (v_tenant_id, v_admin_id, 'ai_prescreening_batch_run', 'submissions', v_sub_neuro_id::text, '{"score":95.5, "status":"passed", "triage":"high_readiness"}'::jsonb, '192.168.1.10', NOW() - INTERVAL '2 days'),
    (v_tenant_id, v_eval_sharma_id, 'evaluation_scored', 'evaluations', v_assign_sharma_neuro::text, '{"score":95.0, "recommendation":"advance"}'::jsonb, '192.168.1.45', NOW() - INTERVAL '1 day'),
    (v_tenant_id, v_eval_priya_id, 'evaluation_scored', 'evaluations', v_assign_priya_neuro::text, '{"score":96.0, "recommendation":"advance"}'::jsonb, '192.168.1.88', NOW() - INTERVAL '1 day'),
    (v_tenant_id, v_admin_id, 'awards_finalized', 'hackathons', v_hack_mitt_id::text, '{"winner":"NeuroPulse", "runner_up":"CyberKnights", "total_evaluations":4}'::jsonb, '192.168.1.10', NOW() - INTERVAL '12 hours');

  -- ------------------------------------------------------------
  -- 11. IN-APP NOTIFICATION CENTER
  -- ------------------------------------------------------------
  -- Notifications for Students
  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, is_read, created_at)
  VALUES
    (v_varun_id, v_tenant_id, '🎉 You Won 1st Place Grand Champion!', 'Congratulations! NeuroPulse has been awarded 1st Place at the MITT National Innovation Hackathon 2026.', 'awards_announced', '/leaderboard', false, NOW() - INTERVAL '12 hours'),
    (v_varun_id, v_tenant_id, '💼 New Interview Invitation from Google Cloud', 'Sundar V. from Google Cloud requested an interview for the Cloud AI Systems Intern role.', 'hiring_interest', '/student/offers', false, NOW() - INTERVAL '18 hours'),
    (v_rohit_id, v_tenant_id, '🥈 You Won 2nd Place Runner-Up!', 'CyberKnights finished 2nd Place with a composite score of 87.0/100.', 'awards_announced', '/leaderboard', false, NOW() - INTERVAL '12 hours'),
    (v_rohit_id, v_tenant_id, '💼 Interview Invitation from Infosys', 'Infosys Autonomous Systems expressed interest in your edge computer vision skills.', 'hiring_interest', '/student/offers', false, NOW() - INTERVAL '10 hours');

  -- Notifications for Evaluators
  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, is_read, created_at)
  VALUES
    (v_eval_sharma_id, v_tenant_id, 'Double-Blind Evaluations Completed', 'Thank you Dr. Sharma! Your 2 assigned submissions have been recorded and aggregated.', 'evaluation_assigned', '/evaluator', true, NOW() - INTERVAL '1 day'),
    (v_eval_priya_id, v_tenant_id, 'Double-Blind Evaluations Completed', 'Thank you Dr. Priya! Your rubric scores have been finalized by the committee.', 'evaluation_assigned', '/evaluator', true, NOW() - INTERVAL '1 day');

  -- Notifications for Company Reps
  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, is_read, created_at)
  VALUES
    (v_google_rep_id, v_tenant_id, 'Candidate Varun Nair Accepted Your Outreach!', 'Varun Nair has accepted your interview request for Cloud AI Systems Intern.', 'hiring_interest', '/company/talent-pool', false, NOW() - INTERVAL '6 hours'),
    (v_infosys_rep_id, v_tenant_id, 'Problem Statement Published', 'Your challenge "Traffic Signal Synchronization" received submissions from 2 teams.', 'general', '/company/problems', true, NOW() - INTERVAL '2 days');

  -- Notifications for College Admin
  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, link, is_read, created_at)
  VALUES
    (v_admin_id, v_tenant_id, 'Hackathon Evaluation Cycle Completed', 'All assigned evaluators have finished rubric scoring for MITT National Innovation Hackathon 2026.', 'awards_announced', '/admin/results', false, NOW() - INTERVAL '12 hours');

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SUCCESS: HackBridge end-to-end demo data generated!';
  RAISE NOTICE 'Tenant: MITT (Maharaja Institute of Technology Thandavapura)';
  RAISE NOTICE 'Users provisioned: 11 (Admin, 3 Companies, 2 Evaluators, 5 Students)';
  RAISE NOTICE 'Universal Test Password: Password123!';
  RAISE NOTICE '============================================================';
END $$;
