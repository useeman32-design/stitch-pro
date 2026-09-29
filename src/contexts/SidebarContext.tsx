import React, { createContext, useContext, useMemo, useState } from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed: () => setCollapsed((c) => !c),
      setCollapsed,
    }),
    [collapsed]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * Access the shared desktop sidebar collapse state. Safe to call from any
 * screen (e.g. TopHeader) even when rendered outside the provider (mobile
 * shell) — falls back to a harmless no-op so components don't need to know
 * which shell they're inside.
 */
export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return { collapsed: false, toggleCollapsed: () => {}, setCollapsed: () => {} };
  }
  return ctx;
}
