# KRAVIA Company OS Database Schema Summary

Date: July 9, 2026

Database: PostgreSQL

Migration tool: Flyway

Migration files observed:

- `V1__initial_schema.sql`
- `V2__document_vault.sql`
- `V3__board_meetings.sql`
- `V4__financial_records.sql`
- `V5__compliance_center.sql`
- `V6__company_tasks.sql`
- `V7__products_portfolio.sql`
- `V8__contacts_partners.sql`
- `V9__announcements_notifications.sql`
- `V10__executive_ai_assistant.sql`
- `V11__production_hardening.sql`

## Core Tables

| Table | Purpose |
| --- | --- |
| `users` | Application users and authentication metadata. |
| `roles` | Role definitions such as Founder, Director, and Viewer. |
| `user_roles` | User-to-role mapping. |
| `company_profile` | KRAVIA company profile information. |
| `audit_logs` | Important user and system actions. |

## Document Vault Tables

| Table | Purpose |
| --- | --- |
| `documents` | Document metadata and storage reference. |
| `document_versions` | Version tracking for uploaded documents. |

## Board Meeting Tables

| Table | Purpose |
| --- | --- |
| `board_meetings` | Main board meeting records. |
| `meeting_agenda_items` | Agenda items linked to meetings. |
| `meeting_decisions` | Decisions linked to meetings. |
| `meeting_resolutions` | Resolutions linked to meetings. |
| `meeting_action_items` | Action items linked to meetings. |

## Finance Table

| Table | Purpose |
| --- | --- |
| `financial_records` | Monthly financial summaries and calculated totals. |

## Compliance Table

| Table | Purpose |
| --- | --- |
| `compliance_items` | Compliance obligations, due dates, priorities, and statuses. |

## Task Table

| Table | Purpose |
| --- | --- |
| `company_tasks` | Company-level tasks, assignments, priorities, and due dates. |

## Product Table

| Table | Purpose |
| --- | --- |
| `products` | Product portfolio records, readiness, risks, and milestones. |

## Contact Table

| Table | Purpose |
| --- | --- |
| `contacts` | Contacts and partners with follow-up tracking. |

## Announcement and Notification Tables

| Table | Purpose |
| --- | --- |
| `announcements` | Internal announcements by audience and status. |
| `notifications` | User notifications and read/archive state. |

## AI Assistant Tables

| Table | Purpose |
| --- | --- |
| `ai_queries` | AI query history and response metadata. |
| `ai_context_snapshots` | Stored context snapshot references for AI queries. |

## Production Hardening Tables

| Table | Purpose |
| --- | --- |
| `refresh_tokens` | Refresh token persistence and expiry tracking. |
| `backup_runs` | Backup readiness and backup run metadata. |

## Missing From Required Scope

No Settings table was found in the observed migration set.

## Database Readiness Verdict

The database schema covers implemented modules and production hardening basics, but final approval requires running Flyway migrations against a clean PostgreSQL database and verifying backend tests with Java 21 and Maven Wrapper.
