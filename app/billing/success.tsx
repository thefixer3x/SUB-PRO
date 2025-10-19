import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function BillingSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
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
    sessionId: { 
      fontSize: 12, 
      color: colors.textMuted, 
      marginTop: 16,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <CheckCircle size={80} color="#10B981" />
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>
          Thank you! Your subscription is now active. You now have access to all Pro features.
        </Text>
        {session_id && (
          <Text style={styles.sessionId}>
            Session: {session_id.substring(0, 20)}...
          </Text>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (Platform.OS === 'web') {
              router.replace('/(tabs)/index');
            } else {
              router.replace('/(tabs)/index');
            }
          }}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
