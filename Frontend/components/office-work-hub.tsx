"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Columns3,
  Filter,
  Laptop,
  LayoutList,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import { officeMutation, officeQuery } from "@/lib/office/http-client";
import styles from "./office-work-hub.module.css";

type Mode = "dashboard" | "requests" | "approvals" | "manager";
type RequestStatus = "DRAFT" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED" | "EXPIRED" | string;
type RequestType = { code: string; label: string; module: string; description: string; default_priority: string; default_due_hours: number; high_risk: boolean };
type Step = { id: string; step_order: number; step_code: string; label: string; status: string; decision_note?: string | null; decided_at?: string | null; assigned_user_id?: string | null };
type WorkRequest = { id: string; request_type_code: string; requester_user_id: string; requester_department?: string | null; target_user_id?: string | null; resource_type?: string | null; resource_key?: string | null; title: string; description: string; payload?: Record<string, unknown>; priority: string; status: RequestStatus; current_step_order: number; due_at?: string | null; created_at: string; updated_at: string; completed_at?: string | null; steps?: Step[] };
type Approval = { step: Step & { request_id: string }; request: WorkRequest | null };
type Device = { id: string; device_label: string; device_kind: string; platform?: string | null; trust_state: string; company_managed: boolean; last_seen_at?: string | null };
type DirectReport = { user_id: string; position_code: string; department_code: string; team_key?: string | null; product_key?: string | null; employment_type?: string | null; identity?: { display_name?: string | null; job_title?: string | null; primary_department?: string | null; status?: string | null } | null };
type Overview = {
  identity: { user_id: string; email?: string | null; roles: string[]; department?: string | null; authorization_version: number };
  job?: { position_code: string; department_code: string; reports_to_user_id?: string | null; team_key?: string | null; product_key?: string | null; employment_type?: string | null } | null;
  profiles: Array<{ id: string; profile_code: string; scope_type: string; scope_key?: string | null; expires_at?: string | null }>;
  request_types: RequestType[];
  requests: WorkRequest[];
  approvals: Approval[];
  notifications: Array<{ id: string; request_id?: string | null; kind: string; title: string; body: string; status: string; created_at: string }>;
  devices: Device[];
  direct_reports: DirectReport[];
  team_requests: WorkRequest[];
};

type Draft = { requestType: string; title: string; description: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; resourceType: string; resourceKey: string };
const emptyDraft: Draft = { requestType: "", title: "", description: "", priority: "NORMAL", resourceType: "", resourceKey: "" };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  if (method === "GET") {
    return officeQuery<T>(url, undefined, { staleMs: 10_000 });
  }
  const body = typeof options?.body === "string"
    ? JSON.parse(options.body)
    : options?.body;
  return officeMutation<T>(url, {
    method: method as "POST" | "PUT" | "PATCH" | "DELETE",
    body,
    invalidate: "/api/office-work",
  });
}

function readableDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function requestType(types: RequestType[], code: string) {
  return types.find((type) => type.code === code);
}

export function OfficeWorkHub({ identity, mode }: { identity: OfficeIdentity; mode: Mode }) {
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "board">("list");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<WorkRequest>();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [decision, setDecision] = useState<{ request: WorkRequest; note: string }>();

  useEffect(() => {
    let alive = true;
    void json<Overview>("/api/office-work/overview")
      .then((data) => { if (alive) setOverview(data); })
      .catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load Office work"); });
    return () => { alive = false; };
  }, []);

  async function reload(message?: string) {
    const data = await json<Overview>("/api/office-work/overview");
    setOverview(data);
    setNotice(message);
  }

  const filteredRequests = useMemo(() => {
    const rows = mode === "manager" ? overview?.team_requests ?? [] : overview?.requests ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.title} ${row.description} ${row.request_type_code} ${row.status} ${row.resource_key ?? ""}`.toLowerCase().includes(needle));
  }, [mode, overview?.requests, overview?.team_requests, search]);

  const activeCount = (overview?.requests ?? []).filter((request) => ["PENDING", "IN_REVIEW", "APPROVED"].includes(request.status)).length;
  const unread = (overview?.notifications ?? []).filter((item) => item.status !== "READ").length;
  const trustedDevices = (overview?.devices ?? []).filter((device) => device.trust_state === "TRUSTED").length;

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.requestType) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await json<{ request_id: string }>("/api/office-work/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: draft.requestType,
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          resource_type: draft.resourceType || undefined,
          resource_key: draft.resourceKey || undefined,
          payload: {},
        }),
      });
      setDraft(emptyDraft);
      setNewOpen(false);
      await reload("Request submitted into its governed approval workflow.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Unable to create request");
    } finally {
      setBusy(false);
    }
  }

  async function decide(kind: "APPROVE" | "REJECT") {
    if (!decision) return;
    setBusy(true);
    try {
      await json(`/api/office-work/requests/${decision.request.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: kind, note: decision.note || undefined }),
      });
      setDecision(undefined);
      await reload(kind === "APPROVE" ? "Approval recorded and the workflow advanced." : "Request rejected and the requester was notified.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Unable to record decision");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <section className={styles.state}><AlertTriangle /><div><h2>Work center unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  if (!overview) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Preparing your workspace</h2><p>Resolving position, reporting line, access profiles, requests and approvals.</p></div></section>;

  const selectedType = requestType(overview.request_types, draft.requestType);

  return <div className={styles.hub}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.kicker}><Sparkles /> <span>{overview.job?.position_code?.replaceAll("_", " ") ?? "ROLE-SCOPED MEMBER"}</span></div>
        <h2>{mode === "dashboard" ? "Work that needs you, not another dashboard." : mode === "approvals" ? "Decisions with context, authority and traceability." : mode === "manager" ? "Your team, requests and delegated decisions." : "One request center for every department."}</h2>
        <p>{overview.job?.department_code ?? identity.department ?? "KRAVIA"}{overview.job?.team_key ? ` · ${overview.job.team_key}` : ""}{overview.profiles.length ? ` · ${overview.profiles.map((profile) => profile.profile_code).join(" · ")}` : ""}</p>
      </div>
      <div className={styles.heroActions}><button className={styles.primary} type="button" onClick={() => setNewOpen(true)}><Plus /> New request</button><span className={styles.authBadge}><ShieldCheck /> AAL2 · authz v{identity.authzVersion}</span></div>
    </section>

    <section className={styles.metrics} aria-label="Work summary">
      <article><span>My active requests</span><strong>{activeCount}</strong><small>Pending, in review or approved</small></article>
      <article><span>My approvals</span><strong>{overview.approvals.length}</strong><small>Decisions currently assigned</small></article>
      <article><span>Direct reports</span><strong>{overview.direct_reports.length}</strong><small>From the controlled reporting line</small></article>
      <article><span>Trusted devices</span><strong>{trustedDevices}</strong><small>{unread} unread notifications</small></article>
    </section>

    {notice ? <div className={styles.notice}><CircleDot />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}

    {mode === "dashboard" ? <Dashboard overview={overview} onOpen={setDetail} onApprove={(request) => setDecision({ request, note: "" })} /> : null}
    {mode === "requests" ? <RequestWorkspace overview={overview} requests={filteredRequests} search={search} setSearch={setSearch} view={view} setView={setView} onOpen={setDetail} onNew={() => setNewOpen(true)} /> : null}
    {mode === "approvals" ? <ApprovalWorkspace approvals={overview.approvals} types={overview.request_types} onOpen={setDetail} onDecision={(request) => setDecision({ request, note: "" })} /> : null}
    {mode === "manager" ? <ManagerWorkspace overview={overview} requests={filteredRequests} search={search} setSearch={setSearch} onOpen={setDetail} /> : null}

    {newOpen ? <div className={styles.drawerBackdrop} role="presentation" onMouseDown={() => setNewOpen(false)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Create Office request" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>NEW WORKFLOW</p><h2>Create request</h2></div><button type="button" onClick={() => setNewOpen(false)} aria-label="Close"><X /></button></header>
      <form onSubmit={submitRequest} className={styles.requestForm}>
        <RequestTypePicker types={overview.request_types} value={draft.requestType} onChange={(requestTypeCode) => setDraft((current) => ({ ...current, requestType: requestTypeCode }))} />
        {selectedType ? <div className={styles.typePreview} data-risk={selectedType.high_risk}><div><b>{selectedType.label}</b><span>{selectedType.module} · {selectedType.default_due_hours}h target</span></div>{selectedType.high_risk ? <em><ShieldCheck /> High-risk workflow</em> : <em>Standard workflow</em>}<p>{selectedType.description}</p></div> : null}
        <label>Request title<input required minLength={3} maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" /></label>
        <label>Description<textarea required minLength={3} maxLength={4000} rows={5} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Business reason, expected outcome and useful context" /></label>
        <div className={styles.formGrid}><label>Resource type<input value={draft.resourceType} onChange={(event) => setDraft((current) => ({ ...current, resourceType: event.target.value }))} placeholder="Repository, product, vendor…" /></label><label>Resource / scope<input value={draft.resourceKey} onChange={(event) => setDraft((current) => ({ ...current, resourceKey: event.target.value }))} placeholder="vidyaluma/web, Product A…" /></label></div>
        <fieldset className={styles.priority}><legend>Priority</legend>{(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((priority) => <button type="button" key={priority} data-active={draft.priority === priority} onClick={() => setDraft((current) => ({ ...current, priority }))}>{priority}</button>)}</fieldset>
        <div className={styles.impact}><ShieldCheck /><div><b>Approval-safe by default</b><p>Your request creates its configured approval chain. Submitting it does not grant access, spend money, deploy code or execute a regulated action by itself.</p></div></div>
        <button className={styles.submit} type="submit" disabled={busy || !draft.requestType}>{busy ? <LoaderCircle className="spin" /> : <ArrowRight />} Submit into workflow</button>
      </form>
    </aside></div> : null}

    {detail ? <RequestDrawer request={detail} types={overview.request_types} onClose={() => setDetail(undefined)} /> : null}

    {decision ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setDecision(undefined)}><section className={styles.decisionModal} role="dialog" aria-modal="true" aria-label="Request decision" onMouseDown={(event) => event.stopPropagation()}><header><div><p>DECISION</p><h2>{decision.request.title}</h2></div><button type="button" onClick={() => setDecision(undefined)} aria-label="Close"><X /></button></header><p>{decision.request.description}</p><label>Decision note<textarea rows={4} maxLength={2000} value={decision.note} onChange={(event) => setDecision({ ...decision, note: event.target.value })} placeholder="Why are you approving or rejecting this request?" /></label><div className={styles.decisionActions}><button type="button" disabled={busy} onClick={() => void decide("REJECT")}><XCircle /> Reject</button><button className={styles.approve} type="button" disabled={busy} onClick={() => void decide("APPROVE")}>{busy ? <LoaderCircle className="spin" /> : <Check />} Approve step</button></div></section></div> : null}
  </div>;
}

function Dashboard({ overview, onOpen, onApprove }: { overview: Overview; onOpen: (request: WorkRequest) => void; onApprove: (request: WorkRequest) => void }) {
  return <div className={styles.dashboardGrid}>
    <section className={styles.panel}><PanelHeader eyebrow="NEXT ACTIONS" title="Your approval queue" action={overview.approvals.length ? `${overview.approvals.length} waiting` : "Clear"} />
      <div className={styles.actionList}>{overview.approvals.slice(0, 5).map(({ request, step }) => request ? <button type="button" key={step.id} onClick={() => onApprove(request)}><StatusBadge status={request.status} /><span><b>{request.title}</b><small>{step.label} · {request.priority}</small></span><ArrowRight /></button> : null)}{!overview.approvals.length ? <Empty title="No approvals waiting" text="New assigned decisions will appear here." /> : null}</div>
    </section>
    <section className={styles.panel}><PanelHeader eyebrow="MY REQUESTS" title="Recent workflow" action={`${overview.requests.length} total`} />
      <div className={styles.compactRows}>{overview.requests.slice(0, 6).map((request) => <button type="button" key={request.id} onClick={() => onOpen(request)}><span><b>{request.title}</b><small>{request.request_type_code} · {readableDate(request.updated_at)}</small></span><StatusBadge status={request.status} /></button>)}{!overview.requests.length ? <Empty title="No requests yet" text="Create your first governed request instead of handling it through chat or email." /> : null}</div>
    </section>
    <section className={styles.panel}><PanelHeader eyebrow="TRUST" title="Your devices" action={`${overview.devices.length} registered`} />
      <div className={styles.devices}>{overview.devices.slice(0, 4).map((device) => <article key={device.id}><Laptop /><span><b>{device.device_label}</b><small>{device.platform || device.device_kind}</small></span><em data-status={device.trust_state}>{statusLabel(device.trust_state)}</em></article>)}{!overview.devices.length ? <Empty title="No registered device" text="Device controls become visible when your access profile requires them." /> : null}</div>
    </section>
    <section className={styles.panel}><PanelHeader eyebrow="NOTIFICATIONS" title="What changed" action={`${overview.notifications.length} recent`} />
      <div className={styles.notificationList}>{overview.notifications.slice(0, 5).map((item) => <article key={item.id} data-unread={item.status !== "READ"}><CircleDot /><div><b>{item.title}</b><p>{item.body}</p><small>{readableDate(item.created_at)}</small></div></article>)}{!overview.notifications.length ? <Empty title="All quiet" text="Workflow updates and delegated actions will appear here." /> : null}</div>
    </section>
  </div>;
}

function RequestWorkspace({ overview, requests, search, setSearch, view, setView, onOpen, onNew }: { overview: Overview; requests: WorkRequest[]; search: string; setSearch: (value: string) => void; view: "list" | "board"; setView: (value: "list" | "board") => void; onOpen: (request: WorkRequest) => void; onNew: () => void }) {
  return <section className={styles.panel}>
    <div className={styles.workspaceHead}><div><p className="eyebrow">UNIVERSAL REQUEST CENTER</p><h2>Requests across every function</h2><span>One workflow model for access, people, engineering, finance, legal, product, operations and customers.</span></div><button className={styles.primary} type="button" onClick={onNew}><Plus /> New request</button></div>
    <div className={styles.toolbar}><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests, resources or status" /></label><button type="button"><Filter /> Filters</button><div className={styles.viewToggle}><button type="button" data-active={view === "list"} onClick={() => setView("list")} aria-label="List view"><LayoutList /></button><button type="button" data-active={view === "board"} onClick={() => setView("board")} aria-label="Board view"><Columns3 /></button></div></div>
    {view === "list" ? <RequestTable requests={requests} types={overview.request_types} onOpen={onOpen} /> : <RequestBoard requests={requests} types={overview.request_types} onOpen={onOpen} />}
  </section>;
}

function ApprovalWorkspace({ approvals, types, onOpen, onDecision }: { approvals: Approval[]; types: RequestType[]; onOpen: (request: WorkRequest) => void; onDecision: (request: WorkRequest) => void }) {
  return <section className={styles.panel}><div className={styles.workspaceHead}><div><p className="eyebrow">ASSIGNED TO YOU</p><h2>Approval inbox</h2><span>Approval authority is resolved by workflow assignment and permission—not by a title printed on an org chart.</span></div></div>
    <div className={styles.approvalGrid}>{approvals.map(({ request, step }) => request ? <article key={step.id} className={styles.approvalCard}><div className={styles.approvalTop}><StatusBadge status="PENDING" /><em>{request.priority}</em></div><p className="eyebrow">{requestType(types, request.request_type_code)?.module ?? request.request_type_code}</p><h3>{request.title}</h3><p>{request.description}</p><div className={styles.approvalMeta}><span><Clock3 /> Due {readableDate(request.due_at)}</span><span><ShieldCheck /> {step.label}</span></div><div className={styles.cardActions}><button type="button" onClick={() => onOpen(request)}>Review context</button><button className={styles.approve} type="button" onClick={() => onDecision(request)}>Decide <ArrowRight /></button></div></article> : null)}{!approvals.length ? <Empty title="Approval queue is clear" text="Only requests assigned to your current authority will appear here." /> : null}</div>
  </section>;
}

function ManagerWorkspace({ overview, requests, search, setSearch, onOpen }: { overview: Overview; requests: WorkRequest[]; search: string; setSearch: (value: string) => void; onOpen: (request: WorkRequest) => void }) {
  if (!overview.direct_reports.length) return <section className={styles.panel}><Empty title="No active reporting line assigned" text="Manager authority is not inferred from a label. When people formally report to you, their governed team workspace will appear here." /></section>;
  return <div className={styles.managerGrid}>
    <section className={styles.panel}><PanelHeader eyebrow="DIRECT REPORTS" title="Team" action={`${overview.direct_reports.length} people`} /><div className={styles.peopleGrid}>{overview.direct_reports.map((person) => <article key={person.user_id}><div className={styles.avatar}>{(person.identity?.display_name || person.position_code || "K").slice(0, 2).toUpperCase()}</div><div><b>{person.identity?.display_name || "KRAVIA member"}</b><span>{person.identity?.job_title || person.position_code.replaceAll("_", " ")}</span><small>{person.department_code}{person.team_key ? ` · ${person.team_key}` : ""}</small></div><em>{person.identity?.status ?? "ACTIVE"}</em></article>)}</div></section>
    <section className={styles.panel}><div className={styles.workspaceHead}><div><p className="eyebrow">TEAM REQUESTS</p><h2>Requests from your reporting line</h2></div><label className={styles.inlineSearch}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team requests" /></label></div><RequestTable requests={requests} types={overview.request_types} onOpen={onOpen} /></section>
  </div>;
}

function RequestTable({ requests, types, onOpen }: { requests: WorkRequest[]; types: RequestType[]; onOpen: (request: WorkRequest) => void }) {
  if (!requests.length) return <Empty title="Nothing here yet" text="Requests matching this view will appear here." />;
  return <div className={styles.tableWrap}><table><thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Priority</th><th>Due</th><th></th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} onClick={() => onOpen(request)}><td><b>{request.title}</b><span>{request.resource_key || request.description}</span></td><td><span className={styles.modulePill}>{requestType(types, request.request_type_code)?.module ?? request.request_type_code}</span></td><td><StatusBadge status={request.status} /></td><td><span data-priority={request.priority} className={styles.priorityText}>{request.priority}</span></td><td>{readableDate(request.due_at)}</td><td><ArrowRight /></td></tr>)}</tbody></table></div>;
}

function RequestBoard({ requests, types, onOpen }: { requests: WorkRequest[]; types: RequestType[]; onOpen: (request: WorkRequest) => void }) {
  const lanes = ["PENDING", "IN_REVIEW", "APPROVED", "FULFILLED", "REJECTED"];
  return <div className={styles.board}>{lanes.map((lane) => <section key={lane}><header><StatusBadge status={lane} /><span>{requests.filter((request) => request.status === lane).length}</span></header><div>{requests.filter((request) => request.status === lane).map((request) => <button type="button" key={request.id} onClick={() => onOpen(request)}><small>{requestType(types, request.request_type_code)?.module ?? request.request_type_code}</small><b>{request.title}</b><p>{request.description}</p><span>{request.priority} · {readableDate(request.due_at)}</span></button>)}</div></section>)}</div>;
}

function RequestDrawer({ request, types, onClose }: { request: WorkRequest; types: RequestType[]; onClose: () => void }) {
  const type = requestType(types, request.request_type_code);
  return <div className={styles.drawerBackdrop} role="presentation" onMouseDown={onClose}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Request details" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{type?.module ?? request.request_type_code}</p><h2>{request.title}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X /></button></header><div className={styles.detailStatus}><StatusBadge status={request.status} /><span>{request.priority}</span><small>Created {readableDate(request.created_at)}</small></div><p className={styles.detailDescription}>{request.description}</p>{request.resource_type || request.resource_key ? <div className={styles.resourceCard}><span>RESOURCE SCOPE</span><b>{request.resource_type || "Resource"}</b><p>{request.resource_key || "Not specified"}</p></div> : null}<section className={styles.timeline}><p className="eyebrow">APPROVAL TIMELINE</p>{(request.steps ?? []).map((step) => <article key={step.id} data-state={step.status}><div>{step.status === "APPROVED" ? <Check /> : step.status === "REJECTED" ? <X /> : <Clock3 />}</div><span><b>{step.label}</b><small>{statusLabel(step.status)}{step.decided_at ? ` · ${readableDate(step.decided_at)}` : ""}</small>{step.decision_note ? <p>{step.decision_note}</p> : null}</span></article>)}{!(request.steps ?? []).length ? <p className={styles.muted}>Workflow steps will appear after submission.</p> : null}</section></aside></div>;
}

function RequestTypePicker({ types, value, onChange }: { types: RequestType[]; value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = types.find((type) => type.code === value);
  const filtered = types.filter((type) => `${type.label} ${type.module} ${type.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.picker}><label>Request type</label><button type="button" className={styles.pickerTrigger} onClick={() => setOpen((current) => !current)}><span>{selected ? <><b>{selected.label}</b><small>{selected.module}</small></> : <><b>Select governed workflow</b><small>Search every department</small></>}</span><ChevronDown /></button>{open ? <div className={styles.pickerMenu}><label><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request types" /></label><div>{filtered.map((type) => <button type="button" key={type.code} onClick={() => { onChange(type.code); setOpen(false); setQuery(""); }} data-selected={type.code === value}><span><b>{type.label}</b><small>{type.module} · {type.description}</small></span>{type.high_risk ? <ShieldCheck /> : null}</button>)}</div></div> : null}</div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={styles.status} data-status={status}>{statusLabel(status)}</span>;
}

function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) {
  return <div className={styles.panelHeader}><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>{action}</span></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className={styles.empty}><ShieldCheck /><div><b>{title}</b><p>{text}</p></div></div>;
}
