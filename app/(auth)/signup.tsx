import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  Shield,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PoweredByLanOnasis } from '@/components/branding/PoweredByLanOnasis';
import { useAuth } from '@/contexts/AuthContext';
import { PASSWORD_REQUIREMENTS } from '@/constants/auth';
import { validatePassword } from '@/utils/auth/validatePassword';

const SignUpPage = () => {
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signUp: signUpWithEmail, authLoading } = useAuth();

  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);

  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, { damping: 15 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const handleSignUp = async () => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert('Weak Password', passwordValidation.message ?? PASSWORD_REQUIREMENTS);
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Error', 'Please accept the terms and conditions');
      return;
    }

    try {
      const { success, error, requiresEmailConfirmation } = await signUpWithEmail({
        email,
        password,
        fullName: name,
      });

      if (!success) {
        const isNetworkIssue = error?.toLowerCase().includes('network');
        Alert.alert(
          isNetworkIssue ? 'Network Error' : 'Sign Up Failed',
          isNetworkIssue
            ? 'We were unable to connect. Please check your internet connection and try again.'
            : error ?? 'Unable to create your account. Please try again.',
        );
        return;
      }

      if (requiresEmailConfirmation) {
        Alert.alert(
          'Confirm Your Email',
          `We sent a confirmation link to ${email}. Please verify your email before signing in.`,
          [{ text: 'OK', onPress: () => router.replace('/(auth)/signin') }],
        );
        return;
      }

      Alert.alert('Success!', 'Account created successfully. Welcome to SubTrack Pro!');
      router.replace('/(tabs)');
    } catch (error) {
      const isNetworkIssue = error instanceof Error && error.message.toLowerCase().includes('network');
      const message = isNetworkIssue
        ? 'We were unable to connect. Please check your internet connection and try again.'
        : 'Failed to create your account. Please try again.';
      Alert.alert(isNetworkIssue ? 'Network Error' : 'Sign Up Failed', message);
    }
  };

  const benefits = [
    'Track unlimited subscriptions',
    'AI-powered spending insights',
    'Smart renewal notifications',
    'Secure data encryption',
    'Export financial reports',
    'Cancel services with one tap',
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        
        <Text style={styles.headerTitle}>Join SubTrack Pro</Text>
        <Text style={styles.headerSubtitle}>
          Start your 14-day free trial today
        </Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, animatedStyle]}>
          {/* Benefits Preview */}
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>What you'll get:</Text>
            <View style={styles.benefitsGrid}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Sign Up Form */}
          <BlurView intensity={20} style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Shield size={32} color="#667eea" />
              <Text style={styles.formTitle}>Create Your Account</Text>
              <Text style={styles.formSubtitle}>
                Join 50,000+ users saving money every month
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <User size={20} color="#6B7280" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.name}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, name: text }))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Mail size={20} color="#6B7280" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#9CA3AF"
                  value={formData.email}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, email: text }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color="#6B7280" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.password}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, password: text }))}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#6B7280" />
                  ) : (
                    <Eye size={20} color="#6B7280" />
                  )}
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color="#6B7280" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.confirmPassword}
                  onChangeText={(text: string) => setFormData(prev => ({ ...prev, confirmPassword: text }))}
                  secureTextEntry={!showConfirmPassword}
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#6B7280" />
                  ) : (
                    <Eye size={20} color="#6B7280" />
                  )}
                </Pressable>
              </View>

              <Pressable
                style={styles.termsContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                  {acceptedTerms && <CheckCircle size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </Pressable>

              <Pressable
                testID="sign-up-submit"
                style={[styles.signUpButton, authLoading && styles.signUpButtonDisabled]}
                onPress={handleSignUp}
                disabled={authLoading}
              >
                <LinearGradient
                  colors={authLoading ? ['#9CA3AF', '#6B7280'] : ['#F59E0B', '#F97316']}
                  style={styles.signUpGradient}
                >
                  <Text style={styles.signUpText}>
                    {authLoading ? 'Creating Account...' : 'Start Free Trial'}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Text style={styles.signInText}>
                Already have an account?{' '}
                <Pressable onPress={() => router.push('/(auth)/signin')}>
                  <Text style={styles.signInLink}>Sign In</Text>
                </Pressable>
              </Text>
            </View>
          </BlurView>

          {/* Trust Indicators */}
          <View style={styles.trustSection}>
            <Text style={styles.trustTitle}>Trusted & Secure</Text>
            <View style={styles.trustIndicators}>
              <View style={styles.trustItem}>
                <Shield size={24} color="#10B981" />
                <Text style={styles.trustText}>Bank-level encryption</Text>
              </View>
              <View style={styles.trustItem}>
                <CheckCircle size={24} color="#10B981" />
                <Text style={styles.trustText}>SOC 2 compliant</Text>
              </View>
            </View>
            
            {/* Development Partner Credit */}
            <View style={styles.partnerCreditContainer}>
              <PoweredByLanOnasis variant="minimal" />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    padding: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  benefitsSection: {
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitsGrid: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  benefitText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 18,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingLeft: 52,
    paddingRight: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  termsText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  termsLink: {
    color: '#667eea',
    fontWeight: '500',
  },
  signUpButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signInText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  signInLink: {
    color: '#667eea',
    fontWeight: '500',
  },
  trustSection: {
    alignItems: 'center',
  },
  trustTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  trustIndicators: {
    flexDirection: 'row',
    gap: 32,
  },
  trustItem: {
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  partnerCreditContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
});

export default SignUpPage;
