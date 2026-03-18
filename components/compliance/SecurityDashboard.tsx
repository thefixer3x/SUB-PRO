import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Shield, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, ChevronRight, RefreshCw } from 'lucide-react-native';
import { SecurityHealthCheck, SecurityFinding } from '@/types/compliance';
import { securityMonitoringService } from '@/services/securityMonitoring';
import { FEATURE_FLAGS } from '@/config/compliance';

interface SecurityDashboardProps {
  userId: string;
  userEmail: string;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  userId,
  userEmail,
}) => {
  const [healthCheck, setHealthCheck] = useState<SecurityHealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (FEATURE_FLAGS.SECURITY_MONITORING) {
      loadHealthCheck();
    }
  }, [userId]);

  const loadHealthCheck = async () => {
    try {
      setLoading(true);
      const check = await securityMonitoringService.getLatestHealthCheck(userId);
      setHealthCheck(check);
    } catch (error) {
      console.error('Failed to load security health check:', error);
    } finally {
      setLoading(false);
    }
  };

  const runNewHealthCheck = async () => {
    try {
      setRefreshing(true);
      const newCheck = await securityMonitoringService.runSecurityHealthCheck({
        userId,
        userEmail,
        includeBreachCheck: true,
      });
      setHealthCheck(newCheck);
    } catch (error) {
      console.error('Failed to run health check:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const resolveSecurityFinding = async (findingId: string) => {
    try {
      await securityMonitoringService.resolveSecurityFinding(findingId);
      // Reload health check to update findings
      await loadHealthCheck();
    } catch (error) {
      console.error('Failed to resolve security finding:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#64748B';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle size={16} color="#EF4444" />;
      case 'high':
        return <AlertTriangle size={16} color="#F59E0B" />;
      case 'medium':
        return <AlertTriangle size={16} color="#F59E0B" />;
      case 'low':
        return <Clock size={16} color="#64748B" />;
      default:
        return <Clock size={16} color="#64748B" />;
    }
  };

  const renderScoreCard = () => {
    if (!healthCheck) return null;

    const scoreColor = getScoreColor(healthCheck.score);
    const statusColor = getStatusColor(healthCheck.status);

    return (
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Shield size={24} color={scoreColor} />
          <Text style={styles.scoreTitle}>Security Health Score</Text>
        </View>
        
        <View style={styles.scoreDisplay}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>
            {healthCheck.score}
          </Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>
            {healthCheck.status.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.scoreDescription}>
          Last checked: {new Date(healthCheck.lastRunAt).toLocaleString()}
        </Text>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={runNewHealthCheck}
          disabled={refreshing}
        >
          <RefreshCw size={16} color="#3B82F6" />
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Running Check...' : 'Run New Check'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFindings = () => {
    if (!healthCheck?.findings.length) {
      return (
        <View style={styles.noFindings}>
          <CheckCircle size={48} color="#10B981" />
          <Text style={styles.noFindingsTitle}>All Clear!</Text>
          <Text style={styles.noFindingsText}>
            No security issues detected. Your account security looks good.
          </Text>
        </View>
      );
    }

    // Group findings by severity
    const groupedFindings = healthCheck.findings.reduce((acc, finding) => {
      if (!acc[finding.severity]) acc[finding.severity] = [];
      acc[finding.severity].push(finding);
      return acc;
    }, {} as Record<string, SecurityFinding[]>);

    const severityOrder = ['critical', 'high', 'medium', 'low'];

    return (
      <View style={styles.findingsContainer}>
        <Text style={styles.findingsTitle}>Security Findings</Text>
        
        {severityOrder.map(severity => {
          const findings = groupedFindings[severity];
          if (!findings?.length) return null;

          return (
            <View key={severity} style={styles.severityGroup}>
              <Text style={styles.severityHeader}>
                {severity.toUpperCase()} ({findings.length})
              </Text>
              
              {findings.map(finding => (
                <View key={finding.id} style={styles.findingCard}>
                  <View style={styles.findingHeader}>
                    {getSeverityIcon(finding.severity)}
                    <Text style={styles.findingTitle}>{finding.title}</Text>
                  </View>
                  
                  <Text style={styles.findingDescription}>
                    {finding.description}
                  </Text>
                  
                  <Text style={styles.findingRecommendation}>
                    💡 {finding.recommendation}
                  </Text>

                  {!finding.resolvedAt && (
                    <TouchableOpacity
                      style={styles.resolveButton}
                      onPress={() => resolveSecurityFinding(finding.id)}
                    >
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  if (!FEATURE_FLAGS.SECURITY_MONITORING) {
    return (
      <View style={styles.disabledContainer}>
        <Shield size={48} color="#94A3B8" />
        <Text style={styles.disabledTitle}>Security Monitoring Unavailable</Text>
        <Text style={styles.disabledText}>
          Security monitoring features are not enabled in this environment.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={runNewHealthCheck}
          title="Pull to refresh security status"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Security Center</Text>
        <Text style={styles.subtitle}>
          Monitor your account security and get actionable recommendations
        </Text>
      </View>

      {renderScoreCard()}
      {renderFindings()}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Security checks run automatically every 24 hours. 
          Manual checks can be run anytime for immediate insights.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  disabledContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#F8FAFC',
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  disabledText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 24,
    color: '#64748B',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  scoreDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  noFindings: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noFindingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  noFindingsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  findingsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  findingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  severityGroup: {
    marginBottom: 20,
  },
  severityHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  findingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  findingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  findingDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 8,
  },
  findingRecommendation: {
    fontSize: 14,
    color: '#059669',
    lineHeight: 20,
    marginBottom: 12,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  resolveButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
  },
  footer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
  },
});