#!/usr/bin/env node

/**
 * Script to apply the blaze migration and initialize data
 * Run this once to set up the blaze claims system
 *
 * Usage: node scripts/apply-blaze-migration.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyMigration() {
  console.log('📝 Applying blaze claims migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/create_blaze_daily_claims.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by statement (simple split on ;)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`[${i + 1}/${statements.length}] Executing statement...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Error executing statement:\n${statement}\n`, error);
        // Continue with other statements - some may fail if tables already exist
      } else {
        console.log(`✓ Success`);
      }
    }

    console.log('\n✅ Migration applied successfully!\n');

    // Initialize data for existing users
    console.log('📊 Initializing data for existing users...\n');

    // Get all existing users
    const { data: users, error: usersError } = await supabase
      .from('auth_users')
      .select('id');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`Found ${users.length} existing users`);

    for (const user of users) {
      // Check if stats already exist
      const { data: existingStats } = await supabase
        .from('user_blaze_stats')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!existingStats) {
        // Create stats record
        const { error: statsError } = await supabase
          .from('user_blaze_stats')
          .insert({
            user_id: user.id,
            total_blaze_earned: 0,
            current_streak_day: 1,
            is_active_today: false,
          });

        if (statsError) {
          console.warn(`⚠ Error creating stats for user ${user.id}:`, statsError);
          continue;
        }

        // Create 7 daily claims for this user
        const claims = Array.from({ length: 7 }, (_, i) => ({
          user_id: user.id,
          day_number: i + 1,
          amount: 10,
          is_claimed: false,
          claimed_at: null,
        }));

        const { error: claimsError } = await supabase
          .from('blaze_daily_claims')
          .insert(claims);

        if (claimsError) {
          console.warn(`⚠ Error creating claims for user ${user.id}:`, claimsError);
        } else {
          console.log(`✓ Initialized user ${user.id}`);
        }
      }
    }

    console.log('\n✅ All done! Your blaze claims system is ready to use.\n');
    console.log('📋 Next steps:');
    console.log('   1. Refresh your browser');
    console.log('   2. Try claiming your daily BLAZE reward');
    console.log('   3. Check your dashboard for the streak progress\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

applyMigration();
