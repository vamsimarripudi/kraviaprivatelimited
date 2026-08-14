import Image from "next/image";

export function BrandLogo({ inverse = false, priority = false }: { inverse?: boolean; priority?: boolean }) {
  return <span className={`brand-logo${inverse ? " brand-logo-inverse" : ""}`}>
    <Image src="/brand/kravia-logo.png" alt="Kravia Private Limited" width={247} height={251} priority={priority} />
    <span className="brand-logo-copy"><b>KRAVIA</b><small>PRIVATE LIMITED</small></span>
  </span>;
}
