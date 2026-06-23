import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ohmfcouxtdjmbugmnqub.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3EZEpVIAOZ-OJN9t-0VLg_fR1bO2mG'; // Public key

// Owner client
const ownerClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
// Staff client for signing up
const staffClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("Starting account creation...");

  // 1. Create main account
  const mainEmail = 'olatunbosunfemi5@gmail.com';
  const password = '12345678';
  
  let { data: mainAuth, error: mainError } = await ownerClient.auth.signUp({
    email: mainEmail,
    password: password,
    options: { data: { full_name: 'Femi Olatunbosun' } }
  });

  if (mainError) {
    if (mainError.message.includes('already registered')) {
      console.log('Main account already exists. Signing in...');
      const { data: signInData, error: signInErr } = await ownerClient.auth.signInWithPassword({
        email: mainEmail,
        password: password
      });
      if (signInErr) {
        console.error('Failed to sign in main account:', signInErr);
        return;
      }
      mainAuth = signInData;
    } else {
      console.error('Failed to create main account:', mainError);
      return;
    }
  }

  const mainUserId = mainAuth.user?.id;
  if (!mainUserId) {
    console.error("Could not get main user ID");
    return;
  }
  console.log("Main account ready. User ID:", mainUserId);

  // 2. Create Restaurant (Pharmacy)
  let restaurantId;
  const { data: existingRest } = await ownerClient
    .from('restaurants')
    .select('id')
    .eq('owner_id', mainUserId)
    .single();

  if (existingRest) {
    restaurantId = existingRest.id;
    console.log("Restaurant already exists. ID:", restaurantId);
  } else {
    console.log("Creating new restaurant for main account...");
    const { data: newRest, error: restError } = await ownerClient
      .from('restaurants')
      .insert({
        owner_id: mainUserId,
        name: 'PharmIQ Test Pharmacy',
        business_type: 'pharmacy',
        subscription_status: 'active'
      })
      .select()
      .single();
    
    if (restError) {
      console.error("Failed to create restaurant:", restError);
      return;
    }
    restaurantId = newRest.id;
    console.log("Created restaurant. ID:", restaurantId);
  }

  // 3. Create Staff Accounts
  const staffAccounts = [
    { email: 'test1@gmail.com', role: 'staff' },
    { email: 'test2@gmail.com', role: 'staff' },
    { email: 'test3@gmail.com', role: 'staff' },
    { email: 'test4@gmail.com', role: 'staff' },
    { email: 'test5@gmail.com', role: 'manager' }
  ];

  for (let i = 0; i < staffAccounts.length; i++) {
    const staff = staffAccounts[i];
    console.log(`Processing staff account: ${staff.email} (${staff.role})...`);
    
    // Create auth user using staff client
    let { data: staffAuth, error: staffError } = await staffClient.auth.signUp({
      email: staff.email,
      password: password,
      options: { data: { full_name: `Staff Member ${i+1}` } }
    });

    let staffUserId = staffAuth?.user?.id;

    if (staffError) {
      if (staffError.message.includes('already registered')) {
        console.log(`  Staff ${staff.email} already exists. Signing in...`);
        const { data: signInData } = await staffClient.auth.signInWithPassword({
          email: staff.email,
          password: password
        });
        staffUserId = signInData?.user?.id;
      } else {
        console.error(`  Failed to create staff ${staff.email}:`, staffError);
        continue;
      }
    }

    if (!staffUserId) {
      console.error(`  Could not resolve user ID for ${staff.email}`);
      continue;
    }

    // Add to user_roles table using OWNER client (who has RLS bypass or is owner of restaurant)
    console.log(`  Adding to user_roles table...`);
    const { error: linkError } = await ownerClient
      .from('user_roles')
      .upsert({
        restaurant_id: restaurantId,
        user_id: staffUserId,
        role: staff.role
      }, { onConflict: 'restaurant_id, user_id' });
    
    if (linkError) {
      console.error(`  Failed to link staff ${staff.email}:`, linkError);
    } else {
      console.log(`  Successfully linked ${staff.email} as ${staff.role}.`);
    }
  }

  console.log("All done!");
}

main().catch(console.error);
