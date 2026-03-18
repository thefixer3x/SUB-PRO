import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Download, Trash2, Shield, FileText, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import { DataExportRequest, DataDeletionRequest } from '@/types/compliance';
import { gdprComplianceService } from '@/services/gdprCompliance';
import { auditLoggingService } from '@/services/auditLogging';
import { FEATURE_FLAGS } from '@/config/compliance';

interface PrivacyCenterProps {
  userId: string;
}

export const PrivacyCenter: React.FC<PrivacyCenterProps> = ({ userId }) => {
  const [exports, setExports] = useState<DataExportRequest[]>([]);
  const [deletionRequest, setDeletionRequest] = useState<DataDeletionRequest | null>(null);
  const [loading, setLoading] = useState({ export: false, deletion: false });

  useEffect(() => {
    if (FEATURE_FLAGS.GDPR_TOOLS) {
      loadUserData();
    }
  }, [userId]);

  const loadUserData = async () => {
    try {
      const [userExports, deletionStatus] = await Promise.all([
        gdprComplianceService.getUserExports(userId),
        gdprComplianceService.getDeletionStatus(userId),
      ]);
      
      setExports(userExports);
      setDeletionRequest(deletionStatus);
    } catch (error) {
      console.error('Failed to load privacy data:', error);
    }
  };

  const handleDataExport = async (exportType: 'full' | 'subscriptions' | 'analytics' | 'payments' = 'full') => {
    try {
      setLoading(prev => ({ ...prev, export: true }));
      
      const exportRequest = await gdprComplianceService.requestDataExport(userId, exportType);
      
      // Log the export request
      await auditLoggingService.logDataExport(userId, exportType, {
        requestId: exportRequest.id,
      });
      
      setExports(prev => [exportRequest, ...prev]);
      
      Alert.alert(
        'Export Requested',
        'Your data export has been requested. You will receive an email with a download link when it\'s ready (usually within 24 hours).',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to request data export:', error);
      Alert.alert('Error', 'Failed to request data export. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  const handleDataDeletion = async () => {
    Alert.alert(
      'Delete My Data',
      'This will permanently delete all your account data including subscriptions, analytics, and payment history. This action cannot be undone.\n\nA confirmation email will be sent to verify this request.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(prev => ({ ...prev, deletion: true }));
              
              const deletion = await gdprComplianceService.requestDataDeletion(userId);
              
              // Log the deletion request
              await auditLoggingService.logDataDeletion(userId, 'data_deletion_requested', {
                requestId: deletion.id,
              });
              
              setDeletionRequest(deletion);
              
              Alert.alert(
                'Deletion Requested',
                'A confirmation email has been sent to verify your data deletion request. You have 24 hours to confirm.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Failed to request data deletion:', error);
              Alert.alert('Error', 'Failed to request data deletion. Please try again.');
            } finally {
              setLoading(prev => ({ ...prev, deletion: false }));
            }
          },
        },
      ]
    );
  };

  const handleCancelDeletion = async () => {
    try {
      await gdprComplianceService.cancelDataDeletion(userId);
      
      // Log the cancellation
      await auditLoggingService.logDataDeletion(userId, 'data_deletion_cancelled', {
        requestId: deletionRequest?.id,
      });
      
      setDeletionRequest(null);
      
      Alert.alert(
        'Deletion Cancelled',
        'Your data deletion request has been cancelled.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to cancel data deletion:', error);
      Alert.alert('Error', 'Failed to cancel data deletion. Please try again.');
    }
  };

  const getExportStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color="#10B981" />;
      case 'failed':
        return <AlertCircle size={16} color="#EF4444" />;
      case 'processing':
        return <Clock size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#64748B" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const privacyPolicy = gdprComplianceService.getPrivacyPolicy();

  if (!FEATURE_FLAGS.GDPR_TOOLS) {
    return (
      <View style={styles.disabledContainer}>
        <Shield size={48} color="#94A3B8" />
        <Text style={styles.disabledTitle}>Privacy Features Unavailable</Text>
        <Text style={styles.disabledText}>
          GDPR compliance tools are not enabled in this environment.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Shield size={24} color="#3B82F6" />
        <Text style={styles.title}>Privacy & Data Control</Text>
      </View>

      <Text style={styles.description}>
        Control your personal data and understand how we use it. 
        All actions are logged for transparency and compliance.
      </Text>

      {/* Data Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export My Data</Text>
        <Text style={styles.sectionDescription}>
          Download a copy of all your data in JSON format. This includes your account information, 
          subscriptions, analytics, and payment history.
        </Text>

        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => handleDataExport('full')}
            disabled={loading.export}
          >
            <Download size={20} color="#3B82F6" />
            <Text style={styles.exportButtonText}>Export All Data</Text>
          </TouchableOpacity>

          <View style={styles.exportOptions}>
            <TouchableOpacity
              style={styles.exportOptionButton}
              onPress={() => handleDataExport('subscriptions')}
              disabled={loading.export}
            >
              <Text style={styles.exportOptionText}>Subscriptions Only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportOptionButton}
              onPress={() => handleDataExport('analytics')}
              disabled={loading.export}
            >
              <Text style={styles.exportOptionText}>Analytics Only</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Exports */}
        {exports.length > 0 && (
          <View style={styles.recentExports}>
            <Text style={styles.recentExportsTitle}>Recent Exports</Text>
            {exports.slice(0, 3).map((exportReq) => (
              <View key={exportReq.id} style={styles.exportItem}>
                {getExportStatusIcon(exportReq.status)}
                <View style={styles.exportItemInfo}>
                  <Text style={styles.exportItemTitle}>
                    {exportReq.exportType === 'full' ? 'Complete Data Export' : `${exportReq.exportType} Export`}
                  </Text>
                  <Text style={styles.exportItemDate}>
                    {new Date(exportReq.requestedAt).toLocaleDateString()} • {formatFileSize(exportReq.fileSize)}
                  </Text>
                </View>
                {exportReq.status === 'completed' && exportReq.downloadUrl && (
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => {
                      // Open download URL
                      console.log('Download:', exportReq.downloadUrl);
                    }}
                  >
                    <Download size={16} color="#3B82F6" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Data Deletion Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delete My Data</Text>
        <Text style={styles.sectionDescription}>
          Permanently delete all your account data. This action cannot be undone and you will lose 
          access to all subscription tracking and analytics.
        </Text>

        {deletionRequest ? (
          <View style={styles.deletionStatus}>
            <View style={styles.deletionStatusHeader}>
              <AlertCircle size={20} color="#F59E0B" />
              <Text style={styles.deletionStatusTitle}>Deletion Request Pending</Text>
            </View>
            <Text style={styles.deletionStatusText}>
              Confirmation email sent. You have until{' '}
              {new Date(deletionRequest.confirmationExpiresAt).toLocaleString()} to confirm.
            </Text>
            <TouchableOpacity
              style={styles.cancelDeletionButton}
              onPress={handleCancelDeletion}
            >
              <Text style={styles.cancelDeletionText}>Cancel Deletion Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDataDeletion}
            disabled={loading.deletion}
          >
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Request Data Deletion</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Privacy Policy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How We Handle Your Data</Text>
        
        <View style={styles.policySection}>
          <Text style={styles.policySubtitle}>Data We Collect</Text>
          {privacyPolicy.dataCollected.map((item, index) => (
            <Text key={index} style={styles.policyItem}>• {item}</Text>
          ))}
        </View>

        <View style={styles.policySection}>
          <Text style={styles.policySubtitle}>How We Use Your Data</Text>
          {privacyPolicy.dataUsage.map((item, index) => (
            <Text key={index} style={styles.policyItem}>• {item}</Text>
          ))}
        </View>

        <View style={styles.policySection}>
          <Text style={styles.policySubtitle}>Data Retention</Text>
          {privacyPolicy.dataRetention.map((item, index) => (
            <Text key={index} style={styles.policyItem}>• {item}</Text>
          ))}
        </View>

        <View style={styles.policySection}>
          <Text style={styles.policySubtitle}>Your Rights</Text>
          {privacyPolicy.userRights.map((item, index) => (
            <Text key={index} style={styles.policyItem}>• {item}</Text>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <FileText size={16} color="#64748B" />
        <Text style={styles.footerText}>
          All privacy actions are logged for compliance and transparency. 
          Contact support if you have questions about your data.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  disabledContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 12,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },
  exportButtons: {
    marginBottom: 24,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    marginBottom: 12,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  exportOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  exportOptionButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  exportOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  recentExports: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  recentExportsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  exportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  exportItemInfo: {
    flex: 1,
  },
  exportItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  exportItemDate: {
    fontSize: 12,
    color: '#64748B',
  },
  downloadButton: {
    padding: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  deletionStatus: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  deletionStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  deletionStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  deletionStatusText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 12,
  },
  cancelDeletionButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelDeletionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  policySection: {
    marginBottom: 20,
  },
  policySubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  policyItem: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});