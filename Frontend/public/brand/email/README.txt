Static high-density KRAVIA email social icons.

Current assets: linkedin.png, x.png, instagram.png, facebook.png.
- 108 x 108 px PNG displayed at 36 x 36 px in email (3x raster density).
- 36px light circular backgrounds with a subtle outline and authentic
  LinkedIn, X, Instagram, and Facebook glyphs in recognizable platform colors.
- PNG is chosen instead of SVG for Gmail/Outlook support and instead of
  animated GIF for consistently crisp, professional mobile rendering.
- All four glyph paths are taken unchanged from
  Frontend/components/social-icon.tsx (Bootstrap Icons, MIT).
  The license is in Frontend/public/brand/social-icons.LICENSE.txt.
- Profile destinations are the owner-supplied official URLs from
  Frontend/lib/public-links.ts. Images never initiate social requests:
  only clicking an email link navigates to a social profile.
- The former GIFs are intentionally retained for already sent email messages;
  new emails reference the PNGs.

Do not substitute AI-generated approximations for social platform glyphs.

2026-11-05: `linkedin.png` and `instagram.png` were repaired after discovering
invalid PNG CRCs in the previous generated assets. The email templates use the
identical verified files as `linkedin-v2.png` and `instagram-v2.png` to bypass
stale broken-image caches. The working X and Facebook files were unchanged.
Run `python3 scripts/validate-email-icons.py` from EmailTemplates/ during CI.
