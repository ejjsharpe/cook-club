import { useCallback, useMemo } from "react";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";

import { storage } from "./mmkv";

const SELECTED_SHOPPING_LIST_ID_KEY = "selected_shopping_list_id";
const SELECTED_SHOPPING_LIST_NAME_KEY = "selected_shopping_list_name";

export function getSelectedShoppingList(): { id: number; name: string } | null {
  const id = storage.getNumber(SELECTED_SHOPPING_LIST_ID_KEY);
  const name = storage.getString(SELECTED_SHOPPING_LIST_NAME_KEY);
  if (id === undefined || name === undefined) return null;
  return { id, name };
}

export function setSelectedShoppingList(listId: number, listName: string): void {
  storage.set(SELECTED_SHOPPING_LIST_ID_KEY, listId);
  storage.set(SELECTED_SHOPPING_LIST_NAME_KEY, listName);
}

export function clearSelectedShoppingList(): void {
  storage.delete(SELECTED_SHOPPING_LIST_ID_KEY);
  storage.delete(SELECTED_SHOPPING_LIST_NAME_KEY);
}

/** Reactive hook for selected shopping list - auto-updates when MMKV changes */
export function useSelectedShoppingList() {
  const [id, setId] = useMMKVNumber(SELECTED_SHOPPING_LIST_ID_KEY, storage);
  const [name, setName] = useMMKVString(SELECTED_SHOPPING_LIST_NAME_KEY, storage);

  const selectedList = useMemo(() => {
    if (id === undefined || name === undefined) return null;
    return { id, name };
  }, [id, name]);

  const setSelectedList = useCallback(
    (listId: number, listName: string) => {
      setId(listId);
      setName(listName);
    },
    [setId, setName],
  );

  const clearSelectedList = useCallback(() => {
    setId(undefined);
    setName(undefined);
  }, [setId, setName]);

  return { selectedList, setSelectedList, clearSelectedList };
}
