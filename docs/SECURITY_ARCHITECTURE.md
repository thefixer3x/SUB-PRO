# Security Architecture & Secret Management

## Current Security Issues with Expo
- All `EXPO_PUBLIC_*` variables are bundled into the client app
- Secrets are visible in the JavaScript bundle
- No runtime secret protection

## Professional Secret Management Solutions

### 1. **EAS Secrets (Recommended for Expo)**
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Set build-time secrets (not exposed to client)
eas secret:create --scope project --name STRIPE_SECRET_KEY --value "sk_live_..."
eas secret:create --scope project --name SUPABASE_SERVICE_ROLE_KEY --value "eyJ..."

# Set environment-specific secrets
eas secret:create --scope project --name DATABASE_URL --value "postgresql://..."
```

**Usage in eas.json:**
```json
{
  "build": {
    "production": {
      "env": {
        "STRIPE_SECRET_KEY": "@stripe_secret_key",
        "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key"
      }
    }
  }
}
```

### 2. **Supabase Edge Functions for Sensitive Operations**
```typescript
// supabase/functions/process-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  // Sensitive payment processing happens server-side
  const { amount, currency } = await req.json()
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
  })
  
  return new Response(JSON.stringify({ client_secret: paymentIntent.client_secret }))
})
```

### 3. **AWS Secrets Manager Integration**
```typescript
// lib/secrets.ts (server-side only)
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

export async function getSecret(secretName: string) {
  const client = new SecretsManagerClient({ region: "us-east-1" })
  
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    )
    return JSON.parse(response.SecretString!)
  } catch (error) {
    console.error("Error retrieving secret:", error)
    throw error
  }
}
```

### 4. **HashiCorp Vault for Enterprise**
```typescript
// lib/vault.ts
import vault from 'node-vault'

const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ENDPOINT,
  token: process.env.VAULT_TOKEN,
})

export async function getVaultSecret(path: string) {
  try {
    const result = await vaultClient.read(path)
    return result.data
  } catch (error) {
    console.error('Vault error:', error)
    throw error
  }
}
```

## Recommended Architecture

### Client-Side (Expo App)
```typescript
// Only public/publishable keys
const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
}
```

### Server-Side (Supabase Functions/API Routes)
```typescript
// Sensitive operations with secret keys
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Never expose this!
)
```

## Implementation Strategy

### Phase 1: Immediate Fixes
1. **Move sensitive operations to Supabase Edge Functions**
2. **Use EAS Secrets for build-time secrets**
3. **Implement JWT-based authentication**

### Phase 2: Enhanced Security
1. **Integrate AWS Secrets Manager**
2. **Add secret rotation policies**
3. **Implement audit logging**

### Phase 3: Enterprise Grade
1. **HashiCorp Vault integration**
2. **Zero-trust architecture**
3. **Compliance monitoring**

## Best Practices

### ✅ Do
- Use EAS Secrets for build-time secrets
- Keep sensitive operations server-side
- Implement proper JWT validation
- Use publishable keys only in client
- Rotate secrets regularly
- Audit secret access

### ❌ Don't
- Put secret keys in EXPO_PUBLIC_* variables
- Store secrets in AsyncStorage
- Hardcode secrets in source code
- Use service role keys in client
- Share secrets across environments

## Current Project Recommendations

1. **Migrate Stripe operations to Supabase Edge Functions**
2. **Use EAS Secrets for sensitive environment variables**
3. **Implement proper API proxy pattern**
4. **Add JWT validation middleware**
5. **Set up secret rotation schedule**

## Security Checklist
- [ ] All secret keys moved to server-side
- [ ] EAS Secrets configured for build process
- [ ] Supabase RLS policies implemented
- [ ] JWT validation on all API endpoints
- [ ] Secret rotation policies in place
- [ ] Audit logging enabled
- [ ] Security testing completed

---
*Security is not a feature, it's a foundation.*
