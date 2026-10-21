# Corporate recognition publication plan

## Verified certificate facts

| Record | Authority | Public reference | Date/status | Public wording boundary |
| --- | --- | --- | --- | --- |
| Startup India recognition | Department for Promotion of Industry and Internal Trade (DPIIT), Government of India | DIPP281524 | Issued 2026-09-06; certificate states validity through 2036-06-30, subject to its terms | Recognition in IT Services and Product Development as stated in the certificate. Not a product approval, grant, tax exemption, endorsement or performance certification. |
| Udyam registration | Ministry of Micro, Small and Medium Enterprises, Government of India | UDYAM-AP-18-0057505 | Registered 2026-09-03; micro enterprise classification for 2026–27; major activity: Services | Registration status only. Do not make procurement eligibility, finance, subsidy, service-quality or product-compliance claims. |
| Certificate of incorporation | Ministry of Corporate Affairs, Government of India | U62011AP2026PTC126691 | Incorporated 2026-07-01 | Corporate identity only. PAN is approved for the dedicated Corporate Information page, but not the primary footer. Do not publish TAN, source-document contact details or regulator-permission implications. |
| GST registration | Goods and Services Tax, Government of India | 37AANCK0043M1ZA | Regular registration issued 2026-07-29 | GST registration only. Do not publish GST certificate annexures, director information or address details. |

## Database publication workflow

1. Maintain the approved public values in `lib/corporate-content.ts` as the single typed public identity source: CIN, GSTIN, PAN (dedicated page only), address, DPIIT and Udyam references.
2. The public website uses that reviewed source for statutory facts, structured data, the dedicated Corporate Information page and the footer. Dynamic grievance-contact information may continue to use the governed public projection.
3. Upload certificate evidence through Corporate Office → Documents only; do not link it publicly.
4. Any future change to an identifier, contact detail or registered office requires source-document review and an explicit public-identity update before it is published.

## Public presentation

1. Use the dedicated Company → Corporate Information page and the corporate footer; do not place recognition claims in a homepage hero or product page.
2. Present two compact recognition records with the approved identifier and a link to the corresponding official verification portal. Show no certificate copies, dates or source-document contact details in the public section.
3. Keep certificate downloads out of the public page: the Udyam PDF includes additional contact details. Store source copies in the Corporate Office document vault and maintain access/audit controls.
4. Add a date-bound review task: annually for Startup India recognition and on any Udyam classification/company-detail change. Update the public wording only through the reviewed public identity source.
5. Use only approved Government of India / Startup India marks under their applicable brand-use terms. This implementation intentionally uses no authority logo or seal.

## Next high-value company actions

- Add an approved public corporate-document projection if Kravia later wants authenticated certificate downloads; preserve audit logging and avoid serving static files from the public asset directory.
- Record these entries in the Corporate Office registrations registry with the certificate PDFs as private evidence, review owner and next-review date.
- Maintain a “company credentials” content record separate from product Trust claims, so no product inherits government-recognition wording.
- Publish GST, MCA and trademark records only after their evidence, public-use approval and exact wording are available.

## Sources reviewed

- DPIIT Certificate of Recognition for KRAVIA PRIVATE LIMITED, supplied 2026-09-06.
- Udyam Registration Certificate for KRAVIA PRIVATE LIMITED, supplied 2026-09-06.
- [Startup India recognition validation](https://www.startupindia.gov.in/content/sih/en/startupgov/validate-startup-recognition.html), reviewed 2026-09-06.
- [Official Udyam Registration Portal](https://udyamregistration.gov.in/), reviewed 2026-09-06.
