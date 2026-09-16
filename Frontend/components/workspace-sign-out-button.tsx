"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkspaceKind } from "@/lib/office/workspaces";

export function WorkspaceSignOutButton({ workspace }: { workspace: WorkspaceKind }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/office-auth/sign-out", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace(`/${workspace}/login`);
      router.refresh();
      setPending(false);
    }
  }

  return <button type="button" className="workspace-signout" onClick={signOut} disabled={pending}>
    <LogOut aria-hidden="true" /> {pending ? "Signing out…" : "Sign out"}
  </button>;
}
