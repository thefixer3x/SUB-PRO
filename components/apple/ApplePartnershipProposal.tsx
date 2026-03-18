import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface ApplePartnershipProposalProps {
  onClose?: () => void;
}

export const ApplePartnershipProposal: React.FC<ApplePartnershipProposalProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const [currentSection, setCurrentSection] = useState(0);

  const sections = [
    {
      title: "🍎 Apple Partnership Proposal",
      subtitle: "First Screen Time Integration Partner",
      content: [
        "SUB-PRO proposes strategic partnership with Apple to revolutionize subscription management through Screen Time integration.",
        "Mutual benefit: 15-25% increase in App Store subscription revenue while saving users $300+ annually.",
        "Unique value: First app to combine Screen Time data with AI-powered subscription optimization."
      ]
    },
    {
      title: "💰 Revenue Opportunity",
      subtitle: "Win-Win Financial Model",
      content: [
        "Apple Benefits: $50M+ annual installment fees, 20% subscription revenue boost, premium analytics licensing",
        "User Benefits: Subscription credits until payday, Apple Pay installment integration, intelligent usage insights",
        "Market Advantage: Exclusive Screen Time access creates competitive moat vs. Google Play"
      ]
    },
    {
      title: "🔬 Technical Innovation",
      subtitle: "Privacy-First Implementation",
      content: [
        "On-device AI processing with differential privacy",
        "Screen Time API integration for usage analytics",
        "Apple Pay installment system for subscription credits",
        "Core ML powered recommendations engine"
      ]
    },
    {
      title: "🏆 Partnership Badge Request",
      subtitle: "First Screen Time Partner Recognition",
      content: [
        "Request official 'First Screen Time Partner' badge",
        "Recognition as pioneer in Screen Time API utilization",
        "Marketing rights as Apple's subscription intelligence partner",
        "Exclusive access during beta testing phases"
      ]
    }
  ];

  const nextSection = () => {
    setCurrentSection((prev) => (prev + 1) % sections.length);
  };

  const prevSection = () => {
    setCurrentSection((prev) => (prev - 1 + sections.length) % sections.length);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Apple Partnership Badge */}
      <LinearGradient
        colors={['#007AFF', '#5856D6', '#AF52DE']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.badgeContainer}>
          <View style={styles.partnerBadge}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.badgeText}>FIRST SCREEN TIME PARTNER</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
        </View>
        
        <Text style={styles.headerTitle}>Apple Partnership Proposal</Text>
        <Text style={styles.headerSubtitle}>Revolutionizing Subscription Management</Text>
        
        {onClose && (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        )}
      </LinearGradient>

      {/* Content Sections */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {sections[currentSection].title}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {sections[currentSection].subtitle}
          </Text>
          
          <View style={styles.contentList}>
            {sections[currentSection].content.map((item, index) => (
              <View key={index} style={styles.contentItem}>
                <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                <Text style={[styles.contentText, { color: colors.text }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsContainer}>
          <Text style={[styles.metricsTitle, { color: colors.text }]}>
            Partnership Impact Metrics
          </Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.metricValue, { color: colors.primary }]}>+25%</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                App Store Revenue
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.metricValue, { color: colors.primary }]}>$300+</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                User Savings/Year
              </Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.metricValue, { color: colors.primary }]}>1M+</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                Credit Users
              </Text>
            </View>
          </View>
        </View>

        {/* Call to Action */}
        <LinearGradient
          colors={['#34C759', '#30D158']}
          style={styles.ctaContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.ctaTitle}>Ready to Partner?</Text>
          <Text style={styles.ctaSubtitle}>
            Contact SUB-PRO team to discuss implementation timeline and revenue sharing
          </Text>
          <View style={styles.contactInfo}>
            <Text style={styles.contactText}>📧 partnerships@sub-pro.app</Text>
            <Text style={styles.contactText}>📱 Demo available immediately</Text>
          </View>
        </LinearGradient>

        {/* Review Team Message */}
        <View style={[styles.reviewMessage, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.reviewText, { color: colors.text }]}>
            <Text style={{ fontWeight: 'bold' }}>To Apple Review Team: </Text>
            This proposal demonstrates our commitment to enhancing the Apple ecosystem. 
            We're ready to collaborate on Screen Time integration for mutual benefit.
          </Text>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navigation, { backgroundColor: colors.card }]}>
        <Pressable style={styles.navButton} onPress={prevSection}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={[styles.navText, { color: colors.primary }]}>Previous</Text>
        </Pressable>
        
        <View style={styles.pageIndicator}>
          {sections.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentSection ? colors.primary : colors.border
                }
              ]}
            />
          ))}
        </View>
        
        <Pressable style={styles.navButton} onPress={nextSection}>
          <Text style={[styles.navText, { color: colors.primary }]}>Next</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionContainer: {
    paddingVertical: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  contentList: {
    gap: 16,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 12,
  },
  contentText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  metricsContainer: {
    marginBottom: 30,
  },
  metricsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  ctaContainer: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 16,
  },
  contactInfo: {
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  reviewMessage: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  reviewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pageIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
