import clsx from "clsx";
import { useId, type ReactNode } from "react";

type FormFieldProps = {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (inputProps: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
};

export function FormField({ label, description, error, required, className, children }: FormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return <div className={clsx("ui-field", error && "ui-field-invalid", className)}>
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
    {description && <p id={descriptionId} className="ui-field-description">{description}</p>}
    {error && <p id={errorId} className="ui-field-error" role="alert">{error}</p>}
  </div>;
}
