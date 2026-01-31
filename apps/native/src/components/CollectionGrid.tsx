import {
  AnimatedFlashList,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { useCallback, useMemo } from "react";
import { View, RefreshControl } from "react-native";
import Animated, { type AnimatedRef } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { GRID_GAP } from "./CollectionGridCard";
import { CreateCollectionCard } from "./CreateCollectionCard";
import { VSpace } from "./Space";

import type { CollectionWithMetadata } from "@/hooks/useCollectionData";

// Special item type for the create collection button
type CreateCollectionItem = { id: "create"; type: "create" };
export type CollectionListItem = CollectionWithMetadata | CreateCollectionItem;

interface CollectionGridProps {
  collections: CollectionWithMetadata[];
  renderItem: (
    info: ListRenderItemInfo<CollectionListItem>,
  ) => React.ReactElement | null;
  showCreateCard?: boolean;
  onCreateCollection?: () => void;
  isCreatingCollection?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  headerHeight?: number;
  /** Ref attached to the first collection item for position measurement */
  firstItemRef?: AnimatedRef<Animated.View>;
}

export const CollectionGrid = ({
  collections,
  renderItem,
  showCreateCard = false,
  onCreateCollection,
  isCreatingCollection = false,
  isRefreshing = false,
  onRefresh,
  headerHeight = 0,
  firstItemRef,
}: CollectionGridProps) => {
  const theme = UnistylesRuntime.getTheme();
  const insets = UnistylesRuntime.insets;

  // Build list with optional create card
  const collectionsList = useMemo<CollectionListItem[]>(
    () =>
      showCreateCard
        ? [
            { id: "create", type: "create" } as CreateCollectionItem,
            ...collections,
          ]
        : collections,
    [showCreateCard, collections],
  );

  const ListHeader = useMemo(
    () => <VSpace size={insets.top + headerHeight} />,
    [insets.top, headerHeight],
  );

  // Wrap renderItem to handle create card internally and add grid gap styling
  const internalRenderItem = useCallback(
    (info: ListRenderItemInfo<CollectionListItem>) => {
      const { item, index } = info;
      // Determine if this is in the left or right column
      const isLeftColumn = index % 2 === 0;
      const itemStyle = {
        flex: 1,
        marginLeft: isLeftColumn ? 0 : GRID_GAP / 2,
        marginRight: isLeftColumn ? GRID_GAP / 2 : 0,
        marginBottom: GRID_GAP,
      };

      // Handle create collection item
      if ("type" in item && item.type === "create") {
        if (!onCreateCollection) return null;
        return (
          <View style={itemStyle}>
            <CreateCollectionCard
              variant="grid"
              onPress={onCreateCollection}
              disabled={isCreatingCollection}
            />
          </View>
        );
      }
      // Delegate to parent's renderItem for collection items
      const renderedItem = renderItem(info);

      // Wrap the first collection card (accounting for create card offset) with ref for measurement
      const isFirstCollection = showCreateCard ? index === 1 : index === 0;
      if (isFirstCollection && firstItemRef) {
        return (
          <Animated.View
            ref={firstItemRef}
            style={[styles.measureWrapper, itemStyle]}
          >
            {renderedItem}
          </Animated.View>
        );
      }

      return <View style={itemStyle}>{renderedItem}</View>;
    },
    [
      onCreateCollection,
      isCreatingCollection,
      renderItem,
      showCreateCard,
      firstItemRef,
    ],
  );

  return (
    <AnimatedFlashList
      data={collectionsList}
      renderItem={internalRenderItem}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={ListHeader}
      showsVerticalScrollIndicator={false}
      numColumns={2}
      contentContainerStyle={styles.gridContent}
      scrollEventThrottle={20}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create((_theme, rt) => ({
  gridContent: {
    paddingHorizontal: 30,
    paddingBottom: rt.insets.bottom + 48,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  measureWrapper: {
    flex: 1,
  },
}));
