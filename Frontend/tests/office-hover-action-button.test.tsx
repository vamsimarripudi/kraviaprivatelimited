import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Plus } from "lucide-react";
import { describe, expect, it } from "vitest";
import { HoverActionButton } from "../components/office-hover-action-button";

const css = readFileSync(
  new URL("../components/office-hover-action-button.module.css", import.meta.url), "utf8",
);
const inbox = readFileSync(
  new URL("../components/office-company-inbox.tsx", import.meta.url), "utf8",
);

describe("KRAVIA Office hover actions", () => {
  it("retains an accessible action label and real button semantics", () => {
    const html = renderToStaticMarkup(createElement(HoverActionButton, {
      Icon: Plus, label:"New task",tone:"primary",
    }));
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="New task"');
    expect(html).toContain('title="New task"');
    expect(html).toContain('data-tone="primary"');
    expect(html).toContain("New task");
    expect(html).toContain("<svg");
  });

  it("does not shift sibling layout and reveals text for hover, keyboard and touch", () => {
    expect(css).toContain("position:absolute");
    expect(css).toContain(".action:hover .actionLabel");
    expect(css).toContain(".action:focus-visible .actionLabel");
    expect(css).toContain("@media (hover:none),(pointer:coarse)");
    expect(css).toContain("position:static");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain("min-width:44px");
  });

  it("uses the reusable action without changing task mutation authority", () => {
    expect(inbox).toContain('HoverActionButton Icon={Plus} label="New task"');
    expect(inbox).toContain('"/api/office-tasks"');
    expect(inbox).toContain('assignee_user_id: draft.assignee');
    expect(inbox).toContain('onSubmit={submit}');
  });
});
