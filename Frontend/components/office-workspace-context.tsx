"use client";

import { createContext, useContext } from "react";
import type { OfficeIdentity } from "@/lib/office/auth-server";

type OfficeWorkspaceContextValue = {
  identity: OfficeIdentity;
  permissions: readonly string[];
};

const OfficeWorkspaceContext = createContext<OfficeWorkspaceContextValue | null>(null);

export function OfficeWorkspaceProvider({
  identity,
  permissions,
  children,
}: OfficeWorkspaceContextValue & { children: React.ReactNode }) {
  return (
    <OfficeWorkspaceContext.Provider value={{ identity, permissions }}>
      {children}
    </OfficeWorkspaceContext.Provider>
  );
}

export function useOfficeWorkspace() {
  const value = useContext(OfficeWorkspaceContext);
  if (!value) throw new Error("KRAVIA Office workspace context is unavailable");
  return value;
}
