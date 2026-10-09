import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mcdrnkfvjlxwascipgqw.supabase.co',
  'sb_publishable_2GbzlfXb78ebij0Snd-V5g_7fGExtb7'
);

async function test() {
  const { data: tenant } = await supabase.from('tenants').select('*').single();
  console.log('Tenant ID:', tenant?.id);

  const { data, error } = await supabase.from('hackathons').insert({
    tenant_id: tenant.id,
    title: 'MITT National Innovation Hackathon 2026',
    slug: 'mitt-nih-2026',
    tagline: 'Building smart, scalable solutions for rural & urban India',
    description: 'The flagship annual hackathon of Maharaja Institute of Technology Thandavapura bringing together 500+ student innovators, industry partners, and cutting-edge challenge tracks.',
    status: 'hacking',
    min_team_size: 2,
    max_team_size: 4,
    registration_opens: new Date(Date.now() - 7 * 86400000).toISOString(),
    registration_closes: new Date(Date.now() + 7 * 86400000).toISOString(),
    hacking_starts: new Date(Date.now() - 2 * 86400000).toISOString(),
    hacking_ends: new Date(Date.now() + 2 * 86400000).toISOString(),
    evaluation_rubric: [
      { criterion: 'Innovation & Novelty', weight: 25, description: 'Originality of the concept and creative problem-solving approach', max_score: 10 },
      { criterion: 'Technical Complexity', weight: 30, description: 'Architectural robustness, code quality, and advanced stack usage', max_score: 10 },
      { criterion: 'Feasibility & Scalability', weight: 25, description: 'Real-world viability, performance, and commercial potential', max_score: 10 },
      { criterion: 'UI/UX & Presentation', weight: 20, description: 'User experience design, clarity of pitch, and demo execution', max_score: 10 }
    ],
    prizes: [
      { rank: 1, amount: 100000, title: 'Grand Champion', description: 'INR 1,00,000 Cash + Direct Fast-Track Interviews' },
      { rank: 2, amount: 50000, title: '1st Runner Up', description: 'INR 50,000 Cash + Cloud Infrastructure Credits' },
      { rank: 3, amount: 25000, title: '2nd Runner Up', description: 'INR 25,000 Cash + Pre-Placement Offers' }
    ]
  }).select();

  console.log('Insert hackathon result:', error ? error.message : data);
}

test();
