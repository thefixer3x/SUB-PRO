import React, { memo, useMemo } from 'react';
import { FlatList, ListRenderItem, ViewStyle } from 'react-native';
import { Subscription } from '@/types/subscription';
import { SubscriptionCard } from './SubscriptionCard';

interface VirtualizedListProps {
  data: Subscription[];
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

const MemoizedSubscriptionCard = memo(SubscriptionCard);

export const VirtualizedSubscriptionList: React.FC<VirtualizedListProps> = memo(({
  data,
  onEndReached,
  onEndReachedThreshold = 0.1,
  style,
  contentContainerStyle,
}) => {
  const renderItem: ListRenderItem<Subscription> = useMemo(
    () => ({ item }) => <MemoizedSubscriptionCard subscription={item} />,
    []
  );

  const keyExtractor = useMemo(
    () => (item: Subscription) => item.id,
    []
  );

  const getItemLayout = useMemo(
    () => (data: any, index: number) => {
      const ITEM_HEIGHT = 220; // More accurate height including margins
      return {
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      };
    },
    []
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={8}
      updateCellsBatchingPeriod={50}
    />
  );
});

VirtualizedSubscriptionList.displayName = 'VirtualizedSubscriptionList';