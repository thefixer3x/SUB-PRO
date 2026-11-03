// Simplified feature flags - no Supabase dependency for now
export const FEATURE_FLAGS = {
  // Core features only
  DARK_MODE: true,
  COMMUNITY_STATS: false,
  SMART_INSIGHTS: true, // Enable for embedded finance access
  BULK_UPLOAD: false,
  
  // Embedded Finance umbrella feature
  EMBEDDED_FINANCE: true,
  // Virtual cards are not user-ready yet: the screen ships behind a gate that
  // stays off until the live card list is served by an authorized backend.
  // The key matches the `sm_feature_flags.name` row, so it can be flipped
  // without a deploy. See docs/agents/EXECUTION_PLAN.md (card S103).
  virtualCardsEnabled: false,
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

// If running in development mode, enable core features only.
// `virtualCardsEnabled` is deliberately not enabled here: the gate must stay
// off in development too, until the live card list is wired up (card S103).
if (__DEV__) {
  FEATURE_FLAGS.DARK_MODE = true;
  FEATURE_FLAGS.COMMUNITY_STATS = true;
  FEATURE_FLAGS.EMBEDDED_FINANCE = true;
  FEATURE_FLAGS.CANCELLATION_BOT = true;
}
