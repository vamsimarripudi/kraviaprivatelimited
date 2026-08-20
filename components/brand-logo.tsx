import Image from "next/image";

export function BrandLogo({ inverse = false, priority = false, animated = false }: { inverse?: boolean; priority?: boolean; animated?: boolean }) {
  const source = animated ? "/brand/kravia-enterprise-v2.svg" : "/brand/kravia-logo.png";

  return <span className={`brand-logo${inverse ? " brand-logo-inverse" : ""}${animated ? " brand-logo-animated" : ""}`}>
    <Image src={source} alt="Kravia Private Limited" width={247} height={251} priority={priority} unoptimized={animated} />
    <span className="brand-logo-copy"><b>KRAVIA</b><small>PRIVATE LIMITED</small></span>
  </span>;
}