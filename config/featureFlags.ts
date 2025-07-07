// Simplified feature flags - no Supabase dependency for now
export const FEATURE_FLAGS = {
  // Core features only
  DARK_MODE: true,
  COMMUNITY_STATS: false,
  SMART_INSIGHTS: true, // Enable for embedded finance access
  BULK_UPLOAD: false,
  
  // Embedded Finance umbrella feature
  EMBEDDED_FINANCE: true,
  VIRTUAL_CARDS: true,
  CREDIT_SERVICE: false, // Coming soon
  CANCELLATION_BOT: true,
  AI_ASSISTANT: true, // Future flag for premium users
  PAYMENT_OPTIMIZATION: false, // Coming soon
  
  // Disable complex features temporarily
  EMBED_FINANCE_BETA: false,
  MONETIZATION_V1: false,
  SOCIAL_V1: false,
  COMPLIANCE_CENTER: false,
  SECURITY_MONITORING: false,
  GDPR_TOOLS: false,
  AUDIT_LOGGING: false,
  PARTNER_HUB: false,
};

// If running in development mode, enable core features only
if (__DEV__) {
  FEATURE_FLAGS.DARK_MODE = true;
  FEATURE_FLAGS.COMMUNITY_STATS = true;
  FEATURE_FLAGS.EMBEDDED_FINANCE = true;
  FEATURE_FLAGS.VIRTUAL_CARDS = true;
  FEATURE_FLAGS.CANCELLATION_BOT = true;
}
