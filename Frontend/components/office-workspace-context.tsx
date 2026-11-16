"use client";

import { createContext, useContext } from "react";
import type { OfficeIdentity } from "@/lib/office/auth-server";

type OfficeWorkspaceContextValue = {
  identity: OfficeIdentity;
  permissions: readonly string[];
  /** Client-side presentation filter; real authorization remains on the API. */
  visibleSections: readonly string[];
  departmentNavigationStatus: "loading" | "ready" | "unavailable";
  departmentNavigationError: string | null;
};

const OfficeWorkspaceContext = createContext<OfficeWorkspaceContextValue | null>(null);

export function OfficeWorkspaceProvider({
  identity,
  permissions,
  visibleSections,
  departmentNavigationStatus,
  departmentNavigationError,
  children,
}: OfficeWorkspaceContextValue & { children: React.ReactNode }) {
  return (
    <OfficeWorkspaceContext.Provider value={{ identity, permissions, visibleSections,
        departmentNavigationStatus, departmentNavigationError }}>
      {children}
    </OfficeWorkspaceContext.Provider>
  );
}

export function useOfficeWorkspace() {
  const value = useContext(OfficeWorkspaceContext);
  if (!value) throw new Error("KRAVIA Office workspace context is unavailable");
  return value;
}
