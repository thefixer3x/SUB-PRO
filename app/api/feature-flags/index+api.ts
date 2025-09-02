import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    // Get Supabase configuration from environment variables
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing');
      // Fallback to env variables for local development
      return Response.json({
        DARK_MODE: process.env.EXPO_PUBLIC_DARK_MODE === 'true',
        COMMUNITY_STATS: process.env.EXPO_PUBLIC_COMMUNITY_STATS === 'true',
        SMART_INSIGHTS: process.env.EXPO_PUBLIC_SMART_INSIGHTS === 'true',
        BULK_UPLOAD: process.env.EXPO_PUBLIC_BULK_UPLOAD === 'true',
        EMBED_FINANCE_BETA: process.env.EXPO_PUBLIC_EMBED_FINANCE_BETA === 'true',
        MONETIZATION_V1: process.env.EXPO_PUBLIC_MONETIZATION_V1 === 'true',
        SOCIAL_V1: process.env.EXPO_PUBLIC_SOCIAL_V1 === 'true',
        COMPLIANCE_CENTER: process.env.EXPO_PUBLIC_COMPLIANCE_CENTER === 'true',
        SECURITY_MONITORING: process.env.EXPO_PUBLIC_SECURITY_MONITORING === 'true',
        GDPR_TOOLS: process.env.EXPO_PUBLIC_GDPR_TOOLS === 'true',
        AUDIT_LOGGING: process.env.EXPO_PUBLIC_AUDIT_LOGGING === 'true',
        PARTNER_HUB: process.env.EXPO_PUBLIC_PARTNER_HUB === 'true',
      });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // ✅ FIXED: Using sm_feature_flags instead of feature_flags
    const { data, error } = await supabase
      .from('sm_feature_flags')
      .select('name, enabled');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Transform data into a more usable format
    const featureFlags = data.reduce((acc, flag) => {
      acc[flag.name] = flag.enabled;
      return acc;
    }, {} as Record<string, boolean>);

    return Response.json(featureFlags);
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    
    // Fallback to environment variables if Supabase fails
    return Response.json({
      DARK_MODE: process.env.EXPO_PUBLIC_DARK_MODE === 'true',
      COMMUNITY_STATS: process.env.EXPO_PUBLIC_COMMUNITY_STATS === 'true',
      SMART_INSIGHTS: process.env.EXPO_PUBLIC_SMART_INSIGHTS === 'true',
      BULK_UPLOAD: process.env.EXPO_PUBLIC_BULK_UPLOAD === 'true',
      EMBED_FINANCE_BETA: process.env.EXPO_PUBLIC_EMBED_FINANCE_BETA === 'true',
      MONETIZATION_V1: process.env.EXPO_PUBLIC_MONETIZATION_V1 === 'true',
      SOCIAL_V1: process.env.EXPO_PUBLIC_SOCIAL_V1 === 'true',
      COMPLIANCE_CENTER: process.env.EXPO_PUBLIC_COMPLIANCE_CENTER === 'true',
      SECURITY_MONITORING: process.env.EXPO_PUBLIC_SECURITY_MONITORING === 'true',
      GDPR_TOOLS: process.env.EXPO_PUBLIC_GDPR_TOOLS === 'true',
      AUDIT_LOGGING: process.env.EXPO_PUBLIC_AUDIT_LOGGING === 'true',
      PARTNER_HUB: process.env.EXPO_PUBLIC_PARTNER_HUB === 'true',
    });
  }
}

// Allow updating feature flags
export async function POST(request: Request) {
  try {
    const { name, enabled } = await request.json();

    if (!name) {
      return Response.json({ error: 'Feature flag name is required' }, { status: 400 });
    }

    if (typeof enabled !== 'boolean') {
      return Response.json({ error: 'Enabled must be a boolean value' }, { status: 400 });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // ✅ FIXED: Using sm_update_feature_flag RPC function
    const { data, error } = await supabase.rpc('sm_update_feature_flag', {
      flag_name: name,
      flag_enabled: enabled,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, updated: data });
  } catch (error) {
    console.error('Failed to update feature flag:', error);
    return Response.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}