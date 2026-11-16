# KRAVIA Connect — Live Presence & Private Attachment Composer

## Release scope (2026-11-16)

This is a targeted extension of the existing Office Connect service, not a
second identity provider or a new message database. The current Supabase
Office conversation schema remains canonical. The frontend remains Next.js
and Vercel; the existing FastAPI scanner remains on Railway until an
independent migration is approved.

## Presence

- Authenticated AAL2 Office clients create a random UUID per mounted chat tab.
- The first-party API renews a 65-second expiring device lease every 22 seconds
  while the chat screen is visible. Hiding or closing it requests revocation.
- Active sessions are aggregated by user across tabs/devices. A disconnected
  device is treated as offline when its lease expires.
- Last seen is stored independently of workforce attendance, working hours,
  leave, overtime, or payroll.
- Only active participants of a permitted conversation may request other
  participants' activity. Both private chat and department-channel access
  are re-validated by the existing Office IAM path on every request.
- Default last-seen visibility: authorized coworkers; default online visibility:
  same as last seen. Members can choose CONVERSATIONS or NOBODY for last seen,
  and COWORKERS or SAME_AS_LAST_SEEN for online.
- Visibility changes emit privacy-safe PRESENCE invalidations without publishing
  names, messages, activity timestamps or access grants to the SSE stream.

## Real-time communication

The existing SSE endpoint remains the transport. It revalidates membership
and scope for each batch. Per-conversation polling decreases from 2300 ms to
700 ms and inbox polling from 3600 ms to 1800 ms for the present small Office
installation. These are *poll intervals*, not measured p95 delivery SLAs.
Monitor database query counts and serverless duration under load; Cloudflare
Durable Objects/WebSockets remain a separate infrastructure upgrade.

Messages, edits, deliveries and receipts use existing canonical persisted
records. Typing is ephemeral and expires after 4.5 seconds of silence.
Online status is not proof of attention or a read receipt.

## Attachment composer

- A selected file opens the floating sender-only preview immediately. Image and
  video thumbnails and a sandboxed local PDF preview are available; unsupported
  files show safe metadata. The original selected file bytes never leave the
  browser for preview rendering.
- The uploader stages attachments into private quarantine and runs the
  existing server-side content-signature and malware-scanner workflow.
- Until a message is explicitly sent, no recipient is given an attachment
  reference, download access, or an incoming message event. Any failure to
  confirm a CLEAN scan keeps the Send action disabled.
- Maximum remains five files and 4 MiB each until a larger direct-upload route
  and backend scanner have been separately deployed.
- Removing a prepared file calls an authenticated, same-origin DELETE endpoint.
  The server verifies uploader identity, current conversation membership and
  unlinked status, writes a DISCARDED audit event, marks it CANCELLED to prevent
  any future send, and then requests private object deletion.
- Object cleanup failure is reported for reconciliation; cancellation still
  prevents the file becoming a message attachment. A scheduled abandoned-draft
  sweeper is a separate operational control, not claimed by this release.

## Acceptance checklist

1. Current Office account, MFA and membership can open a permitted conversation.
2. Two tabs on one account remain online when only one tab closes.
3. Last-seen NOBODY hides timestamps; SAME_AS_LAST_SEEN hides online too.
4. Another employee outside a group cannot enumerate that group's presence.
5. Role revocation blocks presence and content routes without stale owner bypass.
6. Typing updates do not transmit drafts and do not create persistent messages.
7. Image/PDF modal appears before confirmation on desktop and phone.
8. A cancelled draft is never sendable even if a scan completes concurrently.
9. Existing delivery/read receipts, inbox invalidations, notifications and
   approvals remain intact.
10. Browser/mobile E2E, TS, lint, unit tests, SQL, and production build pass.

This does not claim deployed WebSocket/Durable Object, LangGraph, E2EE, or
blockchain services; those require separate credentials and infrastructure.
