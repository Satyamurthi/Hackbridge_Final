-- ============================================================================
-- HackBridge Supabase-Specific Extensions & RLS Documentation
-- This file documents what parts are specific to Supabase Postgres vs standard SQL.
-- ============================================================================

-- 1. AUTH INTEGRATION:
-- Supabase manages users in `auth.users`. When using Supabase:
-- - `public.profiles` references `auth.users(id) ON DELETE CASCADE`.
-- - Trigger `on_auth_user_created` calls `handle_new_user()` which reads `auth.jwt()`.
-- In the portable backend, users are stored in `public.users` with standard `password_hash` and JWT authentication.

-- 2. ROW LEVEL SECURITY (RLS):
-- In Supabase, RLS is enabled per table and uses `auth.uid()`:
-- ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "hackathons_read_tenant" ON public.hackathons
--   FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- In the portable backend:
-- Security and tenant isolation are enforced in the API/Service Layer (AuthMiddleware and Repository queries),
-- making the schema portable to MySQL, SQL Server, and self-hosted PostgreSQL without proprietary RLS engines.

-- 3. REALTIME:
-- Supabase Realtime listens to Postgres replication streams (`supabase_realtime` publication):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_scores_aggregate;

-- In standard deployments, WebSocket / SSE (Server-Sent Events) or Redis PubSub is used.

-- 4. STORAGE:
-- Supabase Storage uses `storage.buckets` and `storage.objects` with S3 protocol.
-- In portable deployments, StorageService uses disk storage or S3/MinIO compatible client.
