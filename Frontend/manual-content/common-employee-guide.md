# KRAVIA OFFICE
## Common employee user manual
### From invitation to everyday work, security, approvals and offboarding

**Edition:** 1.0 | **Audit reference:** GitHub `vamsimarripudi/kraviaprivatelimited`, `main` at `86806c876c5483c18e68c51749e8b2fa7297e60e` (13 November 2026)  
**Audience:** Invited users, employees, directors, authorized advisers, managers, interns and trainees  
**Read this first:** This is a **source-code-audited guide**, not a claim that all functions have passed live production verification. Buttons and records may be hidden by assigned permissions, effective dates, deployment configuration, or approval state. No emails are sent by this manual.

> **Rule:** A job title is not a permission. Your Office role, the active scoped access profile, department authority, multifactor authentication (MFA), and server-side approvals determine what you can actually do.

## 01 | Quick orientation: which site, which identity?

**Official company sign-in:** `https://www.kraviaprivatelimited.com/office/login`. The site’s sign-in component specifically instructs staff to use the `www` company domain. Check the lock icon and exact address before entering credentials. **Do not** treat `/join` as an employee-registration route: `/join` is for public resources. Office invitation-only registration uses `/office/register?invite=...`, issued privately by an authorized administrator.

- **Office personal dashboard:** `/office/dashboard` — start here when you have Office access.
- **Your verified employment profile:** `/office/my-role` — role, onboarding evidence, personal details and verified payment record.
- **Finance workspace:** `/finance/dashboard` — only with an authorized Finance, CA, auditor, director or owner role and applicable capabilities. The Finance-only identity may not have an Office dashboard unless Office access is separately granted.
- **Account and security:** `/office/settings`; Finance users may have `/finance/settings`.
- **Personal requests and approvals:** `/office/requests` and `/office/approvals`. A title alone does not let you approve a request.

**What Office does:** It is the private company workspace for assigned work, workforce intake, workflow decisions, documents, HR, engineering, customers, Finance, governance and operations. **What it does not do by itself:** A registration does not confirm employment, a submitted request does not grant authority, a draft salary slip does not prove bank payment, and an uploaded document is not automatically a valid signature.

## 02 | Important differences: invitation, identity, employment and authority

| Item | Meaning | Who controls it |
| --- | --- | --- |
| Private invitation | Permission to create an Office identity, time-limited and assigned to an email | Owner / authorized access administrator |
| Registered account | Credentials were created, email verification completed | The invited person; first-party identity service |
| MFA-approved session | Password plus approved second factor, and device approval when required | The employee and controlled security reviewers |
| Active workspace | Office workspace status is `ACTIVE`; processing screens may appear before this | Access governance |
| Employee onboarding | HR/personal forms, certificates, policy acknowledgement, signed appointment evidence and independent reviews | Employee, HR, Finance, authorized reviewer |
| Role package | Primary job, additional duties, scoped access and checklist version | Owner / accepted department head within scope |
| Permanent employee ID | Issued only after employment and required evidence are independently verified | HR and authorized reviewers; guarded database workflow |
| Payment | Financial ledger, payslip, reviewed settlement and bank evidence | Independent Payroll / Finance controls |

**Typical account states:** `INVITED` means the private invitation still needs acceptance; `REQUESTED` or `PENDING` means review/activation is outstanding; `ACTIVE` means identity/workspace admission; `SUSPENDED` or `REVOKED` means access is not permitted. A user may be registered but still shown `/office/processing` while waiting for workspace activation. Never use a colleague’s account as a workaround.

## 03 | Before your first sign-in: new invitee checklist

1. Confirm the invitation came from KRAVIA’s authorized internal onboarding process. Do not follow unsolicited or forwarded links.
2. Keep your **registered corporate email** accessible. Your invitation and OTP flows are tied to that identity. A company administrator must resolve incorrect addresses.
3. Open the **private invitation link** supplied to you. Its destination is `/office/register?invite=...`. Do not type a random token or use the public `/office/register` page.
4. Check the displayed **full name, corporate email, and assigned role**. Your invitation may carry an initial department/role, but that does not replace a signed appointment or role-package approval.
5. Enter your full name, then create and confirm a password. Registration validation requires **at least 12 characters, uppercase, lowercase, digit and symbol**. Use a unique password and a trusted password manager.
6. Select **Complete registration**. Complete the **six-digit corporate-email verification** when prompted (the registration code is shown as expiring after 10 minutes). If necessary use **Send another code**, then verify.
7. Continue to **KRAVIA Authenticator** activation; registration itself is not full Office access.
8. Wait for required **phone authorization, new-browser trust and workspace activation**. If the account shows `Processing`, do not create a new registration.
9. If the invitation is invalid, expired, revoked or already used, ask the person who invited you to reissue it. Do not share invitation tokens in tickets, chats or screenshots.
10. After successful entry, immediately open **My roles & onboarding** to begin the employee intake checklist. Your appointment and signed documents remain independent.

**Already employed and previously registered?** Do not re-register. Use `/office/login` with the existing credentials and your approved second factor. **External CA, CS (Company Secretary), legal or audit adviser?** Use only the invitation and scoped role assigned to your professional identity; do not request a normal employee record unless HR has explicitly created one.

## 04 | Install and activate KRAVIA Authenticator

**Instructions:** `/office/authenticator`. **Official Android listing:** `https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator`.

1. On an approved Android device, open the Google Play listing shown on the Authenticator page. Do not install APKs sent through email or chat.
2. Secure your phone with a lock screen, biometric protection and automatic date/time.
3. Open KRAVIA Authenticator. Follow the app’s corporate sign-in process and use the six-digit code sent to the registered email for **device activation**.
4. Wait for the verified Owner or authorized administrator to approve **that precise phone**. Device enrollment is protected; the website is not expected to expose a secret QR/setup seed for enrollment.
5. Once active, obtain the current locally generated six-digit code in the app. Return to `/office/login` to complete browser sign-in.
6. An iPhone distribution link appears only if KRAVIA has configured an approved Apple channel. The Android Google Play link is not an iOS installer.

**Lost/replaced device:** Stop using the old device; request a governed **Reset MFA** from Office administration. Never copy an old device secret, request another person’s code, or leave the office signed in on a shared device.

## 05 | Sign in, email OTP, QR approval and new-device checks

1. Go to `/office/login`. Enter corporate email and password and select **Sign in to KRAVIA Office**. Finance-authorized users may also have `/finance/login`.
2. When prompted **Verify your identity**, enter the latest six-digit Authenticator code and select **Verify and continue**. Watch the timer; use a new code after expiry.
3. **Only if enabled for your account:** select **Send a code to my corporate email instead**. Enter the code on the **Check your corporate email** screen and select **Verify email and enter Office**. The source UI specifies a ten-minute code and a resend option after 60 seconds. An option appearing in code does not prove your mail provider will deliver it in production.
4. **Alternative:** select **Use Authenticator approval instead**. Scan the one-time browser QR using the trusted KRAVIA Authenticator phone, verify the browser details and explicitly **Accept** or **Reject** on the phone. Do not scan the QR in a third-party app. A QR can expire; restart the request if needed.
5. **New browser or device:** the screen may say **Approve this browser from your email**. Review the registered-email trust decision; only the original browser can complete that pending request. Never approve an unfamiliar device.
6. After verified MFA and approved device policy, your authorized workspace opens. If it shows `/office/processing`, the workspace has not been activated; contact an administrator.
7. To end a session, use the **Sign out** icon in the Office rail. Never simply close a tab on a borrowed computer.

**Password recovery:** `/office/recover`. The primary recovery screen directs staff to an authorized Office administrator for a private controlled link; `/office/reset-password` works only with a valid admin-issued token. The Access administration UI also contains an **Email password reset** control, but delivery depends on actual mail service readiness. Founder recovery is separate and not delegated through routine password support. Never paste reset links into public tickets.

## 06 | Navigate the Office: desktop and mobile

**Desktop layout:** The floating icon rail sits at the left. Select a category (My work, People, Engineering, Commercial, Operations, Finance, Governance, Administration). An expanded secondary menu shows **group headings** and the **actual pages available to your identity**. Choose the page label; the top **breadcrumb** returns to the dashboard. The rail offers **Settings**, workspace switching when allowed, light/dark theme, and **Sign out**.

**Mobile layout:** Select **Open Office menu** (menu icon). Choose a category, expand its subgroup, tap a route, then close the menu. Some dialogs and forms scroll vertically. Use the main content area after the menu is closed; if a floating panel blocks a field, close the panel and reopen it after returning to the top of the content.

**Utilities:** Use **More workspace tools** in the top corner for your presence/attendance status, command search, settings and theme actions. The command menu can also be opened with **Ctrl+K** (or **Cmd+K**) where supported. Browser back returns to the previous screen, but never assume a form has autosaved unless the app shows an explicit success state.

**Why a page is missing:** Navigation filters by role and capability. Even a direct URL may display **“This module is not assigned to your current authority.”** That is intentional. Request the smallest required permission through `/office/requests`; only an administrator or competent department head can grant access. Do not ask an employee to forward private screenshots or export data.

## 07 | First-day profile: My roles & onboarding

**Go to:** `/office/my-role`. In the header, inspect your **name, job title, primary department, employment status** and whether a verified permanent employee ID exists.

1. Expand **Responsibilities & work pattern**. Confirm your primary position, any additional duties, reported work pattern, and scope of authority. If anything is wrong, raise a request rather than silently changing it.
2. Expand **Onboarding evidence**. Each required task may appear `PENDING`, `SUBMITTED`, `VERIFIED` or `RETURNED`. Only an authorized reviewer can verify evidence; employees cannot verify their own task.
3. Expand **Personal details, education, bank and signed onboarding · Expand**, then **Employee intake details**.
4. Enter **full legal name, preferred name, contact phone, date of birth and address** accurately. Add actual education entries, qualifications, institutes, completion dates, professional experience and emergency contacts where applicable.
5. Complete **tax declaration** fields only with truthful information. For bank details, use the protected form; the account is encrypted server-side if correctly configured and the UI later displays only its last four digits. If the page says encryption is unavailable, stop and contact HR/IT; do not send bank details by email.
6. Under **Signed appointment & policies**, enter the **document evidence reference** issued by the controlled document process. A typed reference is **not** a signature. Review and acknowledge the applicable policy text before checking the acknowledgement box.
7. Select **Save private draft**. Only after saving can you upload **profile photo** (JPEG/PNG/WebP, up to 2 MB) and education **certificate PDF** (up to 10 MB). The private scanner and storage service must succeed; uploaded evidence is still pending verification.
8. Select **Submit complete onboarding for HR review** when the record is complete. Your intake is now read-only until HR verifies it or returns it for corrections.
9. If HR returns it (`RETURNED`), read the reviewer’s note, correct the missing or inaccurate fields, save, and resubmit. Do not use a second duplicate identity.
10. HR verifies personal and signature evidence; independent Finance verifies masked bank evidence. The permanent employee ID is issued only after required legal/start-date/checklist gates. The UI may show an **employee ID mail** state; `PENDING` is not proof of an email being delivered.
11. Expand **Salary slips & verified payment evidence** to inspect available records; if a slip exists, use its PDF link. An issued slip is not a bank credit confirmation.

**Privacy boundary:** Never put a full bank account, PAN, Aadhaar, identity scan, raw signature, recovery token or authenticator secret into an Office task description, public support case, email subject or screenshot.

## 08 | Your daily routine: begin, work, review, finish

**At actual work start:** Open **More workspace tools → My status → Attendance**. Select the actual **Work mode**, then **Check in**. A successful Office login is not attendance. Update your **availability** separately (for example, focused/busy/available according to the displayed options). Set an automatic status expiry if appropriate.

**During work:** Use **Start break** before an unpaid break and **End break** when you return. Work from `/office/tasks` and `/office/requests`; review `/office/notifications` and `/office/calendar` for assigned items. If you can approve something, read the evidence and conflict rules first.

**At work end:** Select **Check out**. Open `/office/worktime` to review daily net hours, your week total, recorded historical entries, candidate overtime and salary-slip ledger. The intended schedule is six **net** hours on Monday–Friday (30 net weekly); start/end times are flexible. The attendance policy’s effective operational tracking date is **14 November 2026**. Historic evidence can be reviewed back to **1 August 2026**, but no past hours should be entered without supporting evidence. Optional weekend or weekday excess hours are **potential**, not approved overtime pay.

**If an attendance entry is wrong:** Do not invent a six-hour default. Capture the real IST start/end, unpaid break, original source reference and explanation; use `/office/worktime` correction workflow only if allowed, or raise an HR request. A submitter or beneficiary cannot approve their own correction. Missing check-in alone is not automatic proof of absence.

## 09 | How to create and track a request

**Go to:** `/office/requests` (or **My work → Requests**). This is the general cross-department **workflow** mechanism, not a chat message.

1. Select **New request**. A side drawer labeled **Create request** opens.
2. Open **Request type** and search the available governed workflow types. Select the correct category (people/access/engineering/finance/legal/operations/product/customer, as listed for your profile).
3. Enter a specific **Request title** (what must happen), **Description** (business purpose, expected result, deadline, and non-secret evidence reference), and optional **Resource type** / scoped resource key.
4. Choose **Priority**: Low, Normal, High or Urgent. Do not use Urgent to bypass approval. Check the workflow preview and target.
5. Select **Submit into workflow**. Submission creates an approval chain; it does not itself issue money, employment, access, a contract or a production deployment.
6. In **My requests / Recent workflow**, open the request to view status and the **Approval timeline**. Common states include Draft, Pending, In review, Approved, Rejected, Fulfilled, Cancelled and Expired.
7. Respond to evidence requests with appropriate controlled references. If a request stalls, identify the assigned reviewer; do not ask another person to bypass the chain.

**Examples:** asking for repo access, an employment document, new hardware, a budget increase, a purchase, or a legal review. Enter only work-related information; sensitive personal evidence belongs in its specialized private area.

## 10 | Tasks, approvals and notifications are different

**Tasks:** `/office/tasks` → **Company inbox**. Tasks are actionable execution work, not legal authority. Open a task, use **Start** to begin and the shown status actions to **Block / Unblock / Complete** as appropriate. Provide an explanation when blocked, and link to the required original evidence. If you have assignment authority, **Create task**, select assignee, enter title/description/task type, priority and department, then confirm. Do not mark done unless the deliverable exists.

**Approvals:** `/office/approvals` → **Your approval queue**. Open the assigned request, review business purpose, evidence, conflicts, prior steps and your actual delegated authority. Record the explicit approval/rejection decision and note. Do not approve your own request, a beneficiary’s salary, a payment you prepared or a department action you no longer own. A user may have a manager title and still lack approval rights.

**Notifications:** `/office/notifications` → search signals and select **Read** or dismiss where available. A read/dismiss action acknowledges viewing the notification; it does not approve the underlying request or satisfy policy acknowledgement. Follow the linked request/task to perform the actual action.

**Calendar:** `/office/calendar` shows authorized events, assigned tasks and selected deadlines. Confirm the event’s source before treating it as a committed legal or statutory deadline; do not record confidential content in a widely visible company event.

## 11 | Company knowledge, policies, documents and legal evidence

**Read policies:** `/office/knowledge` → switch between **Policies**, **Announcements**, and **Knowledge**. Search for the relevant policy, SOP or company announcement. Review the **published version** and complete any explicit acknowledgement. Do not interpret “read notification” as acknowledgement. Only approved editors can create drafts, versions and publish content.

**Secure documents:** `/office/documents` → tabs **Documents / Templates / Clauses / Outputs** (if your profile permits). Find the record and its current version. Draft or create an instance only when authorized; approval, rendering, a signature event and delivery are separate audit stages. Generated PDF/DOCX/HTML/XLSX output does not replace the authoritative structured document record. A signature must be backed by valid signed evidence and review; do not manually mark “signed” merely because a PDF was uploaded.

**Contracts:** `/office/contracts` → follow counterparties, effective/expiry dates, owner, obligations and independently reviewed signed evidence. Signing authority must be delegated and valid; neither a Sales role nor a draft contract grants the right to bind the company.

**Company Secretary:** `/office/governance` covers agenda, board meetings, minutes, resolutions, actions and secretarial follow-up; `CS` here means **Company Secretary**, not Customer Support.

## 12 | How to ask for help or escalate a problem

| Problem | Open this path | What to provide (non-sensitive) |
| --- | --- | --- |
| Sign-in, MFA, device, email, software, VPN, laptop | `/office/it` → Service desk | Error time, system, device type, safe screenshot, impact and callback method |
| Missing capability or wrong role | `/office/requests` → access request, or `/office/access` by authorized admin | Required task, department/resource, least-privilege business reason |
| Incomplete invitation or registration | Authorized inviter’s `/office/access` invitation ledger | Corporate email, approximate issue date, high-level error; never the invite token |
| Onboarding personal-data correction | `/office/my-role`; HR reviews `/office/people` | Field to correct and official evidence reference, not raw identity scans in chat |
| Salary/attendance discrepancy | `/office/worktime`; HR/payroll request if needed | Real dates, approved work evidence, relevant payslip code |
| Customer case or refund matter | `/office/support` when support role assigned | Case reference, product, customer scope and remedy approval requirement |
| Work execution blocked | `/office/tasks` or `/office/requests` | Task/request ID, blocker and required decision |
| Confidential ethical concern | `/office/ethics` if available | Minimum necessary facts via confidential case channel, not ordinary team chat |
| Privacy/security incident | `/office/privacy`, `/office/security`, or IT service route as permitted | Risk, time, affected resource and minimal non-secret reproduction |

**Important distinction:** `/office/it` is an **internal IT ticket/licensing** workspace; `/office/support` is a **customer support/case** workspace; `/office/requests` is the enterprise approval engine; `/office/tasks` is the execution queue. A unified corporate chat/ticket-escalation inbox discussed for future Office releases is **not verified as live** in the audited main-branch route map.

## 13 | Personal preferences, security and account lifecycle

Open `/office/settings` → **Account**, **Appearance**, **Security & devices**, and **Communications**. Review your verified identity; select **Light** or **Dark** for workspace appearance. Use **Security & devices** to inspect your own protection and sessions, if presented. Avoid shared browser sessions. Keep device OS updated and use authenticated company equipment.

**Temporary leave/transfer:** Manager/HR should use the governed workforce/request processes and correct effective dates. Do not silently share an old role or customer list. **Department handover** is `/office/department-ownership`: a proposal is not an accepted transfer; only the actual recipient can accept with MFA. After acceptance, former owner write and approval privileges may be permanently restricted, even if that person is the Founder. This is separate from job-title and access-profile edits.

**Offboarding:** Authorized HR/Owner uses `/office/people` and the formal workforce lifecycle (approval, asset return, data custody, access revocation and evidence). Employee should return devices, clear entrusted assets using approved channels, transfer active tasks, resolve corporate documents, and sign out. Never export customer or employee data to personal storage. Revocation is a distinct control; it should not be inferred from last day or payroll status alone.

## 14 | What you will see when something is pending

| Label | Interpretation | What the employee does |
| --- | --- | --- |
| `DRAFT` | Entered but not submitted for approval | Finish and explicitly save/submit |
| `PENDING` / `IN_REVIEW` | In a reviewer’s queue | Monitor request; do not perform the protected action |
| `SUBMITTED` (intake) | Employee record is under independent review | Wait for reviewer action; correct only when returned |
| `RETURNED` | Reviewer requested corrections | Read reason, edit and resubmit |
| `VERIFIED` | Relevant reviewer accepted this evidence | Check subsequent approvals; not equivalent to paid/signed |
| `APPROVED` | Specified workflow stage approved | Follow execution instructions; not proof of provider action |
| `FULFILLED` / `DONE` | Execution work completed according to recorded evidence | Verify actual deliverable and linked record |
| `REJECTED` / `DECLINED` | A specific request or trust decision failed | Read reason and restart through legitimate workflow |
| `SUSPENDED` / `REVOKED` | Access disabled | Contact authorized admin; do not bypass |
| `UNKNOWN` / `PENDING` mail | Delivery evidence is missing, queued or uncertain | Do not assume the email was received |
| `COMPLIANT` / `FILED` | Should be used only with actual external evidence and professional review | Validate the relevant filing/evidence source |

## 15 | Troubleshooting: the ten most frequent cases

1. **Invite link invalid:** Return to the inviter; request a new link from `/office/access`. Do not copy a token into a ticket.
2. **Password accepted but no dashboard:** Complete MFA, new-browser approval or workspace processing. If denied, do not repeat registration.
3. **No email OTP:** Check registered email and Spam; use the permitted resend after the UI’s interval. If no provider acknowledgement, use Authenticator if available or ask authorized admin to investigate mail delivery. The code being shown as “sent” in the frontend is not an independent SMTP proof.
4. **Authenticator code rejected:** Enable automatic phone time, enter the current unexpired code, verify the correct phone. Never ask for another person’s OTP.
5. **New-device trust blocked:** Verify the exact browser request and registered-email action; reject unknown devices.
6. **Settings or module not visible:** It may require capability assignment; use an access request rather than a direct URL workaround.
7. **A control is greyed out:** The action may need reviewer scope, `ACTIVE` identity, effective start date, verified evidence, or deployment dependency. Save what is available and raise an appropriately scoped request.
8. **Personal/bank profile cannot save:** Check the current draft state and privacy/encryption warning. Never substitute email or unsupported file shares.
9. **Attendance not updating:** Confirm **Check in** occurred, breaks were ended, and **Check out** succeeded. An app login is not a working session.
10. **Document/payroll status seems final but external action did not occur:** Verify provider acknowledgement, bank settlement, signed artifact and the separate reviewer/evidence references.

## 16 | Security and professional conduct: non-negotiable controls

- Only use your assigned account and authorized equipment. Never share password, MFA code, recovery token or unapproved QR screenshot.
- Use **least privilege**: request only the permission and resource scope required for a specific duty; review/revoke when duty ends.
- Never self-approve any high-risk action, salary change, financial settlement, disciplinary outcome, corporate appointment or transfer of company authority.
- Store identity documents, bank and signature records only in their dedicated private Office workflows. Respect data minimization and retention controls.
- A company professional (CA, Company Secretary, legal adviser or auditor) signs off only within their formal competence and engagement. Office status is not a substitute for external filings or legal approval.
- Treat machine-generated summaries and AI recommendations as **advice requiring human verification**. Use only approved AI tools and scoped data.
- Report suspected phishing, leak, unauthorized access, lost device or unusual login promptly through the appropriate restricted channel.

## 17 | First week checklist

- [ ] Accepted valid private invitation or used previously registered identity.
- [ ] Registered/verified corporate email; completed MFA and device trust.
- [ ] Opened the correct Office or Finance dashboard; checked own role/profile.
- [ ] Completed personal onboarding draft, required documents and applicable policy acknowledgements.
- [ ] Submitted required onboarding evidence; checked reviewer status, no false `VERIFIED` claim.
- [ ] Reviewed tasks, requests, notifications and company calendar.
- [ ] Practised a legitimate workflow request without using sensitive data in descriptions.
- [ ] Used explicit Check in / Break / Check out on each actual workday after the effective date.
- [ ] Confirmed who reviews work, who manages IT access, and which escalation channel applies.
- [ ] Verified profile's permanent ID and payslip only when independently issued.

## 18 | Source verification and limits of this edition

Reviewed `main` contains route registries for **54 Office subsections** and **21 Finance subsections**, a permission-filtered floating-rail shell, the invitation/registration and MFA components, employee intake and role packages, Company Inbox, request/approval workflows, HR worktime, and operational modules. This establishes **code-level existence**, not full live availability. I could not verify authenticated production behavior, database migration application, provider-delivered invitations/OTPs, every UI interaction or actual audit logs. The connected Vercel workspace did not expose a matching KRAVIA project during this review. Treat the versioned source links listed in the master manual as the technical reference; refresh screenshots and labels against a real non-production test identity before mass distribution.

**Not verified as shipped:** A dedicated `/office/info` manual sidebar/personal acknowledgment module; a unified employee-to-employee corporate chat/group/mention interface; automatic delivery of role-specific PDF attachments on invitation. These are described in the separate rollout specification, not represented here as working controls.