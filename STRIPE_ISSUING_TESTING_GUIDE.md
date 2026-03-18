# Stripe Issuing Testing Guide - SubTrack Pro

## 🚀 Pre-Activation Checklist

Before enabling Stripe Issuing, ensure you have:
- [ ] Business verification completed
- [ ] Valid business address
- [ ] Tax ID (EIN) on file
- [ ] Terms of service updated to include card issuing
- [ ] Privacy policy updated for card data handling

## 📋 Activation Steps

### 1. Enable Stripe Issuing
```bash
# Visit this URL to start the process
https://dashboard.stripe.com/issuing/overview
```

### 2. Configure Issuing Settings
In the Stripe Dashboard:
- Set business information
- Configure default spending controls
- Set up fraud prevention rules
- Enable webhook endpoints

## 🧪 Testing Flow (Once Activated)

### Step 1: Test Cardholder Creation
```bash
# Using Stripe CLI (replace with real user data)
stripe issuing cardholders create \
  --type=individual \
  --name="John Doe" \
  --email="john@example.com" \
  --phone-number="+1234567890" \
  --billing[address][line1]="123 Main St" \
  --billing[address][city]="San Francisco" \
  --billing[address][state]="CA" \
  --billing[address][country]="US" \
  --billing[address][postal_code]="94111" \
  --live
```

Expected Response:
```json
{
  "id": "ich_xxxxxxxxxxxxx",
  "object": "issuing.cardholder",
  "status": "active",
  "type": "individual",
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Step 2: Test Virtual Card Creation
```bash
# Create a virtual card for the cardholder
stripe issuing cards create \
  --cardholder=ich_xxxxxxxxxxxxx \
  --type=virtual \
  --currency=usd \
  --status=active \
  --live
```

Expected Response:
```json
{
  "id": "ic_xxxxxxxxxxxxx",
  "object": "issuing.card",
  "brand": "visa",
  "type": "virtual",
  "last4": "4242",
  "status": "active"
}
```

### Step 3: Test Spending Controls
```bash
# Set monthly spending limit of $100
stripe issuing cards update ic_xxxxxxxxxxxxx \
  --spending-controls[spending-limits][0][amount]=10000 \
  --spending-controls[spending-limits][0][interval]=monthly \
  --spending-controls[spending-limits][1][amount]=5000 \
  --spending-controls[spending-limits][1][interval]=per_authorization \
  --live
```

### Step 4: Test Card Retrieval
```bash
# Get full card details (including sensitive data - be careful!)
stripe issuing cards retrieve ic_xxxxxxxxxxxxx \
  --live
```

## 🔧 API Testing with Your App

### Test Card Creation via API
```bash
# Test your app's virtual card creation endpoint
curl -X POST http://localhost:3000/api/embedded-finance/virtual-cards/create \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "stripe",
    "subscriptionId": "test-subscription-123",
    "userId": "user-123",
    "spendingLimit": 15.99,
    "merchantCategory": "digital_goods_media",
    "userEmail": "test@example.com",
    "userName": "Test User",
    "userPhone": "+1234567890"
  }'
```

### Test Card Listing
```bash
# List cards for a user
curl "http://localhost:3000/api/embedded-finance/virtual-cards/list?userId=user-123"
```

### Test Card Updates
```bash
# Pause a card
curl -X PATCH http://localhost:3000/api/embedded-finance/virtual-cards/ic_xxxxxxxxxxxxx/update \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

## 📊 Real Transaction Testing

### Test with Real Purchases
Once you have an active virtual card:

1. **Small Test Purchase**
   - Try a $1 purchase at a supported merchant
   - Verify authorization webhook is received
   - Check transaction appears in Stripe Dashboard

2. **Spending Limit Test**
   - Set a low limit (e.g., $5)
   - Try to make a $10 purchase
   - Verify it gets declined
   - Check decline webhook is received

3. **Category Restriction Test**
   - Set allowed categories to only "online_services"
   - Try purchasing from a different category
   - Verify decline due to category restriction

### Monitor Webhooks
```bash
# Listen for webhook events during testing
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Expected webhook events:
- `issuing_cardholder.created`
- `issuing_card.created`
- `issuing_authorization.created`
- `issuing_transaction.created`

## 🔍 Verification Checklist

### Card Creation ✅
- [ ] Cardholder created successfully
- [ ] Virtual card issued
- [ ] Card appears in Stripe Dashboard
- [ ] Card data properly sanitized in API responses

### Spending Controls ✅
- [ ] Monthly limits enforced
- [ ] Per-authorization limits work
- [ ] Category restrictions active
- [ ] Blocked categories prevented

### Real-time Monitoring ✅
- [ ] Authorization webhooks received
- [ ] Transaction webhooks received
- [ ] Decline notifications work
- [ ] Real-time user notifications

### Security & Compliance ✅
- [ ] Sensitive card data never logged
- [ ] PCI compliance maintained
- [ ] User consent for card creation
- [ ] Proper data encryption

## 🚨 Common Issues & Solutions

### Issue: "Account not set up for Issuing"
**Solution**: Complete business verification in Stripe Dashboard

### Issue: "Invalid billing address"
**Solution**: Ensure all address fields are properly formatted and valid

### Issue: "Cardholder creation failed"
**Solution**: Check required fields (name, email, phone, address)

### Issue: "Webhooks not received"
**Solution**: Verify webhook endpoint is publicly accessible and returns 200

### Issue: "Card declined unexpectedly"
**Solution**: Check spending limits and merchant categories

## 💡 Best Practices

1. **Start Small**: Test with small amounts first
2. **Monitor Closely**: Watch all transactions in dashboard
3. **User Education**: Explain spending controls to users
4. **Secure Storage**: Never store full card details
5. **Audit Trail**: Log all card operations for compliance

## 📈 Production Readiness

Before going live:
- [ ] All test cases pass
- [ ] Webhook handling robust
- [ ] Error handling comprehensive
- [ ] User interface polished
- [ ] Compliance documentation complete
- [ ] Support processes defined

## 🔗 Useful Stripe Dashboard Links

- **Issuing Overview**: https://dashboard.stripe.com/issuing/overview
- **Cardholders**: https://dashboard.stripe.com/issuing/cardholders
- **Cards**: https://dashboard.stripe.com/issuing/cards
- **Transactions**: https://dashboard.stripe.com/issuing/transactions
- **Disputes**: https://dashboard.stripe.com/issuing/disputes

---

**Next Steps**: Once Stripe Issuing is activated, work through this testing guide step by step to ensure everything works perfectly before launching to users!

Last Updated: 2025-07-08