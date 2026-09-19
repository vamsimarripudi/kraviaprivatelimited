import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function OfficeEmptyState({
  title,
  text,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  text?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="office-empty-state">
      <span className="office-empty-state-icon"><Icon aria-hidden="true" /></span>
      <div>
        <h3>{title}</h3>
        {text ? <p>{text}</p> : null}
      </div>
      {action ? <div className="office-empty-state-action">{action}</div> : null}
    </div>
  );
}
