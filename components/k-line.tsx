export function KLine({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`k-line ${className}`}><i /><i /><i /></span>;
}
