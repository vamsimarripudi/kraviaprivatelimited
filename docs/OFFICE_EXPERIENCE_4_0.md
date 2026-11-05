# KRAVIA Office Experience 4.0

Status: APPROVED / IMPLEMENTATION BASELINE  
Branch: `office/experience-4-0`  
Scope: KRAVIA Office + shared Finance workspace presentation layer  
Non-goal: rewrite business rules, authorization, APIs, audit semantics, database behavior, or financial calculations.

## 1. Product intent

Office 4.0 is a private enterprise operating environment. The experience must feel spatial, calm and high-assurance rather than like a conventional admin dashboard.

Every screen is built from one interaction grammar:

- stable application shell;
- contextual workspace canvas;
- floating secondary surfaces;
- progressive action surfaces;
- explicit system feedback;
- keyboard-first command layer.

The design may become substantially more expressive, but permissions, authority, data provenance and control boundaries remain unchanged.

## 2. Screen-family architecture

### A. Secure access family
Routes:
- /office/login
- /office/activate
- /office/authenticator
- /office/device-approval
- /office/invite
- /office/recover
- /office/recover/founder
- /office/register
- /office/reset-password

Model:
- cinematic enterprise identity field on large screens;
- floating secure-access card;
- password -> MFA -> device approval -> success as spatial states, never disconnected pages;
- QR/device approval and timers use progress surfaces;
- success becomes a short verified-transition state before workspace entry;
- recovery warnings are high-assurance decision surfaces, not generic alerts.

### B. Office shell family
Authenticated routes under /office/(workspace)/[section].

Persistent structure:
1. navigation rail;
2. workspace context;
3. top command dock;
4. page context/attention strip;
5. active module canvas;
6. contextual floating layer;
7. task/notification feedback layer.

Navigation groups remain permission/capability filtered. Visual grouping can change, access semantics cannot.

### C. My Work
- dashboard
- notifications
- tasks
- calendar
- requests
- approvals

Pattern:
- priority-driven opening canvas;
- personal action queue;
- due-state timeline;
- request/approval inspectors;
- persistent completion feedback.

### D. Leadership / company control
- manager
- decisions
- strategy
- intelligence

Pattern:
- executive summary canvas;
- exception-first cards;
- evidence/decision drawers;
- OKR and risk relationship visuals;
- no automated authority or fabricated health scoring.

### E. Operate
- products
- portfolio
- customers
- crm
- engineering

Pattern:
- canonical record tables;
- relationship inspectors;
- project/service cards;
- action drawers;
- activity timelines;
- dense data remains table-native.

### F. Govern / records
- governance
- compliance
- registrations
- knowledge
- documents
- contracts
- vendors

Pattern:
- evidence-first layout;
- review status;
- version/history inspectors;
- document preview surface;
- high-impact approvals use explicit decision modals.

### G. People / physical office
- recruitment
- people
- emergency
- development
- travel
- cards
- payroll
- budget
- assets
- devices
- it
- facilities
- support

Pattern:
- privacy-aware record views;
- task/request drawers;
- lifecycle/timeline visualization;
- sensitive reveals are deliberate and auditable;
- mobile turns multi-pane layouts into sheets.

### H. Assurance
- access
- data
- privacy
- ethics
- resilience
- ai
- quality
- trust
- security
- integrations
- domains
- custody
- readiness
- audit
- settings

Pattern:
- control/evidence surfaces;
- danger and authority states are visually distinct;
- audit/event detail uses forensic inspector;
- security/identity state never relies on color alone.

### I. Owner-only public operations
- /office/resource-publishing
- /office/newsletters

Pattern:
- review -> preview -> approval -> publish/send;
- canonical preview surface;
- immutable evidence/status history;
- decision confirmations state exact impact.

### J. Finance workspace
Shared 4.0 primitives apply to:
- overview
- customers
- billing
- payroll
- budget
- GST
- accounting
- banking
- payments
- expenses
- reconciliation
- ownership
- documents
- compliance
- cards
- insurance
- ethics
- emergency
- AI governance
- audit

Finance remains numerically dense and restrained. Spatial design must improve comprehension without obscuring accounting/tax evidence.

## 3. Core component model

Foundation:
- OfficeExperienceRoot
- OfficeAmbientField
- OfficeShell
- OfficeNavigationRail
- OfficeCommandDock
- OfficeWorkspaceHeader
- OfficeAttentionStrip

Surfaces:
- OfficeSurface
- OfficeFloatingCard
- OfficeInspector
- OfficeDrawer
- OfficeDecisionModal
- OfficePopover
- OfficeBottomSheet
- OfficeTaskCard

Forms:
- OfficeForm
- OfficeFormSection
- OfficeField
- OfficeChoiceField
- OfficeReviewStep
- OfficeFormActions
- OfficeValidationSummary

Data:
- OfficeDataTable
- OfficeRecordCard
- OfficeMetric
- OfficeStatus
- OfficeTimeline
- OfficeEvidenceList
- OfficeDocumentPreview

Feedback:
- OfficeToast
- OfficeProgressCard
- OfficeSuccessState
- OfficeErrorState
- OfficeEmptyState
- OfficePermissionState
- OfficeSkeleton

## 4. Surface hierarchy

1. Base canvas — page background, no shadow.
2. Raised surface — standard module/card.
3. Floating surface — contextual information, stronger depth.
4. Overlay surface — drawer/modal/command palette.
5. Critical surface — high-impact decisions and blocked states.

Do not use floating elevation for every card. Elevation communicates interaction priority.

## 5. Motion constitution

Micro state: 120-180ms.  
Card/inspector: 220-320ms.  
Workspace transition: 300-450ms.  
Major workflow state: 400-600ms.

Allowed:
- transform;
- opacity;
- clip/scale where GPU-safe;
- restrained spring motion for floating surfaces.

Avoid:
- looping decorative motion inside dense tables;
- layout-shifting animation;
- blur-heavy continuous effects;
- animation that hides data availability.

Reduced-motion:
- remove ambient loops;
- replace spatial transitions with instant/opacity transitions;
- preserve status and focus communication.

## 6. Authentication motion sequence

Password -> verified password -> MFA -> device trust -> workspace entry.

Visual sequence:
- secure card remains spatially anchored;
- phase changes crossfade/slide within the same card;
- ambient field changes intensity by phase;
- successful AAL2 verification triggers a short identity-confirmation state;
- no spinner-only full-screen transitions.

## 7. Overlay decision matrix

Tooltip: term/help only.  
Popover: small contextual read/action.  
Inspector: record details and related evidence.  
Drawer: editable secondary workflow.  
Decision modal: destructive/high-impact decision.  
Full-screen flow: statutory/financial/multi-stage workflow.

Mobile:
- inspectors/drawers become bottom sheets;
- decision modal remains modal;
- full-screen flow remains full-screen.

## 8. Forms

Every long form follows:
Context -> Essentials -> Additional -> Review -> Result.

Rules:
- reveal conditional fields only when relevant;
- validate locally where deterministic;
- retain server error authority;
- destructive choices show downstream impact;
- primary action stays visible on long workflows;
- keyboard and screen-reader semantics are mandatory.

## 9. Tables

Keep true tables for enterprise data.

Required capabilities where relevant:
- sticky header;
- sticky identifier column;
- sort/filter;
- saved view hooks;
- density control;
- bulk selection where authorized;
- row inspector;
- keyboard navigation;
- mobile record-card transformation.

## 10. Design tokens

Token namespaces:
- --ox4-canvas-*
- --ox4-surface-*
- --ox4-text-*
- --ox4-border-*
- --ox4-status-*
- --ox4-shadow-*
- --ox4-radius-*
- --ox4-space-*
- --ox4-motion-*
- --ox4-z-*

Status semantics:
neutral / info / success / warning / danger / blocked / pending.

## 11. Responsive targets

Desktop wide: 1440+.  
Desktop: 1280.  
Tablet landscape: 1024.  
Tablet portrait: 768.  
Mobile large: 430.  
Mobile: 390.  
Mobile compact: 360.

Desktop may use 2-3 panes. Tablet uses rail + focused canvas. Mobile uses one canvas with sheets.

## 12. Accessibility gates

- WCAG 2.2 AA target;
- complete keyboard access;
- focus restoration for overlays;
- focus trap only for modal surfaces;
- visible focus;
- minimum touch target;
- semantic status announcements;
- reduced motion;
- no color-only state;
- table headers and form errors remain programmatically associated.

## 13. Implementation waves

Wave 0 — inventory and architecture: complete.  
Wave 1 — tokens, ambient field, shared surfaces, overlay primitives.  
Wave 2 — secure access family.  
Wave 3 — shell/navigation/top command layer.  
Wave 4 — My Work and dashboard.  
Wave 5 — forms/data/table primitives across modules.  
Wave 6 — Finance and reconciliation.  
Wave 7 — governance/records/people/assurance modules.  
Wave 8 — owner publishing/newsletter flows.  
Wave 9 — responsive, reduced motion and accessibility hardening.  
Wave 10 — regression/build/test evidence and merge.

## 14. Migration constraints

- Existing server routes remain canonical.
- Existing permission checks remain canonical.
- Existing role/capability filtering remains canonical.
- Existing data mutations remain server-authorized.
- No UI redesign may grant authority.
- No provider secret or protected record becomes client-visible.
- Legacy styling is removed only after replacement paths pass validation.

## 15. Release gate

Before merge to main:
- npm run typecheck;
- npm run test;
- npm run build;
- Office auth smoke;
- role/capability navigation smoke;
- keyboard overlay test;
- reduced-motion test;
- 1440/1280/1024/768/430/390/360 visual checks;
- no uncaught console errors;
- no raw backend error leakage;
- no unresolved placeholder/temporary UI;
- production preview validation before promotion.

## 16. Definition of done

Office 4.0 is complete when the sign-in page, every authentication phase, authenticated shell, every reachable Office/Finance module, every modal/drawer/popover/toast/form/table state, and all loading/empty/error/permission states use the same approved system without legacy visual islands.
