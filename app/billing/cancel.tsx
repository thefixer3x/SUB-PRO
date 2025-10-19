import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function BillingCancel() {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 24 
    },
    title: { 
      fontSize: 28, 
      fontWeight: 'bold', 
      marginTop: 24, 
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: { 
      fontSize: 16, 
      color: colors.textSecondary, 
      marginTop: 8, 
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    button: { 
      backgroundColor: colors.primary, 
      paddingHorizontal: 32, 
      paddingVertical: 14, 
      borderRadius: 12, 
      marginTop: 32 
    },
    buttonText: { 
      color: '#FFFFFF', 
      fontSize: 16, 
      fontWeight: '600' 
    },
    secondaryButton: {
      marginTop: 16,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <XCircle size={80} color="#F59E0B" />
        <Text style={styles.title}>Payment Cancelled</Text>
        <Text style={styles.subtitle}>
          No worries! You can upgrade anytime. Your free tier features are still available.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)/index')}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/upgrade')}
        >
          <Text style={styles.secondaryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
