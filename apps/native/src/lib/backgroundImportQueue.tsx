import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type { ParsedRecipe } from "@/api/recipe";

export type BackgroundImportMode = "url" | "text" | "image";
export type BackgroundImportStatus = "pending" | "ready" | "failed";

export interface BackgroundImportTask {
  id: string;
  mode: BackgroundImportMode;
  title: string;
  run: () => Promise<ParsedRecipe>;
}

export interface BackgroundImport {
  id: string;
  mode: BackgroundImportMode;
  title: string;
  status: BackgroundImportStatus;
  recipe?: ParsedRecipe;
  error?: string;
}

interface BackgroundImportQueueContextValue {
  imports: BackgroundImport[];
  pendingCount: number;
  readyCount: number;
  startImport: (task: BackgroundImportTask) => void;
  dismissImport: (id: string) => void;
  removeImport: (id: string) => void;
}

const BackgroundImportQueueContext =
  createContext<BackgroundImportQueueContextValue | null>(null);

export function BackgroundImportQueueProvider({ children }: PropsWithChildren) {
  const [imports, setImports] = useState<BackgroundImport[]>([]);

  const startImport = useCallback((task: BackgroundImportTask) => {
    setImports((current) => [
      {
        id: task.id,
        mode: task.mode,
        title: task.title,
        status: "pending",
      },
      ...current.filter((item) => item.id !== task.id),
    ]);

    task
      .run()
      .then((recipe) => {
        setImports((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "ready",
                  title: recipe.data.name,
                  recipe,
                }
              : item,
          ),
        );
      })
      .catch((err: unknown) => {
        setImports((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "failed",
                  error:
                    err instanceof Error
                      ? err.message
                      : "Something went wrong while importing.",
                }
              : item,
          ),
        );
      });
  }, []);

  const dismissImport = useCallback((id: string) => {
    setImports((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      imports,
      pendingCount: imports.filter((item) => item.status === "pending").length,
      readyCount: imports.filter((item) => item.status === "ready").length,
      startImport,
      dismissImport,
      removeImport: dismissImport,
    }),
    [dismissImport, imports, startImport],
  );

  return (
    <BackgroundImportQueueContext.Provider value={value}>
      {children}
    </BackgroundImportQueueContext.Provider>
  );
}

export function useBackgroundImportQueue() {
  const context = useContext(BackgroundImportQueueContext);
  if (!context) {
    throw new Error(
      "useBackgroundImportQueue must be used within BackgroundImportQueueProvider",
    );
  }
  return context;
}

export function createBackgroundImportId(mode: BackgroundImportMode) {
  return `${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
