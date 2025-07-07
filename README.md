# Subscription Manager - Embedded Finance Platform

A comprehensive subscription management platform with embedded finance features including virtual card management, automated cancellation services, and affiliate system integration.

## Features

### Core Subscription Management
- **Three-tier monetization**: Free, Pro ($4.99/month), Team ($2/user/month)
- **Feature gating**: Smart component system for premium features
- **Stripe integration**: Payment processing with Customer Portal
- **Ad system**: Mobile (AdMob) and Web (AdSense) advertising

### Embedded Finance Features (Pro/Team)
- **Virtual Card Management**: Weavr/Stripe Issuing integration for secure payments
- **Automated Cancellation**: Headless browser automation for subscription cancellations
- **Affiliate System**: Smart affiliate link routing with commission tracking

### Partner Marketplace
- **Exclusive deals** from technology partners
- **Clean, responsive interface** with card and modal views
- **Conversion tracking** with user reference parameters
- **Transparent affiliate relationships** with clear disclosures

## Architecture

### Virtual Card Management
- **Providers**: Stripe Issuing and Weavr support
- **Security**: End-to-end encryption with temporary card reveals
- **Controls**: Spending limits, merchant category restrictions, instant blocking
- **Integration**: Automatic card creation for new subscriptions

### Automated Cancellation System
- **Supported Vendors**: Netflix, Spotify, Adobe, GitHub, Notion, and more
- **Technology**: Puppeteer/Playwright headless browser automation
- **Security**: Encrypted credential storage with automatic deletion
- **Process**: Multi-step verification with retry logic

### Affiliate System
- **Integration**: Impact Radius, Commission Junction, ShareASale support
- **Tracking**: UTM parameter injection with conversion monitoring
- **Revenue**: Commission tracking with detailed analytics
- **Compliance**: GDPR/CCPA compliant tracking with user consent

### Partner Marketplace
- **Featured Partners**: ElevenLabs, Bolt Pro, Lingo.dev, and more
- **Click Tracking**: Comprehensive engagement metrics
- **Conversion Attribution**: User-specific reference parameters
- **Custom Tracking Links**: Dynamic URL generation with UTM parameters

## Setup Instructions

### 1. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Virtual Cards (Weavr)
WEAVR_API_KEY=your_weavr_api_key
WEAVR_PROGRAMME_ID=your_weavr_programme_id

# Feature Flags
EXPO_PUBLIC_EMBED_FINANCE_BETA=true
```

### 2. Stripe Issuing Setup

1. Enable Stripe Issuing in your Stripe Dashboard
2. Create a cardholder and configure spending controls
3. Set up webhooks for card events
4. Update API keys in environment variables

### 3. Weavr Integration (Alternative)

1. Create a Weavr account and get API credentials
2. Set up a card programme in Weavr Dashboard
3. Configure spending rules and merchant restrictions
4. Update Weavr credentials in environment variables

### 4. Cancellation Bot Setup

1. Install Puppeteer or Playwright:
```bash
npm install puppeteer
# or
npm install playwright
```

2. Configure vendor-specific selectors in `config/embeddedFinance.ts`
3. Set up secure credential encryption
4. Test cancellation flow with vendor accounts

### 5. Affiliate Network Integration

1. **Impact Radius**: Sign up and get tracking URLs
2. **Commission Junction**: Configure website ID and ad IDs
3. **ShareASale**: Set up affiliate and merchant IDs
4. Update affiliate configuration in environment variables

## API Endpoints

### Virtual Cards
- `POST /api/embedded-finance/virtual-cards/create` - Create new virtual card
- `GET /api/embedded-finance/virtual-cards/{id}` - Get card details
- `PATCH /api/embedded-finance/virtual-cards/{id}` - Update card settings
- `POST /api/embedded-finance/virtual-cards/{id}/reveal` - Temporarily reveal card details

### Cancellation Automation
- `POST /api/embedded-finance/cancellation/request` - Submit cancellation request
- `GET /api/embedded-finance/cancellation/{id}` - Get cancellation status
- `POST /api/embedded-finance/cancellation/{id}/retry` - Retry failed cancellation

### Affiliate System
- `POST /api/embedded-finance/affiliates/create` - Create affiliate link
- `POST /api/embedded-finance/affiliates/track-click` - Track affiliate clicks
- `POST /api/embedded-finance/affiliates/track-conversion` - Track conversions
- `GET /api/embedded-finance/affiliates/stats/{id}` - Get affiliate statistics

## Security Features

### Virtual Card Security
- **Tokenization**: Card numbers encrypted at rest
- **Temporary Reveals**: Card details shown only when needed
- **Spending Controls**: Monthly limits and merchant restrictions
- **Instant Blocking**: Immediate card suspension capability

### Cancellation Security
- **Credential Encryption**: User passwords encrypted with AES-256-GCM
- **Automatic Deletion**: Credentials removed after cancellation
- **Audit Logging**: Complete cancellation process tracking
- **Error Handling**: Secure failure modes with retry logic

### Affiliate Compliance
- **URL Validation**: Sanitization of affiliate links
- **Tracking Consent**: GDPR/CCPA compliant user consent
- **Commission Transparency**: Clear disclosure of affiliate relationships
- **Click Verification**: Bot detection and fraud prevention

## Compliance & Security Features

### Security Health Check System
- **Automated Monitoring**: Daily security scans and health scoring (0-100)
- **Real-time Alerts**: Red warning banners for critical security issues (score < 60)
- **Comprehensive Checks**:
  - Expired virtual card detection
  - HaveIBeenPwned API integration for breach monitoring
  - Authentication strength analysis (2FA, password age)
  - Suspicious activity detection
  - Outdated permissions review
- **Actionable Recommendations**: Specific steps to resolve security issues
- **Progress Tracking**: Mark findings as resolved and track improvement

### GDPR Compliance Console
- **Data Export**: Complete JSON export of user data with 24-hour secure links
- **Selective Exports**: Choose specific data types (subscriptions, analytics, payments)
- **Right to be Forgotten**: Secure data deletion with email confirmation
- **Transparency**: Clear privacy policy and data handling information
- **Audit Trail**: Complete logging of all privacy-related actions

### Audit Logging System
- **Comprehensive Tracking**: All data access, exports, deletions, and sensitive operations
- **Structured Logging**: Categorized events with severity levels and metadata
- **Retention Policies**: Automatic cleanup based on event type and compliance requirements
- **Performance Optimized**: Asynchronous logging that doesn't impact app performance

## Development

### Feature Flags

Enable embedded finance features:
```env
EXPO_PUBLIC_EMBED_FINANCE_BETA=true
EXPO_PUBLIC_MONETIZATION_V1=true
EXPO_PUBLIC_COMPLIANCE_CENTER=true
EXPO_PUBLIC_SECURITY_MONITORING=true
EXPO_PUBLIC_GDPR_TOOLS=true
EXPO_PUBLIC_AUDIT_LOGGING=true
EXPO_PUBLIC_PARTNER_HUB=true
```

### Testing

#### Virtual Cards
1. Use Stripe test mode for development
2. Test card creation and management flows
3. Verify spending limit enforcement
4. Test blocking/unblocking functionality

#### Cancellation Bot
1. Set up test vendor accounts
2. Test automation with valid credentials
3. Verify error handling with invalid credentials
4. Test retry logic for failed cancellations

#### Affiliate System
1. Test affiliate link generation
2. Verify click tracking functionality
3. Test conversion attribution
4. Validate commission calculations

#### Security & Compliance
1. Test security health check automation
2. Verify GDPR data export functionality
3. Test data deletion workflow with email confirmation
4. Validate audit logging across all operations

### Monitoring

- **Sentry**: Error tracking and performance monitoring
- **Custom Metrics**: Virtual card usage and cancellation success rates
- **Affiliate Analytics**: Click-through rates and conversion tracking
- **Security Metrics**: Health scores, finding resolution rates, breach detection
- **Compliance Metrics**: Data export completion times, deletion request processing

## Production Deployment

### Security Checklist
- [ ] Enable Stripe live mode
- [ ] Configure production Weavr credentials
- [ ] Set up HaveIBeenPwned API key for breach monitoring
- [ ] Set up SSL/TLS certificates
- [ ] Enable database encryption
- [ ] Configure secure credential storage
- [ ] Set up monitoring and alerting
- [ ] Configure email service for GDPR notifications
- [ ] Set up automated security scanning schedule

### Compliance
- [ ] PCI DSS compliance for card data
- [ ] GDPR compliance for EU users
- [ ] CCPA compliance for California users
- [ ] SOC 2 compliance for enterprise customers
- [ ] Data retention policy implementation
- [ ] Audit log compliance with regulations
- [ ] Security incident response procedures

### Performance
- [ ] CDN configuration for static assets
- [ ] Database query optimization
- [ ] Caching for affiliate links
- [ ] Rate limiting for API endpoints
- [ ] Audit log performance optimization
- [ ] Security check scheduling optimization

## Support

- **Free tier**: Community support
- **Pro tier**: Email & chat support
- **Team tier**: Priority support with dedicated account management

## Security & Privacy

### Data Protection
- All sensitive data encrypted at rest and in transit
- Virtual card data tokenized and securely stored
- Audit logs maintained for compliance and transparency
- Regular security health checks and monitoring

### User Rights
- Complete data export capabilities
- Right to be forgotten with secure deletion
- Transparent privacy policy and data handling
- User control over all data processing activities

For technical questions about embedded finance features, please refer to the API documentation or contact our technical support team.

---

**Security Notice**: This platform handles sensitive financial data and implements comprehensive security monitoring. Users have full control over their data with GDPR-compliant export and deletion capabilities. Always follow security best practices and comply with relevant regulations in your jurisdiction.