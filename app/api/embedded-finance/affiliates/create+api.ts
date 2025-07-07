export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscriptionId, originalUrl, provider, commission } = body;

    // Validate input
    if (!subscriptionId || !originalUrl || !provider) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    try {
      new URL(originalUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate affiliate URL based on provider
    const affiliateUrl = await generateAffiliateUrl(originalUrl, provider);

    const affiliateLink = {
      id: `aff_${Date.now()}`,
      subscriptionId,
      originalUrl,
      affiliateUrl,
      commission: commission || 0.05,
      provider,
      isActive: true,
      clickCount: 0,
      conversionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, save to database
    console.log('Created affiliate link:', affiliateLink.id);

    return Response.json(affiliateLink);
  } catch (error) {
    console.error('Affiliate link creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function generateAffiliateUrl(originalUrl: string, provider: string): Promise<string> {
  // In production, integrate with actual affiliate networks
  const url = new URL(originalUrl);
  
  switch (provider.toLowerCase()) {
    case 'impact':
      // Impact Radius affiliate network
      return `https://impact.com/redirect?url=${encodeURIComponent(originalUrl)}&campaign=subscription_manager`;
    
    case 'cj':
      // Commission Junction
      return `https://www.dpbolvw.net/click-${process.env.CJ_WEBSITE_ID}-${process.env.CJ_AD_ID}?url=${encodeURIComponent(originalUrl)}`;
    
    case 'shareasale':
      // ShareASale
      return `https://www.shareasale.com/r.cfm?b=${process.env.SHAREASALE_BANNER_ID}&u=${process.env.SHAREASALE_AFFILIATE_ID}&m=${process.env.SHAREASALE_MERCHANT_ID}&urllink=${encodeURIComponent(originalUrl)}`;
    
    case 'direct':
      // Direct affiliate program
      url.searchParams.set('ref', process.env.AFFILIATE_ID || 'subscription_manager');
      url.searchParams.set('utm_source', 'subscription_manager');
      return url.toString();
    
    default:
      // Generic affiliate URL with tracking
      url.searchParams.set('utm_source', 'subscription_manager');
      url.searchParams.set('utm_medium', 'affiliate');
      url.searchParams.set('utm_campaign', 'plan_switch');
      return url.toString();
  }
}