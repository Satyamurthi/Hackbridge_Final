import { createClient } from '@supabase/supabase-js';

const url = 'https://mcdrnkfvjlxwascipgqw.supabase.co';
const key = 'sb_publishable_2GbzlfXb78ebij0Snd-V5g_7fGExtb7';

const supabase = createClient(url, key);

async function check() {
  const tables = [
    'tenants',
    'profiles',
    'hackathons',
    'companies',
    'problem_statements',
    'teams',
    'team_members',
    'submissions',
    'evaluation_assignments',
    'evaluation_scores',
    'submission_scores_aggregate',
    'talent_profiles',
    'hiring_interests',
    'audit_logs',
    'notifications'
  ];

  for (const t of tables) {
    try {
      const { data, count, error } = await supabase.from(t).select('*', { count: 'exact', head: false });
      if (error) {
        console.log(`Table '${t}': Error ->`, error.message);
      } else {
        console.log(`Table '${t}': ${data ? data.length : 0} rows`);
        if (data && data.length > 0 && data.length <= 3) {
          console.log(`   Sample:`, JSON.stringify(data[0]).slice(0, 100));
        }
      }
    } catch (e) {
      console.log(`Table '${t}': Exception ->`, e.message);
    }
  }
}

check();
