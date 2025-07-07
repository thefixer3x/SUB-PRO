import React, { useState, useEffect, ReactNode } from 'react';
import { View } from 'react-native';

interface LoadingWrapperProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  minLoadingTime?: number;
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  isLoading,
  skeleton,
  children,
  minLoadingTime = 300,
}) => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    let timer: number;

    if (isLoading) {
      timer = setTimeout(() => {
        setShowSkeleton(true);
      }, minLoadingTime);
    } else {
      setShowSkeleton(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isLoading, minLoadingTime]);

  if (isLoading && showSkeleton) {
    return <View style={{ flex: 1 }}>{skeleton}</View>;
  }

  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }

  return <View style={{ flex: 1 }}>{children}</View>;
};