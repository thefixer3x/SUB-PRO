import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle as AlertCircle, RefreshCw } from 'lucide-react-native';
import { TYPOGRAPHY, TEXT_COLORS, SPACING } from '@/constants/Typography';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <AlertCircle size={48} color="#EF4444" />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry, but something unexpected happened. Please try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <RefreshCw size={20} color="#ffffff" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: SPACING.xl,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: SPACING['3xl'],
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  title: {
    ...TYPOGRAPHY.cardHeader,
    fontSize: 20,
    color: TEXT_COLORS.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    ...TYPOGRAPHY.small,
    color: TEXT_COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING['2xl'],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  retryText: {
    ...TYPOGRAPHY.button,
    color: TEXT_COLORS.inverse,
  },
});