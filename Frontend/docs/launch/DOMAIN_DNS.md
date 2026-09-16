# Domain and DNS activation

No domain is configured in source code. `NEXT_PUBLIC_SITE_URL` is the only public-site URL contract.

1. Obtain the approved corporate domain and identify registrar, DNS and hosting providers.
2. Choose root or `www` as the canonical HTTPS host; permanently redirect the other host.
3. Add only provider-issued DNS records and record purpose, owner and verification date in the Corporate Office inventory.
4. Verify TLS, HTTP-to-HTTPS redirect, canonical tags, sitemap, robots, Open Graph URLs and no mixed content.
5. Update Supabase Auth Site URL and narrowly scoped redirect URLs after the canonical host works.
6. Enable HSTS only after every intended HTTPS host has been validated.

Never put registrar credentials, API keys or private DNS material in this document.