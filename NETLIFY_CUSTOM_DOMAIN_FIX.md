# Fix: lanonasis.com Not Pointing to Netlify

## 🎯 **The Issue**

✅ **Working**: `https://lanonasis.netlify.app` (your Netlify site)
❌ **Not Working**: `http://lanonasis.com` (still showing Hostinger)

**Root Cause**: Your domain `lanonasis.com` is not configured in your Netlify site settings. The nameservers are correct, but Netlify doesn't know to serve your site for this domain.

## 🚀 **The Fix (3 Steps)**

### **Step 1: Add Custom Domain in Netlify Dashboard**

1. **Go to your Netlify site**: https://app.netlify.com/sites/lanonasis/settings/domain
   
2. **Add custom domain**:
   - Click **"Add custom domain"**
   - Enter: `lanonasis.com`
   - Click **"Add domain"**

3. **Add subdomain** (for your SubTrack Pro app):
   - Click **"Add another domain"**
   - Enter: `subtrack-pro.lanonasis.com`
   - Click **"Add domain"**

### **Step 2: Configure DNS Records in Netlify**

After adding the domains, configure these DNS records:

1. **Go to**: https://app.netlify.com/sites/lanonasis/settings/domain#dns

2. **Add A Records for main domain**:
   ```
   Type: A
   Name: @
   Value: 35.157.26.135
   
   Type: A
   Name: @  
   Value: 63.176.8.218
   
   Type: A
   Name: www
   Value: 35.157.26.135
   
   Type: A
   Name: www
   Value: 63.176.8.218
   ```

3. **Add CNAME for subdomain**:
   ```
   Type: CNAME
   Name: subtrack-pro
   Value: lanonasis.netlify.app
   ```

### **Step 3: Set Primary Domain (Optional)**

1. **In Domain Settings**: https://app.netlify.com/sites/lanonasis/settings/domain
2. **Set Primary Domain**: Choose `lanonasis.com` as primary
3. **Enable Force HTTPS**: Once SSL is provisioned

## 🧪 **Alternative: Quick CLI Method**

If you have Netlify CLI:

```bash
# Login and link site
netlify login
netlify link --id lanonasis

# Add domains
netlify domains:create lanonasis.com
netlify domains:create subtrack-pro.lanonasis.com

# Check status
netlify domains:list
```

## ⏰ **Expected Timeline**

1. **0-5 minutes**: Add domains in Netlify dashboard
2. **5-15 minutes**: DNS records propagate
3. **15-30 minutes**: SSL certificate provisions
4. **1-2 hours**: Global DNS propagation

## 🔍 **Test Progress**

Use these commands to check progress:

```bash
# Test main domain
curl -I http://lanonasis.com

# Test subdomain (once configured)
curl -I https://subtrack-pro.lanonasis.com

# Check DNS
dig lanonasis.com
dig subtrack-pro.lanonasis.com
```

## 🎯 **What You Should See After Fix**

### **Before Fix**:
- `lanonasis.com` → Hostinger page
- `subtrack-pro.lanonasis.com` → NXDOMAIN

### **After Fix**:
- `lanonasis.com` → Your Netlify site (same as lanonasis.netlify.app)
- `subtrack-pro.lanonasis.com` → Your Netlify site (for API endpoints)

## 🔧 **Troubleshooting**

### **If domain shows "Domain already taken"**:
- Check if domain is added to another Netlify site
- Remove from other sites first

### **If still showing Hostinger after 2 hours**:
- Clear your browser cache
- Try incognito/private browsing
- Test from different device/network

### **If SSL certificate doesn't provision**:
- Wait 30 minutes after adding domain
- Try "Renew certificate" in Netlify dashboard

## 📋 **Verification Checklist**

After completing the fix:

- [ ] `http://lanonasis.com` shows your Netlify site
- [ ] `https://lanonasis.com` works with SSL
- [ ] `https://subtrack-pro.lanonasis.com` resolves
- [ ] Stripe webhook URLs are reachable:
  - `https://subtrack-pro.lanonasis.com/api/stripe/webhook`
  - `https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization`

## 🚀 **Next Steps After Domain Works**

1. **Update Stripe Dashboard**:
   - Main webhook: `https://subtrack-pro.lanonasis.com/api/stripe/webhook`
   - Connect webhook: `https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization`

2. **Test API Endpoints**:
   ```bash
   curl https://subtrack-pro.lanonasis.com/api/stripe/webhook
   curl https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization
   ```

3. **Deploy Updated App**:
   - Your mobile app will now use the correct domain for deep linking
   - App store URLs will work properly

---

**The key issue: Netlify nameservers are working, but you need to tell Netlify which domains to serve your site for!** 🎯

Last Updated: 2025-07-08