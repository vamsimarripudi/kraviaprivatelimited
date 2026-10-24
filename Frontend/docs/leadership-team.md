# Leadership & Team — current implementation

The public route is /company/leadership. Company/About previews, footer navigation, sitemap discovery and structured Person relationships remain. This is a feature branch and has not been deployed.

## Portraits

Three real images supplied by the owner are assigned in their specified upload order:

- First photo → Jaya Satyanarayana Mangam: public/team/jaya-satyanarayana-mangam.webp.
- Second photo → Vamsi Marripudi: public/team/vamsi-marripudi.webp.
- Third photo → Satish Manohar Pennada: public/team/satish-manohar-pennada.webp.

The images are manually selected head-and-shoulders square crops, resized to 256x256, optimized to WebP and saved without personal image metadata. They appear in 128px circular profile frames on desktop, 104px on mobile and 48px in the Company/About preview. The old neutral default asset remains only as a fallback if a supplied real photo fails to load.

## Approved role and contribution copy

The previously supplied founder/team titles remain. The current work is documented as:
- Vamsi — AI Engineering & Product Architecture, with full-stack development and daily technical direction.
- Satish — Backend Engineering & VidyaLuma AI Tutor Design and Fulfilment.
- Jaya — Documentation & Requirements.

The company remains described as early-stage and pre-revenue with VidyaLuma as its flagship in development. Product sections retain their existing links. Descriptions of engineering work do not imply a completed AI Tutor launch.

## Temporary link policy

The individual photos and names are not externally linked. Individual email, portfolio and LinkedIn actions are withheld, and absent personal links are excluded from the Person structured data. Company/About previews retain internal profile navigation only. No personal phone numbers have been added.

The previously approved company LinkedIn footer link and existing corporate website contacts are unchanged. A VidyaLuma logo can be integrated when approved and supplied.

## Release gates

Run lint, typecheck, full tests, secret scan and production build from Frontend. Verify image bytes, the deployed-look preview, small-screen crop placement, structured data and SEO. No merge or production deployment until approved and the previously identified dependency-security issue is remediated.
