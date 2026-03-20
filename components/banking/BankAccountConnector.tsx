import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  CreditCard,
  Building,
  Eye,
  EyeOff,
  ArrowRight,
  X
} from 'lucide-react-native';
import { createMCPBankingService, BankAccount } from '@/services/mcpBankingService';

interface Bank {
  id: string;
  name: string;
  logo: string;
  color: [string, string, ...string[]];
  supportedAuth: ('credentials' | 'oauth' | 'openbanking')[];
  isPopular: boolean;
}

interface BankAccountConnectorProps {
  userId: string;
  onAccountConnected?: (account: BankAccount) => void;
  onClose?: () => void;
  visible?: boolean;
}

const IMPLEMENTED_AUTH_METHODS: Bank['supportedAuth'] = ['credentials'];

export const BankAccountConnector: React.FC<BankAccountConnectorProps> = ({
  userId,
  onAccountConnected,
  onClose,
  visible = true
}) => {
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [authMethod, setAuthMethod] = useState<'credentials' | 'oauth' | 'openbanking'>('openbanking');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'select' | 'auth' | 'connecting' | 'success'>('select');
  const [connectedAccount, setConnectedAccount] = useState<BankAccount | null>(null);

  // Reset all state when the modal re-opens
  useEffect(() => {
    if (visible) {
      setSelectedBank(null);
      setAuthMethod('openbanking');
      setCredentials({ username: '', password: '' });
      setShowPassword(false);
      setIsConnecting(false);
      setStep('select');
      setConnectedAccount(null);
    }
  }, [visible]);

  const bankCatalog: Bank[] = [
    {
      id: 'chase',
      name: 'Chase',
      logo: '🏦',
      color: ['#0066b2', '#004c87'],
      supportedAuth: ['openbanking', 'oauth', 'credentials'],
      isPopular: true
    },
    {
      id: 'bofa',
      name: 'Bank of America',
      logo: '🏛️',
      color: ['#e31837', '#b71c1c'],
      supportedAuth: ['openbanking', 'oauth'],
      isPopular: true
    },
    {
      id: 'wells_fargo',
      name: 'Wells Fargo',
      logo: '🏪',
      color: ['#d71921', '#a71717'],
      supportedAuth: ['openbanking', 'credentials'],
      isPopular: true
    },
    {
      id: 'citi',
      name: 'Citibank',
      logo: '🏢',
      color: ['#056dae', '#044a7a'],
      supportedAuth: ['openbanking', 'oauth'],
      isPopular: true
    },
    {
      id: 'capital_one',
      name: 'Capital One',
      logo: '💳',
      color: ['#004879', '#003a5f'],
      supportedAuth: ['openbanking', 'oauth', 'credentials'],
      isPopular: true
    },
    {
      id: 'usbank',
      name: 'US Bank',
      logo: '🏦',
      color: ['#c8102e', '#a00d24'],
      supportedAuth: ['openbanking', 'credentials'],
      isPopular: false
    }
  ];

  const availableBanks: Bank[] = bankCatalog.flatMap((bank) => {
    const supportedAuth = bank.supportedAuth.filter(
      (
        method,
      ): method is Bank['supportedAuth'][number] =>
        IMPLEMENTED_AUTH_METHODS.includes(method),
    );

    return supportedAuth.length ? [{ ...bank, supportedAuth }] : [];
  });

  const handleBankSelection = (bank: Bank) => {
    setSelectedBank(bank);
    setAuthMethod(bank.supportedAuth[0]);
    setStep('auth');
  };

  const handleConnect = async () => {
    if (!selectedBank) return;

    setIsConnecting(true);
    setStep('connecting');

    try {
      const bankingService = createMCPBankingService(userId);

      if (!selectedBank.supportedAuth.includes(authMethod)) {
        Alert.alert(
          'Unavailable',
          'That connection method is not available for this bank yet.',
          [{ text: 'OK', onPress: () => setStep('auth') }],
        );
        return;
      }

      if (authMethod !== 'credentials') {
        // OAuth and Open Banking require a real consent/redirect flow
        // that is not yet implemented.  Surface this to the user instead
        // of silently sending placeholder data to the API.
        Alert.alert(
          'Coming Soon',
          `${authMethod === 'oauth' ? 'OAuth' : 'Open Banking'} integration is under development. Please use bank credentials for now.`,
          [{ text: 'OK', onPress: () => setStep('auth') }],
        );
        return;
      }

      const account = await bankingService.connectBankAccount(selectedBank.id, {
        username: credentials.username,
        // Password is forwarded to the server-side proxy which talks to
        // the MCP API over TLS. Clear local state immediately after.
        password: credentials.password,
      });

      // Clear sensitive credential state as soon as we're done.
      setCredentials({ username: '', password: '' });
      
      setConnectedAccount(account);
      setStep('success');
      onAccountConnected?.(account);

    } catch (error) {
      console.error('Connection failed:', error);
      Alert.alert(
        'Connection Failed',
        'Unable to connect to your bank account. Please check your credentials and try again.',
        [{ text: 'OK', onPress: () => setStep('auth') }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const renderBankSelection = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect Your Bank</Text>
        <Text style={styles.subtitle}>
          Securely connect your bank account to automatically track subscriptions
        </Text>
      </View>

      <View style={styles.securityBanner}>
        <Shield size={24} color="#10B981" />
        <View style={styles.securityText}>
          <Text style={styles.securityTitle}>Bank-Level Security</Text>
          <Text style={styles.securityDescription}>
            256-bit encryption • Read-only access • Data encrypted at rest
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Popular Banks</Text>
      {availableBanks.filter(bank => bank.isPopular).map((bank) => (
        <TouchableOpacity
          key={bank.id}
          style={styles.bankCard}
          onPress={() => handleBankSelection(bank)}
        >
          <LinearGradient
            colors={bank.color}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bankGradient}
          >
            <View style={styles.bankInfo}>
              <Text style={styles.bankLogo}>{bank.logo}</Text>
              <Text style={styles.bankName}>{bank.name}</Text>
            </View>
            <ArrowRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Other Banks</Text>
      {availableBanks.filter(bank => !bank.isPopular).map((bank) => (
        <TouchableOpacity
          key={bank.id}
          style={styles.bankCard}
          onPress={() => handleBankSelection(bank)}
        >
          <View style={styles.otherBankCard}>
            <View style={styles.bankInfo}>
              <Text style={styles.bankLogo}>{bank.logo}</Text>
              <Text style={[styles.bankName, { color: '#1e293b' }]}>{bank.name}</Text>
            </View>
            <ArrowRight size={20} color="#64748b" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderAuthMethod = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect to {selectedBank?.name}</Text>
        <Text style={styles.subtitle}>
          Choose your preferred connection method
        </Text>
      </View>

      <View style={styles.authMethods}>
        {selectedBank?.supportedAuth.includes('openbanking') && (
          <TouchableOpacity
            style={[styles.authMethodCard, authMethod === 'openbanking' && styles.selectedAuth]}
            onPress={() => setAuthMethod('openbanking')}
          >
            <Shield size={24} color={authMethod === 'openbanking' ? '#3B82F6' : '#64748b'} />
            <View style={styles.authMethodInfo}>
              <Text style={styles.authMethodTitle}>Open Banking (Recommended)</Text>
              <Text style={styles.authMethodDescription}>
                Secure, regulated connection through your bank's official API
              </Text>
            </View>
            {authMethod === 'openbanking' && <CheckCircle size={20} color="#3B82F6" />}
          </TouchableOpacity>
        )}

        {selectedBank?.supportedAuth.includes('oauth') && (
          <TouchableOpacity
            style={[styles.authMethodCard, authMethod === 'oauth' && styles.selectedAuth]}
            onPress={() => setAuthMethod('oauth')}
          >
            <Lock size={24} color={authMethod === 'oauth' ? '#3B82F6' : '#64748b'} />
            <View style={styles.authMethodInfo}>
              <Text style={styles.authMethodTitle}>OAuth</Text>
              <Text style={styles.authMethodDescription}>
                Login through your bank's secure website
              </Text>
            </View>
            {authMethod === 'oauth' && <CheckCircle size={20} color="#3B82F6" />}
          </TouchableOpacity>
        )}

        {selectedBank?.supportedAuth.includes('credentials') && (
          <TouchableOpacity
            style={[styles.authMethodCard, authMethod === 'credentials' && styles.selectedAuth]}
            onPress={() => setAuthMethod('credentials')}
          >
            <CreditCard size={24} color={authMethod === 'credentials' ? '#3B82F6' : '#64748b'} />
            <View style={styles.authMethodInfo}>
              <Text style={styles.authMethodTitle}>Bank Credentials</Text>
              <Text style={styles.authMethodDescription}>
                Enter your online banking username and password
              </Text>
            </View>
            {authMethod === 'credentials' && <CheckCircle size={20} color="#3B82F6" />}
          </TouchableOpacity>
        )}
      </View>

      {authMethod === 'credentials' && (
        <View style={styles.credentialsForm}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={credentials.username}
              onChangeText={(text) => setCredentials(prev => ({ ...prev, username: text }))}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={credentials.password}
                onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.connectButton, (!credentials.username || !credentials.password) && authMethod === 'credentials' && styles.disabledButton]}
        onPress={handleConnect}
        disabled={authMethod === 'credentials' && (!credentials.username || !credentials.password)}
      >
        <Text style={styles.connectButtonText}>Connect Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderConnecting = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.connectingTitle}>Connecting to {selectedBank?.name}</Text>
      <Text style={styles.connectingSubtitle}>
        This may take a few moments...
      </Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.centerContent}>
      <CheckCircle size={64} color="#10B981" />
      <Text style={styles.successTitle}>Account Connected!</Text>
      <Text style={styles.successSubtitle}>
        {connectedAccount?.bankName} account ending in {connectedAccount?.accountNumber?.slice(-4) ?? '****'} is now connected.
      </Text>
      <TouchableOpacity style={styles.doneButton} onPress={onClose}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 'select': return renderBankSelection();
      case 'auth': return renderAuthMethod();
      case 'connecting': return renderConnecting();
      case 'success': return renderSuccess();
      default: return renderBankSelection();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 60,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  securityText: {
    marginLeft: 12,
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 2,
  },
  securityDescription: {
    fontSize: 14,
    color: '#15803d',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    marginTop: 8,
  },
  bankCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bankGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  otherBankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogo: {
    fontSize: 24,
    marginRight: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  authMethods: {
    marginBottom: 24,
  },
  authMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  selectedAuth: {
    borderColor: '#3B82F6',
    backgroundColor: '#eff6ff',
  },
  authMethodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  authMethodDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 18,
  },
  credentialsForm: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  connectButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  connectingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  connectingSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
