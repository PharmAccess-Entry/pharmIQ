import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://lusbaxesfvicoibnvjcr.supabase.co',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c2JheGVzZnZpY29pYm52amNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzU0NDEsImV4cCI6MjA4Nzg1MTQ0MX0.8qjp_MYBjGnhtlK9Bnk0Vd7YhWjyXlWgbSat0LzVxJ0'
);

async function test() {
  // First login with dummy creds if needed, but RLS might allow it?
  // Wait, the client is using anon key. It needs to be authenticated.
  // Actually, let's just see if anon can update.
  
  // Try updating a random row (we'll just use dummy id)
  const { data, error } = await supabase.from('restaurants').update({ short_code: 'TEST' }).eq('id', '123e4567-e89b-12d3-a456-426614174000').select();
  if (error) {
    console.error("ERROR:", error.message, error.code, error.details);
  } else {
    console.log("SUCCESS UPDATE:", data);
  }
}

test();
