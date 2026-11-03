import { publicSocialProfiles, type SocialPlatform } from "@/lib/public-links";
import { createArticleShareLinks } from "@/lib/social-sharing";
import { SocialIcon } from "@/components/social-icon";
import styles from "./social-links.module.css";

type SocialLinksProps = {
  labelled?: boolean;
  inverse?: boolean;
  platforms?: readonly SocialPlatform[];
};

/** Plain server-rendered links: no social SDK, tracking script or client hydration. */
export function SocialLinks({ labelled = false, inverse = false, platforms }: SocialLinksProps) {
  const profiles = publicSocialProfiles.filter((profile) => !platforms || platforms.includes(profile.key));
  return <nav className={`${styles.social} ${inverse ? styles.inverse : ""}`} aria-label="Follow KRAVIA on social media">
    <ul className={`${styles.list} ${labelled ? styles.labelled : ""} ${profiles.length === 1 ? styles.single : ""}`}>
      {profiles.map((profile) => <li key={profile.key}><a className={styles.link} data-social-profile={profile.key} href={profile.href} target="_blank" rel="noopener noreferrer" aria-label={`KRAVIA on ${profile.label} (opens in a new tab)`} title={`KRAVIA on ${profile.label} (opens in a new tab)`}><SocialIcon platform={profile.key} className={styles.icon} />{labelled && <span>{profile.label}</span>}</a></li>)}
    </ul>
  </nav>;
}

const sectionCopy = {
  contact: { title: "Connect with KRAVIA.", description: "Follow company news, product updates and our work across our official channels." },
  about: { title: "Follow our journey.", description: "Stay connected with KRAVIA as we build our products, share our work and grow our company." },
  careers: { title: "Stay connected with KRAVIA.", description: "Follow our company on LinkedIn for team and company updates. Use this website for current opportunities and applications." },
} as const;

export function SocialConnect({ context }: { context: keyof typeof sectionCopy }) {
  const copy = sectionCopy[context];
  const titleId = `kravia-social-${context}`;
  return <section className={`shell ${styles.connect}`} aria-labelledby={titleId}>
    <div><p className="eyebrow">OFFICIAL COMPANY CHANNELS</p><h2 id={titleId}>{copy.title}</h2><p className={styles.description}>{copy.description}</p><p className={styles.note}>Social links open in a new tab.</p></div>
    <SocialLinks labelled platforms={context === "careers" ? ["linkedIn"] : undefined} />
  </section>;
}

/** Profile-follow links and article-sharing actions intentionally stay separate. */
export function ArticleShareLinks({ url, title }: { url: string; title: string }) {
  return <nav className={`${styles.social} ${styles.share}`} aria-label="Share this article">
    <p className={styles.shareTitle}>Share this update</p>
    <ul className={styles.list}>{createArticleShareLinks(url, title).map((platform) => <li key={platform.key}><a className={styles.link} href={platform.href} target="_blank" rel="noopener noreferrer" aria-label={`Share this article on ${platform.label} (opens in a new tab)`} title={`Share on ${platform.label} (opens in a new tab)`}><SocialIcon platform={platform.key} className={styles.icon} /><span>{platform.label}</span></a></li>)}</ul>
  </nav>;
}
