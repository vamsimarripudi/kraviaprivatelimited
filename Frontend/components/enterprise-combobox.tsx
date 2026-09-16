"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Option = { value: string; label: string; meta?: string; disabled?: boolean };

export function EnterpriseCombobox({ label, value, options, onChange, placeholder = "Select…", disabled = false }: {
  label: string;
  value?: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.meta ?? ""} ${option.value}`.toLowerCase().includes(needle));
  }, [options, query]);

  return <div className="enterprise-combobox">
    <span className="enterprise-combobox-label">{label}</span>
    <button type="button" className="enterprise-combobox-trigger" disabled={disabled} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span>{selected ? <><b>{selected.label}</b>{selected.meta ? <small>{selected.meta}</small> : null}</> : <b>{placeholder}</b>}</span><ChevronDown aria-hidden="true" />
    </button>
    {open && !disabled ? <div className="enterprise-combobox-popover">
      <label><Search aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" /></label>
      <div>{filtered.map((option) => <button key={option.value} type="button" disabled={option.disabled} data-selected={option.value === value} onClick={() => { if (option.disabled) return; onChange(option.value); setOpen(false); setQuery(""); }}><span><b>{option.label}</b>{option.meta ? <small>{option.meta}</small> : null}</span>{option.value === value ? <Check aria-hidden="true" /> : null}</button>)}{!filtered.length ? <p>No matching option.</p> : null}</div>
    </div> : null}
  </div>;
}
