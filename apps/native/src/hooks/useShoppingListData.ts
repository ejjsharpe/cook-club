import { getAisleOrder } from "@repo/shared";
import { useMemo } from "react";

// Layout heights for FlashList item types
export const SECTION_HEADER_HEIGHT = 56;
export const ITEM_HEIGHT = 58;

// ShoppingListItem from the API
export interface ShoppingListItem {
  id: number;
  ingredientName: string;
  quantity: number;
  unit: string | null;
  displayText: string;
  isChecked: boolean;
  aisle: string;
  sourceItems: {
    id: number;
    quantity: number | null;
    sourceRecipeId: number | null;
    sourceRecipeName: string | null;
  }[];
}

// FlashList item types - discriminated union
interface SectionHeaderItem {
  type: "section-header";
  id: string;
  title: string;
  isComplete: boolean;
}

interface ShoppingItem {
  type: "item";
  id: string;
  itemId: number;
  ingredientName: string;
  quantity: number;
  unit: string | null;
  displayText: string;
  isChecked: boolean;
  aisle: string;
  sourceItems: {
    id: number;
    quantity: number | null;
    sourceRecipeId: number | null;
    sourceRecipeName: string | null;
  }[];
}

export type ShoppingListFlashItem = SectionHeaderItem | ShoppingItem;

interface UseShoppingListDataProps {
  items: ShoppingListItem[];
}

export const useShoppingListData = ({ items }: UseShoppingListDataProps) => {
  // Flatten items into a single array with section headers interspersed
  const flattenedData: ShoppingListFlashItem[] = useMemo(() => {
    if (!items.length) return [];

    // Group by aisle
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const aisle = item.aisle || "Other";
      const existing = groups.get(aisle) || [];
      existing.push(item);
      groups.set(aisle, existing);
    }

    // Sort by aisle order and flatten with section headers
    const result: ShoppingListFlashItem[] = [];

    const sortedAisles = Array.from(groups.entries()).sort(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a, b) => getAisleOrder(a[0] as any) - getAisleOrder(b[0] as any),
    );

    for (const [aisle, aisleItems] of sortedAisles) {
      const isComplete =
        aisleItems.length > 0 && aisleItems.every((item) => item.isChecked);

      // Add section header
      result.push({
        type: "section-header",
        id: `header-${aisle}`,
        title: aisle,
        isComplete,
      });

      // Add items
      for (const item of aisleItems) {
        result.push({
          type: "item",
          id: `item-${item.id}`,
          itemId: item.id,
          ingredientName: item.ingredientName,
          quantity: item.quantity,
          unit: item.unit,
          displayText: item.displayText,
          isChecked: item.isChecked,
          aisle: item.aisle,
          sourceItems: item.sourceItems,
        });
      }
    }

    return result;
  }, [items]);

  return {
    flattenedData,
    SECTION_HEADER_HEIGHT,
    ITEM_HEIGHT,
  };
};
