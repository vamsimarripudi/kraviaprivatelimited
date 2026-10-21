"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCorporateDetail({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  return <span className="copy-corporate-detail">
    <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
      {message.endsWith("copied.") ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{message.endsWith("copied.") ? "Copied" : "Copy"}</span>
    </button>
    <span className="sr-only" aria-live="polite">{message}</span>
  </span>;
}
