# 🚀 SubTrack Pro - Deployment & Database Sync Guide

This guide covers how to properly sync your database and deploy your application across different environments.

## 📋 **Overview**

Your SubTrack Pro application has several components that need to be synchronized:

1. **Supabase Database** - Your backend database with tables, functions, and policies
2. **TypeScript Types** - Generated from your database schema
3. **Web Application** - Built and deployed to Netlify
4. **Environment Variables** - Production configuration
5. **EAS Mobile Builds** - iOS and Android applications

## 🗄️ **Database Synchronization**

### **Automatic Population vs Manual Setup**

**✅ What Auto-Populates on Netlify:**
- Static files (HTML, CSS, JS)
- Environment variables (if configured)
- Build artifacts

**❌ What Does NOT Auto-Populate:**
- Supabase database tables
- Database functions and policies
- Database triggers and RLS policies

**🔧 What You Need to Manually Setup:**

### **Step 1: Supabase Database Setup**

Your database needs to be properly configured with all tables and functions. We've created a complete migration file.

#### **Option A: Using Supabase Dashboard (Recommended for Production)**

1. **Go to your Supabase Dashboard**
   - Visit [app.supabase.com](https://app.supabase.com)
   - Select your SubTrack Pro project

2. **Run the Migration**
   - Go to "SQL Editor" tab
   - Copy the contents of `supabase/migrations/20250902_complete_schema.sql`
   - Paste and execute the SQL

3. **Verify Tables Created**
   - Go to "Table Editor" tab
   - You should see these tables:
     - `profiles`
     - `subscriptions`
     - `virtual_cards`
     - `card_authorizations`
     - `payment_records`
     - `sm_feature_flags`

#### **Option B: Using Supabase CLI (Recommended for Development)**

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Link your project
supabase link --project-ref YOUR_PROJECT_REF

# 3. Apply migrations
supabase db push

# 4. Generate TypeScript types
supabase gen types typescript --project-ref YOUR_PROJECT_REF > lib/supabase-generated.ts
```

### **Step 2: Environment Variables**

#### **Required Environment Variables for Production:**

**Supabase Variables:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb... (server-side only)
```

**Stripe Variables:**
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_...)
STRIPE_SECRET_KEY=sk_live_... (or sk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Feature Flags:**
```env
EXPO_PUBLIC_EMBED_FINANCE_BETA=true
EXPO_PUBLIC_MONETIZATION_V1=true
EXPO_PUBLIC_COMPLIANCE_CENTER=true
EXPO_PUBLIC_SECURITY_MONITORING=true
EXPO_PUBLIC_GDPR_TOOLS=true
EXPO_PUBLIC_AUDIT_LOGGING=true
EXPO_PUBLIC_PARTNER_HUB=true
```

#### **Setting Environment Variables in Netlify:**

1. Go to Netlify Dashboard → Your Site → Site Settings
2. Navigate to "Environment Variables"
3. Add all the variables listed above
4. Redeploy your site

### **Step 3: Automated Deployment Script**

We've created a deployment script that handles everything:

```bash
# Run the deployment script
./scripts/deploy-sync.sh

# Options:
# 1) Full deployment (Database + Build + Deploy)
# 2) Database sync only  
# 3) Build and deploy only
# 4) Generate types only
```

## 🌐 **Web Deployment (Netlify)**

### **Manual Deployment Steps:**

1. **Build the Application**
   ```bash
   npm install
   npm run build:production
   ```

2. **Deploy to Netlify**
   ```bash
   # Using Netlify CLI
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   
   # Or drag and drop the 'dist' folder in Netlify Dashboard
   ```

### **Automated Deployment (Recommended):**

Your `netlify.toml` is already configured for automatic deployment:

```toml
[build]
  publish = "dist"
  command = "npm run build:production"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**To enable automatic deployment:**
1. Connect your GitHub repository to Netlify
2. Set up the environment variables in Netlify Dashboard
3. Every push to main branch will auto-deploy

## 📱 **Mobile App Deployment (EAS)**

Your mobile apps are deployed separately using EAS:

```bash
# Build for both platforms
./scripts/pre-build-check.sh  # Validate first (FREE)
eas build --platform all --profile production

# Submit to app stores
eas submit --platform all --non-interactive
```

**Note:** Mobile apps use the same backend (Supabase) but have separate build pipeline.

## 🔍 **Verification Checklist**

After deployment, verify these work:

### **Database Verification:**
- [ ] Can create new user accounts
- [ ] User profiles are created automatically
- [ ] Feature flags are loading
- [ ] Subscriptions can be created/updated
- [ ] Authentication works properly

### **Application Verification:**
- [ ] Landing page loads correctly
- [ ] Authentication flow works
- [ ] Protected routes redirect properly
- [ ] Settings page shows logout option
- [ ] No UI overlapping issues

### **API Verification:**
- [ ] Stripe integration works
- [ ] Feature flags API responds
- [ ] Database operations succeed
- [ ] No TypeScript errors in console

## 🚨 **Troubleshooting Common Issues**

### **Database Issues:**

**Problem:** Tables don't exist
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

**Solution:** Run the complete schema migration

**Problem:** RLS policies blocking access
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

**Solution:** Verify user authentication and policy setup

### **Build Issues:**

**Problem:** TypeScript errors during build
```bash
# Check for type errors
npm run type-check
```

**Solution:** Update TypeScript types and fix errors

**Problem:** Environment variables not available
```bash
# Check if variables are set
echo $EXPO_PUBLIC_SUPABASE_URL
```

**Solution:** Set variables in Netlify Dashboard and redeploy

### **Authentication Issues:**

**Problem:** Users can't sign in
- Check Supabase auth settings
- Verify redirect URLs match production domain
- Check email confirmation settings

**Problem:** Users stuck on landing page
- Verify authentication flow
- Check route guard implementation
- Verify profile creation trigger

## 📞 **Support Resources**

- **Supabase Docs:** [docs.supabase.com](https://docs.supabase.com)
- **Netlify Docs:** [docs.netlify.com](https://docs.netlify.com)
- **EAS Docs:** [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)

## 🎯 **Quick Deployment Commands**

```bash
# Complete deployment from scratch
./scripts/deploy-sync.sh  # Choose option 1

# Just database sync
./scripts/deploy-sync.sh  # Choose option 2

# Just build and deploy
npm run build:production && netlify deploy --prod --dir=dist

# Mobile build
eas build --platform all --profile production
```

---

**Remember:** Database setup is a **one-time process** per environment. Once configured, subsequent deployments only need to build and deploy the application code.