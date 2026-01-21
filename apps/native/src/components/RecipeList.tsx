import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { useCallback } from "react";
import { View, ActivityIndicator, RefreshControl } from "react-native";
import Animated from "react-native-reanimated";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

import { VSpace } from "./Space";

import type { Recipe } from "@/hooks/useRecipeData";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as <T>(
  props: React.ComponentProps<typeof LegendList<T>>,
) => React.ReactElement;

interface RecipeListProps {
  recipes: Recipe[];
  renderItem: (info: LegendListRenderItemProps<Recipe>) => React.ReactElement;
  onLoadMore?: () => void;
  isFetchingMore?: boolean;
  onScroll?: React.ComponentProps<
    typeof AnimatedLegendList<Recipe>
  >["onScroll"];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  headerHeight?: number;
}

export const RecipeList = ({
  recipes,
  renderItem,
  onLoadMore,
  isFetchingMore = false,
  onScroll,
  isRefreshing = false,
  onRefresh,
  headerHeight = 0,
}: RecipeListProps) => {
  const theme = UnistylesRuntime.getTheme();
  const insets = UnistylesRuntime.insets;

  const RecipeSeparator = () => (
    <View style={styles.separatorContainer}>
      <View style={styles.separator} />
    </View>
  );

  const ListHeaderSpacer = useCallback(
    () => <VSpace size={insets.top + headerHeight} />,
    [insets.top, headerHeight],
  );

  const renderFooter = () => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator />
      </View>
    );
  };

  return (
    <AnimatedLegendList
      data={recipes}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderSpacer}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={RecipeSeparator}
      onScroll={onScroll}
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
};

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
