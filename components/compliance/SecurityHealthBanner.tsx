import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AlertTriangle as AlertTriangle, Shield, X, ChevronRight } from 'lucide-react-native';
import { SecurityHealthCheck } from '@/types/compliance';
import { securityMonitoringService } from '@/services/securityMonitoring';
import { FEATURE_FLAGS } from '@/config/compliance';

interface SecurityHealthBannerProps {
  userId: string;
  onPress?: () => void;
}

export const SecurityHealthBanner: React.FC<SecurityHealthBannerProps> = ({
  userId,
  onPress,
}) => {
  const [healthCheck, setHealthCheck] = useState<SecurityHealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (FEATURE_FLAGS.COMPLIANCE_CENTER && FEATURE_FLAGS.SECURITY_MONITORING) {
      loadHealthCheck();
    }
  }, [userId]);

  const loadHealthCheck = async () => {
    try {
      const check = await securityMonitoringService.getLatestHealthCheck(userId);
      setHealthCheck(check);
    } catch (error) {
      console.error('Failed to load security health check:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
    });
  };

  if (!FEATURE_FLAGS.COMPLIANCE_CENTER || !FEATURE_FLAGS.SECURITY_MONITORING) {
    return null;
  }

  if (loading || dismissed || !healthCheck) {
    return null;
  }

  // Only show banner for warning or critical status
  if (healthCheck.status === 'healthy') {
    return null;
  }

  const isUrgent = healthCheck.status === 'critical';
  const criticalFindings = healthCheck.findings.filter(f => f.severity === 'critical' || f.severity === 'high');

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[
        styles.banner,
        isUrgent ? styles.criticalBanner : styles.warningBanner
      ]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {isUrgent ? (
              <AlertTriangle size={20} color="#ffffff" />
            ) : (
              <Shield size={20} color="#ffffff" />
            )}
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isUrgent ? 'Security Issues Detected' : 'Security Recommendations'}
            </Text>
            <Text style={styles.subtitle}>
              {isUrgent 
                ? `${criticalFindings.length} critical security issues need immediate attention`
                : `Security score: ${healthCheck.score}/100. ${healthCheck.findings.length} items to review`
              }
            </Text>
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={onPress}>
            <Text style={styles.actionText}>Review</Text>
            <ChevronRight size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <X size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
  },
  banner: {
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  warningBanner: {
    backgroundColor: '#F59E0B',
  },
  criticalBanner: {
    backgroundColor: '#EF4444',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
});