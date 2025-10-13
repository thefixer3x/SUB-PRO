import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  CreditCard,
  Shield,
  TrendingUp,
  Zap,
  Users,
  Star,
  ArrowRight,
  CheckCircle,
  Bell,
  DollarSign,
  BarChart3,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Mobile responsiveness utilities
const getResponsiveFontSize = (base: number) => {
  if (screenWidth < 350) return base * 0.85; // iPhone SE and small Android
  if (screenWidth < 400) return base * 0.9;  // Small phones
  return base;
};

const getCardWidth = () => {
  if (Platform.OS === 'web') return 360;
  if (screenWidth < 350) return screenWidth - 32; // More margin on small screens
  if (screenWidth < 400) return screenWidth - 36;
  return screenWidth - 40;
};

const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 350;

const LandingPage = () => {
  const insets = useSafeAreaInsets();
  const { colors, themeName } = useTheme();
  const scrollY = useSharedValue(0);
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1000 });
    slideAnim.value = withSpring(0, { damping: 15 });
  }, []);

  const heroAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [{ translateY: slideAnim.value }],
    };
  });

  const parallaxStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 300], [0, -100]);
    return {
      transform: [{ translateY }],
    };
  });

  // Create dynamic styles based on theme
  const dynamicStyles = React.useMemo(() => createStyles(colors, themeName), [colors, themeName]);

  const heroStatsData = [
    { value: '$1,200', label: 'Avg. Yearly Savings' },
    { value: '50K+', label: 'Happy Users' },
    { value: '4.9★', label: 'App Rating' },
  ];

  const features = [
    {
      icon: CreditCard,
      title: 'Smart Virtual Cards',
      description: 'Create secure virtual cards for each subscription with spending controls',
      benefit: 'Ultimate payment security',
      color: '#6366F1',
    },
    {
      icon: Bell,
      title: 'Auto-Cancellation',
      description: 'Our AI bot cancels unwanted subscriptions automatically',
      benefit: 'Cancel in time',
      color: '#F59E0B',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'AI-powered insights and spending optimization recommendations',
      benefit: 'Make informed decisions',
      color: '#10B981',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level encryption with GDPR/CCPA compliance',
      benefit: 'Military-grade protection',
      color: '#EF4444',
    },
    {
      icon: Users,
      title: 'Team & Family Plans',
      description: 'Shared subscriptions with role-based access controls',
      benefit: 'Save more together',
      color: '#8B5CF6',
    },
    {
      icon: DollarSign,
      title: 'Embedded Finance',
      description: 'White-label ready with full API suite for enterprise integration',
      benefit: 'Revenue opportunities',
      color: '#06B6D4',
    },
  ];

  const strategicAdvantages = [
    {
      icon: Zap,
      title: 'All-in-One Ecosystem',
      description: 'Finance + Cancellation + Analytics + Virtual Cards in one platform',
      color: '#F59E0B',
    },
    {
      icon: CreditCard,
      title: 'Embedded Finance Ready',
      description: 'Weavr & Stripe Issuing support with white-label capabilities',
      color: '#6366F1',
    },
    {
      icon: BarChart3,
      title: 'Dual Workflow Support',
      description: 'Both manual tracking and full automation for any user preference',
      color: '#10B981',
    },
    {
      icon: TrendingUp,
      title: 'Revenue Model Built-In',
      description: 'Affiliate system, commission tracking, and partner marketplace',
      color: '#EF4444',
    },
    {
      icon: Users,
      title: 'Consumer & Enterprise',
      description: 'Modular APIs serve individuals, teams, and enterprise clients',
      color: '#8B5CF6',
    },
    {
      icon: Shield,
      title: 'White-Label Ready',
      description: 'Enterprise reseller opportunities with complete customization',
      color: '#06B6D4',
    },
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for getting started',
      features: [
        'Manual subscription tracking',
        'Basic renewal alerts',
        'Spending overview',
        'Mobile & web access',
        'Community support',
      ],
      color: '#6B7280',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$4.99',
      period: '/month',
      description: 'Most popular for individuals',
      features: [
        'Everything in Free',
        'Auto-detection & sync',
        'Virtual card masking',
        'Advanced analytics',
        'Cancellation automation',
        'Priority support',
      ],
      color: '#6366F1',
      popular: true,
    },
    {
      name: 'Premium',
      price: '$9.99',
      period: '/month',
      description: 'For teams and power users',
      features: [
        'Everything in Pro',
        'Team accounts & sharing',
        'AI spending advisor',
        'Custom budgeting rules',
        'White-label options',
        'API access',
      ],
      color: '#F59E0B',
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Product Manager',
      text: 'Saved me over $800 in the first month by finding forgotten subscriptions!',
      rating: 5,
    },
    {
      name: 'Marcus Rivera',
      role: 'Freelancer',
      text: 'The insights helped me optimize my tools and boost productivity.',
      rating: 5,
    },
    {
      name: 'Emma Thompson',
      role: 'Student',
      text: 'Perfect for managing my budget. The interface is incredibly intuitive.',
      rating: 5,
    },
  ];

  return (
    <View style={dynamicStyles.container}>
      <Animated.ScrollView
        style={dynamicStyles.scrollView}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={themeName === 'dark' ? ['#1E293B', '#3B4B6B'] : ['#667eea', '#764ba2']}
          style={[dynamicStyles.heroSection, { paddingTop: insets.top + 20 }]}
        >
          <Animated.View style={[dynamicStyles.heroContent, parallaxStyle]}>
            <Animated.View style={heroAnimatedStyle}>
              <View style={dynamicStyles.heroBadge}>
                <Star size={16} color="#F59E0B" />
                <Text style={dynamicStyles.badgeText}>Trusted by 50K+ users</Text>
              </View>
              
              <Text style={dynamicStyles.heroTitle}>
                Take Control of Your{'\n'}
                <Text style={dynamicStyles.heroTitleAccent}>Subscriptions</Text>
              </Text>
              
              <Text style={dynamicStyles.heroSubtitle}>
                Stop overpaying for unused services. Our AI-powered platform helps you track, 
                manage, and optimize all your subscriptions in one beautiful dashboard.
              </Text>

              <View style={dynamicStyles.heroStats}>
                {heroStatsData.map((stat, index) => (
                  <React.Fragment key={stat.label}>
                    <View
                      style={[
                        dynamicStyles.statItem,
                        index === heroStatsData.length - 1 && dynamicStyles.statItemLast,
                      ]}
                    >
                      <Text style={dynamicStyles.statNumber}>{stat.value}</Text>
                      <Text style={dynamicStyles.statLabel}>{stat.label}</Text>
                    </View>
                    {index < heroStatsData.length - 1 && (
                      <View style={dynamicStyles.statDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>

              <Pressable
                style={dynamicStyles.ctaButton}
                onPress={() => router.push('/(auth)/signup')}
              >
                <LinearGradient
                  colors={['#F59E0B', '#F97316']}
                  style={dynamicStyles.ctaGradient}
                >
                  <Text style={dynamicStyles.ctaText}>Start Free Trial</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>

              <Text style={dynamicStyles.trialText}>
                14-day free trial • No credit card required
              </Text>
            </Animated.View>
          </Animated.View>
        </LinearGradient>

        {/* Strategic Advantages Section */}
        <View style={[dynamicStyles.strategicSection, { backgroundColor: colors.background }]}>
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Strategic Advantage</Text>
          <Text style={[dynamicStyles.sectionSubtitle, { color: colors.textSecondary }]}>
            The only all-in-one platform designed for modern subscription management
          </Text>

          <View style={dynamicStyles.strategicGrid}>
            {strategicAdvantages.map((advantage, index) => (
              <StrategicCard
                advantage={advantage}
                index={index}
                scrollY={scrollY}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Pricing Section */}
        <LinearGradient
          colors={themeName === 'dark' ? [colors.backgroundSecondary, colors.card] : ['#F8FAFC', '#F1F5F9']}
          style={dynamicStyles.pricingSection}
        >
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Choose Your Plan</Text>
          <Text style={[dynamicStyles.sectionSubtitle, { color: colors.textSecondary }]}>
            Start free, upgrade as you grow. Cancel anytime.
          </Text>

          <View style={dynamicStyles.pricingGrid}>
            {pricingTiers.map((tier, index) => (
              <PricingCard
                tier={tier}
                index={index}
                colors={colors}
              />
            ))}
          </View>
        </LinearGradient>

        {/* Features Section */}
        <View style={[dynamicStyles.featuresSection, { backgroundColor: colors.background }]}>
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Why Choose SubTrack Pro?</Text>
          <Text style={[dynamicStyles.sectionSubtitle, { color: colors.textSecondary }]}>
            Everything you need to master your subscription spending
          </Text>

          <View style={dynamicStyles.featuresGrid}>
            {features.map((feature, index) => (
              <FeatureCard
                feature={feature}
                index={index}
                scrollY={scrollY}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Benefits Section */}
        <LinearGradient
          colors={themeName === 'dark' ? [colors.backgroundSecondary, colors.card] : ['#F8FAFC', '#F1F5F9']}
          style={dynamicStyles.benefitsSection}
        >
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Transform Your Financial Life</Text>
          
          <View style={dynamicStyles.benefitsList}>
            {[
              'Automatically detect and categorize all subscriptions',
              'Get smart recommendations to reduce costs',
              'Set custom budgets and spending limits',
              'Share subscriptions with family and friends',
              'Export data for tax and accounting purposes',
              'Cancel unwanted services with one tap',
            ].map((benefit, index) => (
              <View key={index} style={dynamicStyles.benefitItem}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={[dynamicStyles.benefitText, { color: colors.text }]}>{benefit}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Competitive Positioning Section */}
        <View style={[dynamicStyles.competitiveSection, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Why SubTrack Pro Wins</Text>
          <Text style={[dynamicStyles.sectionSubtitle, { color: colors.textSecondary }]}>
            See how we compare to other subscription management solutions
          </Text>

          <View style={dynamicStyles.comparisonGrid}>
            <View style={[dynamicStyles.comparisonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.comparisonTitle, { color: colors.text }]}>vs. Subscriptions & Bobby</Text>
              <Text style={[dynamicStyles.comparisonSubtitle, { color: colors.textMuted }]}>Privacy-focused crowd</Text>
              <View style={dynamicStyles.advantagesList}>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ More automation features</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Virtual card integration</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Team collaboration tools</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Enterprise white-labeling</Text>
              </View>
            </View>

            <View style={[dynamicStyles.comparisonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.comparisonTitle, { color: colors.text }]}>vs. RocketMoney & Trim</Text>
              <Text style={[dynamicStyles.comparisonSubtitle, { color: colors.textMuted }]}>Auto-detection/automation</Text>
              <View style={dynamicStyles.advantagesList}>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Better security controls</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Custom virtual cards</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Affiliate revenue sharing</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Advanced analytics</Text>
              </View>
            </View>

            <View style={[dynamicStyles.comparisonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.comparisonTitle, { color: colors.text }]}>vs. Monarch Money</Text>
              <Text style={[dynamicStyles.comparisonSubtitle, { color: colors.textMuted }]}>Full-suite financial users</Text>
              <View style={dynamicStyles.advantagesList}>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Subscription-focused design</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Automated cancellation</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Embedded finance ready</Text>
                <Text style={[dynamicStyles.advantageText, { color: colors.textSecondary }]}>✅ Partner marketplace</Text>
              </View>
            </View>
          </View>

          <View style={dynamicStyles.uniquePositioning}>
            <Text style={[dynamicStyles.positioningTitle, { color: colors.text }]}>
              "Your all-in-one smart wallet for subscriptions, spending control, 
              and cancel-anytime power—whether you're an individual or a team."
            </Text>
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={[dynamicStyles.testimonialsSection, { backgroundColor: colors.background }]}>
          <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Loved by Users Worldwide</Text>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.testimonialsContainer}
          >
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} colors={colors} />
            ))}
          </ScrollView>
        </View>

        {/* Final CTA Section */}
        <LinearGradient
          colors={themeName === 'dark' ? ['#1E293B', '#3B4B6B'] : ['#667eea', '#764ba2']}
          style={dynamicStyles.finalCtaSection}
        >
          <Text style={dynamicStyles.finalCtaTitle}>Ready to Save Money?</Text>
          <Text style={dynamicStyles.finalCtaSubtitle}>
            Join thousands of users who've already taken control
          </Text>
          
          <Pressable
            style={dynamicStyles.finalCtaButton}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={dynamicStyles.finalCtaText}>Get Started Free</Text>
            <ArrowRight size={20} color="#667eea" />
          </Pressable>

          <Text style={dynamicStyles.finalTrialText}>
            14-day free trial • Cancel anytime • No hidden fees
          </Text>
        </LinearGradient>

        {/* Footer */}
        <View style={[dynamicStyles.footer, { paddingBottom: insets.bottom + 20, backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[dynamicStyles.footerText, { color: colors.textMuted }]}>
            © 2025 SubTrack Pro. All rights reserved.
          </Text>
          <View style={dynamicStyles.partnerCreditContainer}>
            <PoweredByLanOnasis variant="minimal" />
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const FeatureCard = ({ feature, index, scrollY, colors }: { feature: any; index: number; scrollY: any; colors: ThemeColors }) => {
  const cardAnim = useSharedValue(0);
  const Icon = feature.icon;

  useEffect(() => {
    cardAnim.value = withDelay(
      index * 200,
      withSpring(1, { damping: 15 })
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [200 + index * 100, 400 + index * 100],
      [50, 0]
    );
    const opacity = interpolate(
      scrollY.value,
      [200 + index * 100, 400 + index * 100],
      [0, 1]
    );

    return {
      transform: [
        { translateY },
        { scale: cardAnim.value },
      ],
      opacity: opacity * cardAnim.value,
    };
  });

  return (
    <Animated.View style={[
      {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 24,
        width: Platform.OS === 'web' ? 360 : getCardWidth(),
        maxWidth: isSmallScreen ? Math.min(screenWidth - 30, 350) : 380, // Better responsive width
        minWidth: 280, // Ensure minimum width
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        marginVertical: 10, // Increased vertical margin
        marginHorizontal: 10, // Increased horizontal margin
      },
      cardStyle
    ]}>
      <View style={[
        {
          width: 56,
          height: 56,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          backgroundColor: feature.color,
        }
      ]}>
        <Icon size={24} color="#FFFFFF" />
      </View>
      
      <Text style={[
        {
          fontSize: 20,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        }
      ]}>{feature.title}</Text>
      <Text style={[
        {
          fontSize: 16,
          color: colors.textSecondary,
          lineHeight: 24,
          marginBottom: 16,
        }
      ]}>{feature.description}</Text>
      
      <View style={{ alignSelf: 'flex-start' }}>
        <Text style={[
          {
            fontSize: 14,
            fontWeight: '600',
            color: feature.color,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: `${feature.color}20`,
            borderRadius: 8,
            overflow: 'hidden',
          }
        ]}>
          {feature.benefit}
        </Text>
      </View>
    </Animated.View>
  );
};

const StrategicCard = ({ advantage, index, scrollY, colors }: { advantage: any; index: number; scrollY: any; colors: ThemeColors }) => {
  const cardAnim = useSharedValue(0);
  const Icon = advantage.icon;

  useEffect(() => {
    cardAnim.value = withDelay(
      index * 150,
      withSpring(1, { damping: 15 })
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [300 + index * 80, 500 + index * 80],
      [40, 0]
    );
    const opacity = interpolate(
      scrollY.value,
      [300 + index * 80, 500 + index * 80],
      [0, 1]
    );

    return {
      transform: [
        { translateY },
        { scale: cardAnim.value },
      ],
      opacity: opacity * cardAnim.value,
    };
  });

  return (
    <Animated.View style={[
      {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 24,
        width: Platform.OS === 'web' ? 300 : Math.min(screenWidth - 50, 320), // Better responsive width
        maxWidth: 320,
        minWidth: 280, // Ensure minimum width
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        marginVertical: 10, // Increased vertical margin
        marginHorizontal: 10, // Increased horizontal margin
      },
      cardStyle
    ]}>
      <View style={[
        {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          backgroundColor: advantage.color,
        }
      ]}>
        <Icon size={20} color="#FFFFFF" />
      </View>
      
      <Text style={[
        {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        }
      ]}>{advantage.title}</Text>
      <Text style={[
        {
          fontSize: 14,
          color: colors.textSecondary,
          lineHeight: 20,
        }
      ]}>{advantage.description}</Text>
    </Animated.View>
  );
};

const PricingCard = ({ tier, index, colors }: { tier: any; index: number; colors: ThemeColors }) => {
  return (
    <View style={[
      {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 32,
        width: Platform.OS === 'web' ? 300 : Math.min(screenWidth - 60, 320),
        maxWidth: 320,
        borderWidth: 1,
        borderColor: tier.popular ? colors.primary : colors.border,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        position: 'relative',
        marginTop: tier.popular ? 30 : 20, // Increased margin for popular badge
        marginBottom: 20, // Add bottom margin for spacing
        marginHorizontal: 10, // Increased horizontal margin to prevent overlapping
      },
      tier.popular && { 
        transform: [{ scale: Platform.OS === 'web' ? 1.02 : 1.0 }], // Only scale on web to prevent mobile overlap
        zIndex: 1, // Ensure popular card is above others
      }
      tier.popular && { } // Reduce scale to prevent overlap
    ]}>
      {tier.popular && (
        <View style={{
          position: 'absolute',
          top: -10,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 10, // Ensure badge is above other elements
          backgroundColor: colors.primary,
          paddingHorizontal: 16,
          paddingVertical: 6,
          borderRadius: 20,
          alignSelf: 'center',
          maxWidth: 120, // Limit width to prevent overflow
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '600',
            color: colors.textInverse,
            textTransform: 'uppercase',
          }}>Most Popular</Text>
        </View>
      )}
      
      <Text style={{
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
      }}>{tier.name}</Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Text style={{
          fontSize: 48,
          fontWeight: '800',
          color: tier.color,
        }}>{tier.price}</Text>
        <Text style={{
          fontSize: 16,
          color: colors.textSecondary,
          marginLeft: 4,
        }}>{tier.period}</Text>
      </View>
      <Text style={{
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
      }}>{tier.description}</Text>
      
      <View style={{ marginBottom: 32 }}>
        {tier.features.map((feature: string, featureIndex: number) => (
          <View key={featureIndex} style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <CheckCircle size={16} color={tier.color} />
            <Text style={{
              fontSize: 14,
              color: colors.text,
              marginLeft: 12,
              flex: 1,
            }}>{feature}</Text>
          </View>
        ))}
      </View>
      
      <Pressable
        style={[
          {
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            backgroundColor: tier.popular ? tier.color : colors.backgroundSecondary,
          }
        ]}
        onPress={() => router.push('/(auth)/signup')}
      >
        <Text style={[
          {
            fontSize: 16,
            fontWeight: '600',
            color: tier.popular ? colors.textInverse : colors.text,
          }
        ]}>
          {tier.name === 'Free' ? 'Get Started' : 'Start Free Trial'}
        </Text>
      </Pressable>
    </View>
  );
};

const TestimonialCard = ({ testimonial, colors }: { testimonial: any; colors: ThemeColors }) => {
  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: Platform.OS === 'web' ? 360 : Math.min(screenWidth - 50, 380), // Better responsive width
      maxWidth: 380,
      minWidth: 300, // Ensure minimum width
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      marginVertical: 5, // Add vertical margin
      marginHorizontal: 5, // Add horizontal margin
    }}>
      <View style={{
        flexDirection: 'row',
        marginBottom: 16,
      }}>
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} size={16} color="#F59E0B" fill="#F59E0B" />
        ))}
      </View>
      
      <Text style={{
        fontSize: 16,
        fontStyle: 'italic',
        color: colors.text,
        lineHeight: 24,
        marginBottom: 16,
      }}>"{testimonial.text}"</Text>
      
      <View style={{
        alignItems: 'flex-start',
      }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        }}>{testimonial.name}</Text>
        <Text style={{
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 4,
        }}>{testimonial.role}</Text>
      </View>
    </View>
  );
};


// Dynamic styles function that responds to theme changes
const createStyles = (colors: ThemeColors, themeName: string) => {
  const heroStacked = screenWidth < 768;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    minHeight: screenHeight * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40, // Add bottom padding for spacing
  },
  heroContent: {
    alignItems: 'center',
    maxWidth: 600,
    paddingHorizontal: 10, // Add padding for small screens
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  heroTitle: {
    fontSize: Platform.OS === 'web' ? 48 : getResponsiveFontSize(isVerySmallScreen ? 28 : 36),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: Platform.OS === 'web' ? 56 : getResponsiveFontSize(isVerySmallScreen ? 34 : 44),
  },
  heroTitleAccent: {
    color: '#F59E0B',
  },
  heroSubtitle: {
    fontSize: getResponsiveFontSize(isSmallScreen ? 16 : 18),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: getResponsiveFontSize(isSmallScreen ? 24 : 28),
    marginBottom: 32,
    maxWidth: isSmallScreen ? 320 : 500,
  },
    heroStats: {
      flexDirection: heroStacked ? 'column' : 'row',
      alignItems: heroStacked ? 'stretch' : 'center',
      justifyContent: heroStacked ? 'flex-start' : 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 16,
      padding: heroStacked ? 16 : 20,
      marginBottom: 40,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    statItem: {
      alignItems: 'center',
      flex: heroStacked ? undefined : 1,
      width: heroStacked ? '100%' : undefined,
      marginBottom: heroStacked ? 16 : 0,
    },
    statItemLast: {
      marginBottom: 0,
    },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginHorizontal: heroStacked ? 0 : 20,
      display: heroStacked ? 'none' : 'flex',
    },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  trialText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 32 : getResponsiveFontSize(isSmallScreen ? 24 : 28),
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    maxWidth: 600,
    alignSelf: 'center',
    lineHeight: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 15, // Increased padding to prevent edge overlapping
    marginVertical: 20, // Increased vertical margin for better spacing
    marginTop: 40, // Extra top margin to prevent overlap with previous section
  },
  strategicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 10, // Add padding to prevent edge overlapping
    marginVertical: 10, // Add vertical margin for spacing
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 15, // Increased padding to prevent edge overlapping
    marginTop: 20, // Increased vertical margin for better spacing
    marginBottom: 40, // Extra bottom margin to prevent overlap with next section
  },
  testimonialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 1000,
    alignSelf: 'center',
  },
  featureCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === 'web' ? 360 : screenWidth - 40,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  strategicCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === 'web' ? 300 : screenWidth - 40,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pricingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    width: Platform.OS === 'web' ? 300 : screenWidth - 40,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  testimonialCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === 'web' ? 360 : screenWidth - 40,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardIcon: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardBenefit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textInverse,
    textTransform: 'uppercase',
  },
  pricingHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pricingName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  pricingPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
  },
  pricingPeriod: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  pricingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  pricingButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pricingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  testimonialQuote: {
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorInfo: {
    marginLeft: 12,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  authorRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  finalCtaSection: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 20,
    paddingVertical: 80,
    alignItems: 'center',
  },
  finalCtaTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  finalCtaSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 500,
    lineHeight: 24,
  },
  comparisonSection: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    paddingHorizontal: 15, // Add padding to prevent edge overlapping
    marginVertical: 15, // Add vertical margin for spacing
  },
  comparisonCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === 'web' ? 240 : Math.max((screenWidth - 100) / 2, 280), // Improved responsive width
    maxWidth: 280,
    minWidth: 240, // Ensure minimum width
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 10, // Add vertical margin
    marginHorizontal: 5, // Add horizontal margin
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  comparisonSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  advantagesList: {
    gap: 8,
  },
  advantageText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  uniquePositioning: {
    maxWidth: 600,
    alignItems: 'center',
  },
  positioningTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 32,
    fontStyle: 'italic',
  },
  // Additional section styles
  strategicSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  pricingSection: {
    paddingHorizontal: 20,
    paddingVertical: 80, // Increased padding to prevent overlap
    alignItems: 'center',
    marginBottom: 20, // Add bottom margin for extra spacing
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 80, // Increased padding to prevent overlap
    alignItems: 'center',
    marginTop: 20, // Add top margin for extra spacing
  },
  benefitsSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  benefitsList: {
    maxWidth: 600,
    alignSelf: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  competitiveSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  testimonialsSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  testimonialsContainer: {
    paddingHorizontal: 20,
    gap: 20,
    paddingVertical: 10, // Add vertical padding for spacing
  },
  finalCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  finalCtaText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
  },
  finalTrialText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
    footerText: {
      fontSize: 14,
    },
    partnerCreditContainer: {
      marginTop: 8,
      alignItems: 'center',
    },
  });
};

export default LandingPage;
