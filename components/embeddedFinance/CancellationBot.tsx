import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { Bot, X, CheckCircle as CheckCircle, AlertCircle as AlertCircle, Clock, Shield } from 'lucide-react-native';
import { CancellationRequest } from '@/types/embeddedFinance';
import { cancellationBotService } from '@/services/cancellationBot';

interface CancellationBotProps {
  subscriptionId: string;
  userId: string;
  vendorUrl: string;
  subscriptionName: string;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CancellationBot: React.FC<CancellationBotProps> = ({
  subscriptionId,
  userId,
  vendorUrl,
  subscriptionName,
  visible,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'check' | 'credentials' | 'processing' | 'result'>('check');
  const [supportInfo, setSupportInfo] = useState<any>(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [cancellationRequest, setCancellationRequest] = useState<CancellationRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      checkCancellationSupport();
    }
  }, [visible]);

  const checkCancellationSupport = async () => {
    try {
      setLoading(true);
      const support = await cancellationBotService.checkCancellationSupport(vendorUrl);
      setSupportInfo(support);
      
      if (support.supported) {
        setStep('credentials');
      } else {
        Alert.alert(
          'Not Supported',
          'Automated cancellation is not available for this service. Please cancel manually.',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('Failed to check cancellation support:', error);
      Alert.alert('Error', 'Failed to check cancellation support');
    } finally {
      setLoading(false);
    }
  };

  const startCancellation = async () => {
    try {
      setLoading(true);
      setStep('processing');

      const request = await cancellationBotService.requestCancellation({
        subscriptionId,
        userId,
        vendorUrl,
        userCredentials: credentials,
      });

      setCancellationRequest(request);
      pollCancellationStatus(request.id);
    } catch (error) {
      console.error('Failed to start cancellation:', error);
      Alert.alert('Error', 'Failed to start cancellation process');
      setStep('credentials');
    } finally {
      setLoading(false);
    }
  };

  const pollCancellationStatus = async (requestId: string) => {
    const checkStatus = async () => {
      try {
        const status = await cancellationBotService.getCancellationStatus(requestId);
        setCancellationRequest(status);

        if (status.status === 'completed') {
          setStep('result');
          onSuccess?.();
        } else if (status.status === 'failed') {
          setStep('result');
        } else {
          // Continue polling
          setTimeout(checkStatus, 5000);
        }
      } catch (error) {
        console.error('Failed to check cancellation status:', error);
      }
    };

    checkStatus();
  };

  const retryLastCancellation = async () => {
    if (!cancellationRequest) return;

    try {
      setLoading(true);
      setStep('processing');
      const retryRequest = await cancellationBotService.retryCancellation(cancellationRequest.id);
      setCancellationRequest(retryRequest);
      pollCancellationStatus(retryRequest.id);
    } catch (error) {
      console.error('Failed to retry cancellation:', error);
      Alert.alert('Error', 'Failed to retry cancellation');
    } finally {
      setLoading(false);
    }
  };

  const renderCredentialsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Shield size={24} color="#3B82F6" />
        <Text style={styles.stepTitle}>Login Credentials</Text>
      </View>
      
      <Text style={styles.stepDescription}>
        We need your {subscriptionName} account credentials to automate the cancellation process.
        Your credentials are encrypted and only used for this cancellation.
      </Text>

      <View style={styles.credentialsForm}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={credentials.email}
            onChangeText={(text) => setCredentials(prev => ({ ...prev, email: text }))}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={credentials.password}
            onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
            placeholder="Your password"
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.securityNote}>
        <Shield size={16} color="#10B981" />
        <Text style={styles.securityText}>
          Your credentials are encrypted and automatically deleted after cancellation
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, styles.primaryButton]}
        onPress={startCancellation}
        disabled={!credentials.email || !credentials.password || loading}
      >
        <Bot size={20} color="#ffffff" />
        <Text style={styles.actionButtonText}>Start Automated Cancellation</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Bot size={24} color="#3B82F6" />
        <Text style={styles.stepTitle}>Canceling Subscription</Text>
      </View>

      <Text style={styles.stepDescription}>
        Our automation bot is now canceling your {subscriptionName} subscription.
        This typically takes {supportInfo?.estimatedTime || '5-15 minutes'}.
      </Text>

      <View style={styles.processingSteps}>
        <View style={styles.processingStep}>
          <CheckCircle size={20} color="#10B981" />
          <Text style={styles.processingStepText}>Logging into your account</Text>
        </View>
        <View style={styles.processingStep}>
          <Clock size={20} color="#F59E0B" />
          <Text style={styles.processingStepText}>Navigating to cancellation page</Text>
        </View>
        <View style={styles.processingStep}>
          <Clock size={20} color="#94A3B8" />
          <Text style={styles.processingStepText}>Confirming cancellation</Text>
        </View>
      </View>

      <View style={styles.estimateContainer}>
        <Clock size={16} color="#64748B" />
        <Text style={styles.estimateText}>
          Estimated completion: {supportInfo?.estimatedTime || '5-15 minutes'}
        </Text>
      </View>
    </View>
  );

  const renderResultStep = () => {
    const isSuccess = cancellationRequest?.status === 'completed';
    
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          {isSuccess ? (
            <CheckCircle size={24} color="#10B981" />
          ) : (
            <AlertCircle size={24} color="#EF4444" />
          )}
          <Text style={styles.stepTitle}>
            {isSuccess ? 'Cancellation Successful' : 'Cancellation Failed'}
          </Text>
        </View>

        <Text style={styles.stepDescription}>
          {isSuccess 
            ? `Your ${subscriptionName} subscription has been successfully canceled.`
            : `We encountered an issue canceling your ${subscriptionName} subscription.`
          }
        </Text>

        {!isSuccess && cancellationRequest?.errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{cancellationRequest.errorMessage}</Text>
          </View>
        )}

        <View style={styles.resultActions}>
          {isSuccess ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.successButton]}
              onPress={onClose}
            >
              <Text style={styles.actionButtonText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={retryLastCancellation}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onClose}
              >
                <Text style={styles.actionButtonText}>Cancel Manually</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Cancel via Bot</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {step === 'credentials' && renderCredentialsStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'result' && renderResultStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 24,
  },
  credentialsForm: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#047857',
    flex: 1,
  },
  processingSteps: {
    marginBottom: 24,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  processingStepText: {
    fontSize: 16,
    color: '#1E293B',
  },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  estimateText: {
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
});