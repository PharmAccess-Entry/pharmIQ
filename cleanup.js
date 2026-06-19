import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://postgres:SmartTable_Reset_2026!@db.lusbaxesfvicoibnvjcr.supabase.co:5432/postgres"
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase...");

    // 1. Nuke everything in public schema
    console.log("Nuking public schema...");
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    
    // 2. Restore standard permissions
    console.log("Restoring permissions...");
    await client.query("GRANT ALL ON SCHEMA public TO postgres;");
    await client.query("GRANT ALL ON SCHEMA public TO public;");
    await client.query("GRANT ALL ON SCHEMA public TO anon;");
    await client.query("GRANT ALL ON SCHEMA public TO authenticated;");
    await client.query("GRANT ALL ON SCHEMA public TO service_role;");
    
    console.log("Cleanup complete! The public schema is now empty.");
  } catch (err) {
    console.error("Cleanup failed:", err);
  } finally {
    await client.end();
  }
}

run();
