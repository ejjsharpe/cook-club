import {
  AnimatedFlashList,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { View, ActivityIndicator, RefreshControl } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { VSpace } from "./Space";

import type { Recipe } from "@/hooks/useRecipeData";

const RecipeSeparator = () => (
  <View style={styles.separatorContainer}>
    <View style={styles.separator} />
  </View>
);

export interface RecipeListRef {
  scrollToTop: () => void;
}

interface RecipeListProps {
  recipes: Recipe[];
  renderItem: (info: ListRenderItemInfo<Recipe>) => React.ReactElement;
  onLoadMore?: () => void;
  isFetchingMore?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  headerHeight?: number;
}

export const RecipeList = forwardRef<RecipeListRef, RecipeListProps>(
  (
    {
      recipes,
      renderItem,
      onLoadMore,
      isFetchingMore = false,
      isRefreshing = false,
      onRefresh,
      headerHeight = 0,
    },
    ref,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      },
    }));

    const theme = UnistylesRuntime.getTheme();
    const insets = UnistylesRuntime.insets;

    // Use useMemo to create a stable element instead of a component function
    const ListHeader = useMemo(
      () => <VSpace size={insets.top + headerHeight} />,
      [insets.top, headerHeight],
    );

    const ListFooter = useMemo(() => {
      if (!isFetchingMore) return null;
      return (
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      );
    }, [isFetchingMore]);

    return (
      <AnimatedFlashList
        ref={listRef}
        maintainVisibleContentPosition={{ disabled: true }}
        data={recipes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={RecipeSeparator}
        scrollEventThrottle={32}
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
  },
);

const styles = StyleSheet.create((theme, rt) => ({
  listContent: {
    paddingBottom: rt.insets.bottom + 48,
    flexGrow: 1,
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  separatorContainer: {
    paddingVertical: 8,
    paddingLeft: 134, // 20 (card padding) + 100 (thumbnail) + 14 (gap)
    paddingRight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
