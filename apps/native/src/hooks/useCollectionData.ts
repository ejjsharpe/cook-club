import { useMemo } from "react";

import { useGetUserCollectionsWithMetadata } from "@/api/collection";

export type CollectionWithMetadata = NonNullable<
  ReturnType<typeof useGetUserCollectionsWithMetadata>["data"]
>[number];

interface UseCollectionDataOptions {
  search?: string;
}

export const useCollectionData = ({
  search,
}: UseCollectionDataOptions = {}) => {
  const {
    data: collectionsData,
    isPending,
    refetch,
    error,
  } = useGetUserCollectionsWithMetadata({
    search,
  });

  const collections = useMemo(() => {
    return collectionsData ?? [];
  }, [collectionsData]);

  return {
    collections,
    isPending,
    error,
    refetch,
  };
};
