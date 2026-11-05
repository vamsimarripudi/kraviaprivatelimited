export function OfficeAmbientField({ variant = "workspace" }: { variant?: "auth" | "workspace" }) {
  return (
    <div className={`ox4-ambient ox4-ambient--${variant}`} aria-hidden="true">
      <span className="ox4-ambient-orbit ox4-ambient-orbit--one" />
      <span className="ox4-ambient-orbit ox4-ambient-orbit--two" />
      <span className="ox4-ambient-beam ox4-ambient-beam--one" />
      <span className="ox4-ambient-beam ox4-ambient-beam--two" />
      <span className="ox4-ambient-node ox4-ambient-node--one" />
      <span className="ox4-ambient-node ox4-ambient-node--two" />
      <span className="ox4-ambient-node ox4-ambient-node--three" />
    </div>
  );
}
