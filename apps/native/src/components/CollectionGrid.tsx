import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { useCallback, useMemo } from "react";
import { RefreshControl } from "react-native";
import Animated, { type AnimatedRef } from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { GRID_GAP } from "./CollectionGridCard";
import { CreateCollectionCard } from "./CreateCollectionCard";
import { VSpace } from "./Space";

import type { CollectionWithMetadata } from "@/hooks/useCollectionData";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as <T>(
  props: React.ComponentProps<typeof LegendList<T>>,
) => React.ReactElement;

// Special item type for the create collection button
type CreateCollectionItem = { id: "create"; type: "create" };
export type CollectionListItem = CollectionWithMetadata | CreateCollectionItem;

interface CollectionGridProps {
  collections: CollectionWithMetadata[];
  renderItem: (
    info: LegendListRenderItemProps<CollectionListItem>,
  ) => React.ReactElement | null;
  showCreateCard?: boolean;
  onCreateCollection?: () => void;
  isCreatingCollection?: boolean;
  onScroll?: React.ComponentProps<
    typeof AnimatedLegendList<CollectionListItem>
  >["onScroll"];
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
  onScroll,
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

  const ListHeaderSpacer = useCallback(
    () => <VSpace size={insets.top + headerHeight} />,
    [insets.top, headerHeight],
  );

  // Wrap renderItem to handle create card internally
  const internalRenderItem = useCallback(
    (info: LegendListRenderItemProps<CollectionListItem>) => {
      const { item, index } = info;
      // Handle create collection item
      if ("type" in item && item.type === "create") {
        if (!onCreateCollection) return null;
        return (
          <CreateCollectionCard
            variant="grid"
            onPress={onCreateCollection}
            disabled={isCreatingCollection}
          />
        );
      }
      // Delegate to parent's renderItem for collection items
      const renderedItem = renderItem(info);

      // Wrap the first collection card (accounting for create card offset) with ref for measurement
      const isFirstCollection = showCreateCard ? index === 1 : index === 0;
      if (isFirstCollection && firstItemRef) {
        return (
          <Animated.View ref={firstItemRef} style={styles.measureWrapper}>
            {renderedItem}
          </Animated.View>
        );
      }

      return renderedItem;
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
    <AnimatedLegendList
      data={collectionsList}
      renderItem={internalRenderItem}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={ListHeaderSpacer}
      showsVerticalScrollIndicator={false}
      numColumns={2}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={styles.gridRow as any}
      onScroll={onScroll}
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
