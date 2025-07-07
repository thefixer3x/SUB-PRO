import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

// Platform-specific network monitoring
let NetInfo: any;
if (Platform.OS !== 'web') {
  try {
    NetInfo = require('@react-native-community/netinfo');
  } catch {
    // Fallback for expo-network
    NetInfo = require('expo-network');
  }
}

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

interface UseNetworkStatusReturn {
  isOnline: boolean;
  isOffline: boolean;
  networkState: NetworkState;
  showOfflineMessage: () => void;
  hideOfflineMessage: () => void;
  retryConnection: () => Promise<boolean>;
}

export const useNetworkStatus = (): UseNetworkStatusReturn => {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const [messageShown, setMessageShown] = useState(false);

  const checkWebConnection = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          cache: 'no-cache',
        });
        return true;
      } catch {
        return false;
      }
    }
    return navigator.onLine;
  }, []);

  const updateNetworkState = useCallback(async (state?: any) => {
    if (Platform.OS === 'web') {
      const isConnected = navigator.onLine;
      const isReachable = isConnected ? await checkWebConnection() : false;
      
      setNetworkState({
        isConnected,
        isInternetReachable: isReachable,
        type: isConnected ? 'wifi' : null,
      });
    } else if (state) {
      setNetworkState({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? null,
        type: state.type ?? null,
      });
    }
  }, [checkWebConnection]);

  const showOfflineMessage = useCallback(() => {
    if (!messageShown && !networkState.isConnected) {
      showMessage({
        message: 'You are offline',
        description: 'Data may be stale. Pull to refresh when connection is restored.',
        type: 'warning',
        duration: 0, // Persistent until dismissed
        position: 'top',
        floating: true,
        icon: 'warning',
        autoHide: false,
      });
      setMessageShown(true);
    }
  }, [messageShown, networkState.isConnected]);

  const hideOfflineMessage = useCallback(() => {
    if (messageShown && networkState.isConnected) {
      showMessage({
        message: 'Back online',
        description: 'Connection restored',
        type: 'success',
        duration: 3000,
        position: 'top',
        floating: true,
        icon: 'success',
      });
      setMessageShown(false);
    }
  }, [messageShown, networkState.isConnected]);

  const retryConnection = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      const isConnected = await checkWebConnection();
      updateNetworkState();
      return isConnected;
    } else if (NetInfo) {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
      return state.isConnected ?? false;
    }
    return false;
  }, [checkWebConnection, updateNetworkState]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => updateNetworkState();
      const handleOffline = () => updateNetworkState();

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial check
      updateNetworkState();

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else if (NetInfo) {
      const unsubscribe = NetInfo.addEventListener(updateNetworkState);
      
      // Initial state
      NetInfo.fetch().then(updateNetworkState);

      return unsubscribe;
    }
  }, [updateNetworkState]);

  // Auto-show/hide messages based on connection state
  useEffect(() => {
    if (!networkState.isConnected) {
      showOfflineMessage();
    } else {
      hideOfflineMessage();
    }
  }, [networkState.isConnected, showOfflineMessage, hideOfflineMessage]);

  return {
    isOnline: networkState.isConnected,
    isOffline: !networkState.isConnected,
    networkState,
    showOfflineMessage,
    hideOfflineMessage,
    retryConnection,
  };
};