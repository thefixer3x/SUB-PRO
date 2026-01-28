# Netlify Domain Troubleshooting - lanonasis.com

## 🔍 **Diagnosis Summary**

### **Current Issues Found:**

1. **❌ Main Domain Not Responding**
   - `lanonasis.com` has no A record pointing to Netlify
   - HTTPS connection failing (port 443 unreachable)

2. **❌ Subdomain Not Configured**
   - `subtrack-pro.lanonasis.com` returns NXDOMAIN (doesn't exist)

3. **✅ Nameservers Correctly Set**
   - Using Netlify nameservers: `dns1.p01.nsone.net` through `dns4.p01.nsone.net`
   - DNS propagation is working

## 🛠️ **Step-by-Step Fix**

### **Step 1: Configure Domain in Netlify Dashboard**

1. **Login to Netlify:**
   - Go to https://app.netlify.com
   - Select your site (likely the SubTrack Pro site)

2. **Add Custom Domain:**
   ```
   Site Settings → Domain Settings → Custom domains
   Click "Add custom domain"
   Enter: lanonasis.com
   ```

3. **Add Subdomain:**
   ```
   Click "Add another domain"
   Enter: subtrack-pro.lanonasis.com
   ```

### **Step 2: Configure DNS Records**

In Netlify DNS settings, you need these records:

```
# A Records (for main domain)
Type: A
Name: @
Value: 75.2.60.5 (Netlify's IP)

Type: A  
Name: www
Value: 75.2.60.5

# CNAME Records (for subdomain)
Type: CNAME
Name: subtrack-pro
Value: your-site-name.netlify.app

# Optional: Wildcard subdomain
Type: CNAME
Name: *
Value: your-site-name.netlify.app
```

### **Step 3: Enable SSL Certificate**

1. **In Netlify Dashboard:**
   ```
   Site Settings → Domain Settings → HTTPS
   Click "Verify DNS configuration"
   Wait for SSL certificate to provision (5-30 minutes)
   ```

2. **Force HTTPS:**
   ```
   Enable "Force TLS connections"
   ```

## 🔧 **Netlify CLI Commands** (Alternative Method)

If you have Netlify CLI installed:

```bash
# Login to Netlify
netlify login

# Link your site
netlify link

# Add domain
netlify domains:create lanonasis.com

# Add subdomain
netlify domains:create subtrack-pro.lanonasis.com

# Check status
netlify domains:list
```

## 📋 **Current DNS Status** (As of diagnosis)

```bash
# Nameservers: ✅ CORRECT
dns1.p01.nsone.net
dns2.p01.nsone.net  
dns3.p01.nsone.net
dns4.p01.nsone.net

# A Records: ❌ MISSING
lanonasis.com → No A record found

# Subdomain: ❌ MISSING  
subtrack-pro.lanonasis.com → NXDOMAIN
```

## 🎯 **What You Need to Do Right Now**

### **Option A: Via Netlify Dashboard (Recommended)**

1. **Go to**: https://app.netlify.com/sites/[your-site-name]/settings/domain
2. **Add domains**:
   - `lanonasis.com`
   - `subtrack-pro.lanonasis.com`
3. **Wait for DNS propagation** (up to 24 hours, usually 1-2 hours)
4. **Enable SSL** once domains are verified

### **Option B: Manual DNS Configuration**

If you prefer manual DNS setup:

```bash
# Check what Netlify IP you should use
dig your-site-name.netlify.app

# Then add A records in Netlify DNS:
# Type: A, Name: @, Value: [Netlify IP]
# Type: A, Name: www, Value: [Netlify IP]  
# Type: CNAME, Name: subtrack-pro, Value: your-site-name.netlify.app
```

## ⏱️ **Expected Timeline**

1. **Immediate** (0-5 minutes): Add domains in Netlify
2. **5-30 minutes**: SSL certificate provisioning
3. **1-4 hours**: Full DNS propagation
4. **Up to 24 hours**: Worst case for global DNS propagation

## 🧪 **Testing Commands**

Use these to verify fixes:

```bash
# Test main domain
curl -I https://lanonasis.com

# Test subdomain  
curl -I https://subtrack-pro.lanonasis.com

# Check DNS propagation
dig lanonasis.com
dig subtrack-pro.lanonasis.com

# Test SSL
openssl s_client -connect lanonasis.com:443 -servername lanonasis.com
```

## 🚨 **Common Issues & Solutions**

### **Issue: "Domain already taken"**
**Solution**: Domain might be added to another Netlify site
- Check all your Netlify sites
- Remove domain from other sites first

### **Issue: SSL certificate not provisioning**
**Solution**: 
- Ensure DNS is pointing correctly
- Wait 30 minutes after DNS changes
- Try "Renew certificate" in Netlify dashboard

### **Issue: "DNS configuration not found"**
**Solution**:
- Double-check nameservers at your domain registrar
- Verify nameservers are exactly: `dns1.p01.nsone.net` (etc.)

## 📞 **Need Help?**

If issues persist:
1. **Netlify Support**: https://answers.netlify.com/
2. **Check Status**: https://netlifystatus.com/
3. **DNS Checker**: https://dnschecker.org/

---

## 🎯 **Next Steps After Domain Fix**

Once `subtrack-pro.lanonasis.com` is working:

1. **Update Stripe Webhooks**:
   - Main: `https://subtrack-pro.lanonasis.com/api/stripe/webhook`
   - Connect: `https://subtrack-pro.lanonasis.com/api/connect/webhooks/authorization`

2. **Test All Endpoints**:
   - Verify webhooks are reachable
   - Test SSL certificate
   - Confirm app deep linking works

3. **Update App Store Submissions**:
   - All URLs now point to working domain
   - Privacy policy, terms, support URLs

---

**The main issue is that lanonasis.com needs to be properly configured in Netlify with DNS records pointing to Netlify's servers!** 🚀

Last Updated: 2025-07-08