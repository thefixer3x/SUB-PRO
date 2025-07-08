# Stripe Webhook Configuration - subtrack-pro.lanonasis.com

## 🔗 Updated Webhook URLs for Stripe Dashboard

### **Main Webhook Endpoint (Standard Events)**
**Configure at**: https://dashboard.stripe.com/webhooks

```
URL: https://subtrack-pro.lanonasis.com/api/stripe/webhook
Webhook Secret: whsec_BsDevFB9UiEuHhsUvXMCD2sirRFa8qLd
```

**Events to Select:**
```
customer.subscription.created
customer.subscription.updated  
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
issuing_authorization.created
issuing_authorization.updated
issuing_transaction.created
issuing_card.created
issuing_cardholder.created
```

### **Connect Authorization Webhook (Payment Control)**
**Configure at**: https://dashboard.stripe.com/connect/webhooks

```
URL: https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization
Webhook Secret: [Will be generated when you create this webhook]
```

**Events to Select:**
```
account.updated
application_fee.created
transfer.created
payment_intent.requires_action
payment_intent.processing
charge.pending
```

## 🎯 Updated Domain Configuration

### **Environment Variables**
```bash
NEXT_PUBLIC_DOMAIN=https://subtrack-pro.lanonasis.com
STRIPE_WEBHOOK_SECRET=whsec_BsDevFB9UiEuHhsUvXMCD2sirRFa8qLd
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_your_connect_webhook_secret_here
```

### **App Configuration (app.json)**
```json
{
  "ios": {
    "associatedDomains": [
      "applinks:subtrack-pro.lanonasis.com"
    ]
  },
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [
          {
            "scheme": "https",
            "host": "subtrack-pro.lanonasis.com"
          }
        ]
      }
    ]
  }
}
```

### **Support & Contact Information**
```
Support Email: support@subtrack-pro.lanonasis.com
Privacy Policy: https://subtrack-pro.lanonasis.com/privacy
Terms of Service: https://subtrack-pro.lanonasis.com/terms
Support URL: https://subtrack-pro.lanonasis.com/support
Marketing URL: https://subtrack-pro.lanonasis.com
Demo Account: demo@subtrack-pro.lanonasis.com
```

## 🔧 Stripe CLI Configuration

### **Update Connect Account Authorization**
```bash
# Set authorization webhook for Connect accounts
stripe accounts update acct_connected_account_id \
  --settings[payments][authorization_webhook_url]="https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization" \
  --live
```

### **Test Webhook Endpoints**
```bash
# Test main webhook
curl -X POST https://subtrack-pro.lanonasis.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type": "customer.subscription.created"}'

# Test Connect authorization webhook  
curl -X POST https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type": "payment_intent.requires_action"}'
```

## 📋 Action Items

### **1. Update Stripe Dashboard**
- [ ] Update main webhook URL to `https://subtrack-pro.lanonasis.com/api/stripe/webhook`
- [ ] Create Connect webhook at `https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization`
- [ ] Copy new Connect webhook secret to `.env` file

### **2. Domain Setup**
- [ ] Ensure `subtrack-pro.lanonasis.com` is properly configured and accessible
- [ ] Set up SSL certificate for the domain
- [ ] Configure DNS to point to your hosting service

### **3. Test Configuration**
- [ ] Verify webhook endpoints are accessible
- [ ] Test webhook signature validation
- [ ] Confirm authorization decisions are working

## 🔄 Migration Notes

All references have been updated from:
- ❌ `subtrack-pro.com` 
- ✅ `subtrack-pro.lanonasis.com`

This includes:
- API endpoint configurations
- App deep linking
- Documentation and guides
- Support contact information
- Webhook URLs
- Email addresses

---

**Ready to configure in Stripe Dashboard with the new domain!** 🚀

Last Updated: 2025-07-08