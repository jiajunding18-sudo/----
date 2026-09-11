"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";

import {
  createLearningStore,
  type LearningStoreApi,
  type LearningStoreState,
} from "./learning-store";
import type { ProgressCatalog } from "./progress-domain";
import { refreshDerivedClock } from "./derived-clock";

const LearningStoreContext = createContext<LearningStoreApi | null>(null);

export function LearningStoreProvider({
  catalog,
  children,
  contentVersion,
}: {
  readonly catalog: ProgressCatalog;
  readonly children: ReactNode;
  readonly contentVersion: string;
}) {
  const [store] = useState(() =>
    createLearningStore({ catalog, contentVersion }),
  );

  useEffect(() => {
    // A successful write may be newer than the minute tick. Refresh the derived
    // clock, never weaken future-date validation or persist a timer value.
    const unsubscribe=store.subscribe((state,previous)=>{
      if(state.learningState!==previous.learningState) refreshDerivedClock();
    });
    void store.getState().hydrate();
    return unsubscribe;
  }, [store]);

  return (
    <LearningStoreContext.Provider value={store}>
      {children}
    </LearningStoreContext.Provider>
  );
}

export function useLearningStore<Selected>(
  selector: (state: LearningStoreState) => Selected,
): Selected {
  const store = useContext(LearningStoreContext);
  if (!store) {
    throw new Error("useLearningStore 必须在 LearningStoreProvider 内使用。");
  }
  return useStore(store, selector);
}
