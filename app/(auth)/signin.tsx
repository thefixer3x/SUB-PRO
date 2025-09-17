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
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  Shield,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

const SignInPage = () => {
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, authLoading } = useAuth();

  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);

  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800 });
    slideAnim.value = withSpring(0, { damping: 12 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const handleSignIn = async () => {
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { success, error } = await signIn(email, password);

      if (!success) {
        Alert.alert('Sign In Failed', error ?? 'Unable to sign in. Please try again.');
        return;
      }

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Password reset functionality will be implemented soon.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1E293B', '#334155', '#475569']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.formContainer, animatedStyle]}>
            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome Back!</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to your SubTrack Pro account
              </Text>
            </View>

            {/* Sign In Form */}
            <BlurView intensity={20} style={styles.formCard}>
              <View style={styles.formContent}>
                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <Mail size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#94A3B8"
                      value={formData.email}
                      onChangeText={(email) => setFormData({...formData, email})}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor="#94A3B8"
                      value={formData.password}
                      onChangeText={(password) => setFormData({...formData, password})}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color="#64748B" />
                      ) : (
                        <Eye size={20} color="#64748B" />
                      )}
                    </Pressable>
                  </View>
                </View>

                {/* Remember Me & Forgot Password */}
                <View style={styles.optionsRow}>
                  <Pressable
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe && <CheckCircle size={16} color="#10B981" />}
                    </View>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </Pressable>

                  <Pressable onPress={handleForgotPassword}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </Pressable>
                </View>

                {/* Sign In Button */}
                <Pressable
                  style={[styles.signInButton, authLoading && styles.signInButtonLoading]}
                  onPress={handleSignIn}
                  disabled={authLoading}
                >
                  <LinearGradient
                    colors={authLoading ? ['#9CA3AF', '#6B7280'] : ['#3B82F6', '#1D4ED8']}
                    style={styles.signInGradient}
                  >
                    <Text style={styles.signInText}>
                      {authLoading ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Text style={styles.signUpText}>
                  Don't have an account?{' '}
                  <Pressable onPress={() => router.push('/(auth)/signup')}>
                    <Text style={styles.signUpLink}>Sign Up</Text>
                  </Pressable>
                </Text>
              </View>
            </BlurView>

            {/* Security Section */}
            <View style={styles.securitySection}>
              <Shield size={24} color="#10B981" />
              <Text style={styles.securityText}>
                Your data is protected with enterprise-grade security
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    flex: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
  },
  formCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
  },
  formContent: {
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  signInButtonLoading: {
    opacity: 0.7,
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  signUpText: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  securitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  securityText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});

export default SignInPage;
