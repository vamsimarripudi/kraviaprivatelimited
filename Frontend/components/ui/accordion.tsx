"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export type AccordionEntry = { title: string; content: ReactNode };

export function Accordion({ entries, label }: { entries: readonly AccordionEntry[]; label: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return <div className="ui-accordion" aria-label={label}>
    {entries.map((entry, index) => {
      const open = openIndex === index;
      const triggerId = `${baseId}-${index}-trigger`;
      const panelId = `${baseId}-${index}-panel`;
      return <section className="ui-accordion-item" key={entry.title}>
        <h3>
          <button id={triggerId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? null : index)}>
            <span>{entry.title}</span><ChevronDown aria-hidden="true" />
          </button>
        </h3>
        <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!open} className="ui-accordion-panel">{entry.content}</div>
      </section>;
    })}
  </div>;
}
