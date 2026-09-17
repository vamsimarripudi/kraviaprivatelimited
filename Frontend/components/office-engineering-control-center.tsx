"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDot,
  GitBranch,
  LoaderCircle,
  Plus,
  ServerCog,
  ShieldCheck,
  X,
} from "lucide-react";
import styles from "./office-engineering-control-center.module.css";

type Service = {
  id: string;
  service_code: string;
  product_id?: string | null;
  name: string;
  project_key: string;
  repository_key?: string | null;
  repository_provider?: string | null;
  runtime_provider?: string | null;
  runtime_service_key?: string | null;
  environment: string;
  public_url?: string | null;
  owner_team?: string | null;
  status: string;
  runtime_redacted: boolean;
  permissions: { issue_manage: boolean; infrastructure_change: boolean; production_request: boolean };
};
type Deployment = { id: string; service_id: string; provider: string; provider_deployment_id?: string | null; git_sha?: string | null; git_ref?: string | null; environment: string; status: string; source: string; deployment_url?: string | null; started_at?: string | null; finished_at?: string | null; created_at: string };
type Incident = { id: string; incident_code: string; service_id: string; severity: string; title: string; summary: string; status: string; owner_user_id?: string | null; started_at: string; resolved_at?: string | null; can_manage: boolean };
type Person = { user_id: string; display_name?: string | null; job_title?: string | null };
type Product = { id: string; code: string; name: string; status: string; category?: string | null };
type ControlData = { actor: { user_id: string; roles: string[]; department?: string | null }; can_register_service: boolean; managed_projects: string[]; services: Service[]; deployments: Deployment[]; incidents: Incident[]; incident_events: Array<Record<string, unknown>>; people: Person[]; products: Product[] };

type ServiceDraft = { product: string; name: string; project: string; repository: string; repositoryProvider: string; runtimeProvider: string; runtimeService: string; environment: string; publicUrl: string; ownerTeam: string };
type IncidentDraft = { service: string; severity: string; title: string; summary: string; owner: string };

const emptyService: ServiceDraft = { product: "", name: "", project: "", repository: "", repositoryProvider: "GitHub", runtimeProvider: "", runtimeService: "", environment: "PRODUCTION", publicUrl: "", ownerTeam: "" };
const emptyIncident: IncidentDraft = { service: "", severity: "SEV3", title: "", summary: "", owner: "" };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Engineering request failed");
  return body as T;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function readable(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OfficeEngineeringControlCenter() {
  const [data, setData] = useState<ControlData>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [view, setView] = useState<"services" | "deployments" | "incidents">("services");
  const [create, setCreate] = useState<"service" | "incident">();
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(emptyService);
  const [incidentDraft, setIncidentDraft] = useState<IncidentDraft>(emptyIncident);
  const [selectedIncident, setSelectedIncident] = useState<Incident>();
  const [incidentNote, setIncidentNote] = useState("");

  async function reload(message?: string) {
    const next = await json<ControlData>("/api/office-engineering");
    setData(next);
    setNotice(message);
  }

  useEffect(() => {
    let alive = true;
    void json<ControlData>("/api/office-engineering").then((next) => { if (alive) setData(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load engineering control center");
    });
    return () => { alive = false; };
  }, []);

  const serviceMap = useMemo(() => new Map((data?.services ?? []).map((service) => [service.id, service])), [data?.services]);
  const peopleMap = useMemo(() => new Map((data?.people ?? []).map((person) => [person.user_id, person])), [data?.people]);
  const productMap = useMemo(() => new Map((data?.products ?? []).map((product) => [product.id, product])), [data?.products]);

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("service"); setError(undefined);
    try {
      await json("/api/office-engineering", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REGISTER_SERVICE", product_id: serviceDraft.product || undefined, name: serviceDraft.name, project_key: serviceDraft.project, repository_key: serviceDraft.repository || undefined, repository_provider: serviceDraft.repositoryProvider || undefined, runtime_provider: serviceDraft.runtimeProvider || undefined, runtime_service_key: serviceDraft.runtimeService || undefined, environment: serviceDraft.environment, public_url: serviceDraft.publicUrl || undefined, owner_team: serviceDraft.ownerTeam || undefined }) });
      setCreate(undefined); setServiceDraft(emptyService); await reload("Engineering service registered. No provider credentials or health claims were fabricated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to register service"); }
    finally { setBusy(undefined); }
  }

  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("incident"); setError(undefined);
    try {
      await json("/api/office-engineering", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_INCIDENT", service_id: incidentDraft.service, severity: incidentDraft.severity, title: incidentDraft.title, summary: incidentDraft.summary || undefined, owner_user_id: incidentDraft.owner || undefined }) });
      setCreate(undefined); setIncidentDraft(emptyIncident); await reload("Incident opened with an immutable lifecycle trail.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create incident"); }
    finally { setBusy(undefined); }
  }

  async function transition(action: "MITIGATE" | "MONITOR" | "RESOLVE" | "REOPEN") {
    if (!selectedIncident) return;
    setBusy(selectedIncident.id); setError(undefined);
    try {
      await json("/api/office-engineering", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "TRANSITION_INCIDENT", incident_id: selectedIncident.id, transition: action, note: incidentNote || undefined }) });
      setSelectedIncident(undefined); setIncidentNote(""); await reload(`Incident ${label(action).toLowerCase()} state recorded.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update incident"); }
    finally { setBusy(undefined); }
  }

  if (error && !data) return <section className={styles.state}><AlertTriangle /><div><h2>Engineering control center unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Resolving engineering authority</h2><p>Loading only projects, repositories and runtime references within your permission scope.</p></div></section>;

  const activeIncidents = data.incidents.filter((incident) => incident.status !== "RESOLVED");
  const failedDeployments = data.deployments.filter((deployment) => deployment.status === "FAILED");
  const productionServices = data.services.filter((service) => service.environment === "PRODUCTION");

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>ENGINEERING CONTROL CENTER</p><h2>Products, services, deployments and incidents in one governed view.</h2><span>Provider health appears only from stored evidence. Secrets are never exposed in this workspace.</span></div><div className={styles.heroActions}>{data.can_register_service ? <button type="button" onClick={() => setCreate("service")}><Plus /> Register service</button> : null}{data.services.some((service) => service.permissions.issue_manage) ? <button type="button" onClick={() => { const candidate = data.services.find((service) => service.permissions.issue_manage); setIncidentDraft({ ...emptyIncident, service: candidate?.id ?? "", owner: data.actor.user_id }); setCreate("incident"); }}><AlertTriangle /> New incident</button> : null}</div></header>

    <div className={styles.metrics}><article><span>Visible services</span><strong>{data.services.length}</strong><small>{productionServices.length} production</small></article><article><span>Active incidents</span><strong>{activeIncidents.length}</strong><small>{activeIncidents.filter((incident) => incident.severity === "SEV1" || incident.severity === "SEV2").length} high severity</small></article><article><span>Deployment evidence</span><strong>{data.deployments.length}</strong><small>{failedDeployments.length} failed records</small></article><article><span>Managed projects</span><strong>{data.managed_projects.length}</strong><small>Infrastructure-change authority</small></article></div>

    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)}><X /></button></div> : null}
    {error ? <div className={styles.error}><AlertTriangle />{error}</div> : null}

    <div className={styles.tabs}>{(["services", "deployments", "incidents"] as const).map((item) => <button type="button" key={item} data-active={view === item} onClick={() => setView(item)}>{label(item)}</button>)}</div>

    {view === "services" ? <div className={styles.serviceGrid}>{data.services.length ? data.services.map((service) => <article className={styles.service} key={service.id}><header><div className={styles.serviceIcon}><ServerCog /></div><div><code>{service.service_code}</code><h3>{service.name}</h3></div><span data-env={service.environment}>{service.environment}</span></header><div className={styles.serviceBody}><dl><div><dt>Project</dt><dd>{service.project_key}</dd></div><div><dt>Product</dt><dd>{service.product_id ? productMap.get(service.product_id)?.name || service.product_id : "Unlinked"}</dd></div><div><dt>Repository</dt><dd>{service.repository_key || "Not linked"}</dd></div><div><dt>Runtime</dt><dd>{service.runtime_redacted ? "Restricted" : service.runtime_provider || "Not linked"}</dd></div></dl>{service.runtime_redacted ? <div className={styles.redacted}><ShieldCheck /> Runtime reference hidden by project permission.</div> : service.public_url ? <a href={service.public_url} target="_blank" rel="noreferrer">Open service URL →</a> : <small>No public URL recorded.</small>}</div><footer><span>{service.owner_team || "No owner team"}</span><div>{service.permissions.issue_manage ? <em>INCIDENTS</em> : null}{service.permissions.infrastructure_change ? <em>INFRA</em> : null}{service.permissions.production_request ? <em>PROD REQUEST</em> : null}</div></footer></article>) : <div className={styles.empty}><Boxes /><div><b>No engineering services registered</b><p>Register only real services; the system does not create placeholder infrastructure.</p></div></div>}</div> : null}

    {view === "deployments" ? <div className={styles.table}><div className={styles.tableHead}><span>Service</span><span>Provider</span><span>Revision</span><span>Environment</span><span>Status</span><span>Finished</span></div>{data.deployments.length ? data.deployments.map((deployment) => <article key={deployment.id}><span><b>{serviceMap.get(deployment.service_id)?.name || "Service"}</b><small>{deployment.source}</small></span><span><b>{deployment.provider}</b><small>{deployment.provider_deployment_id || "No provider id"}</small></span><span><b>{deployment.git_sha ? deployment.git_sha.slice(0, 10) : "—"}</b><small>{deployment.git_ref || "No git ref"}</small></span><span>{deployment.environment}</span><span data-status={deployment.status}>{label(deployment.status)}</span><span>{readable(deployment.finished_at || deployment.created_at)}</span></article>) : <div className={styles.empty}><GitBranch /><div><b>No deployment evidence recorded</b><p>This is intentionally empty until a trusted integration or verified import records a real deployment.</p></div></div>}</div> : null}

    {view === "incidents" ? <div className={styles.incidents}>{data.incidents.length ? data.incidents.map((incident) => <button type="button" key={incident.id} className={styles.incident} onClick={() => { setSelectedIncident(incident); setIncidentNote(""); }}><div className={styles.severity} data-severity={incident.severity}>{incident.severity}</div><div><code>{incident.incident_code}</code><b>{incident.title}</b><span>{serviceMap.get(incident.service_id)?.name || "Service"} · {label(incident.status)}</span><small>{incident.summary || "No incident summary."}</small></div><div className={styles.incidentMeta}><span>{readable(incident.started_at)}</span><b>{incident.owner_user_id ? peopleMap.get(incident.owner_user_id)?.display_name || "Assigned owner" : "Unassigned"}</b></div></button>) : <div className={styles.empty}><CheckCircle2 /><div><b>No incident records</b><p>Incidents will appear here when authorised engineering staff create them.</p></div></div>}</div> : null}

    {create === "service" ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setCreate(undefined)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Register engineering service" onMouseDown={(event) => event.stopPropagation()}><header><div><p>ENGINEERING SERVICE</p><h2>Register canonical runtime context</h2></div><button type="button" aria-label="Close" onClick={() => setCreate(undefined)}><X /></button></header><form onSubmit={createService}><label>Service name<input required minLength={2} maxLength={160} value={serviceDraft.name} onChange={(event) => setServiceDraft({ ...serviceDraft, name: event.target.value })} /></label><label>Project key<input required minLength={2} maxLength={120} value={serviceDraft.project} onChange={(event) => setServiceDraft({ ...serviceDraft, project: event.target.value })} placeholder="Must match your permitted PROJECT scope" /></label><label>Canonical product<select value={serviceDraft.product} onChange={(event) => setServiceDraft({ ...serviceDraft, product: event.target.value })}><option value="">No product link</option>{data.products.filter((product) => product.status === "ACTIVE").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className={styles.formGrid}><label>Repository provider<input maxLength={80} value={serviceDraft.repositoryProvider} onChange={(event) => setServiceDraft({ ...serviceDraft, repositoryProvider: event.target.value })} /></label><label>Repository key<input maxLength={240} value={serviceDraft.repository} onChange={(event) => setServiceDraft({ ...serviceDraft, repository: event.target.value })} placeholder="owner/repo" /></label></div><div className={styles.formGrid}><label>Runtime provider<input maxLength={80} value={serviceDraft.runtimeProvider} onChange={(event) => setServiceDraft({ ...serviceDraft, runtimeProvider: event.target.value })} placeholder="Railway, Vercel, AWS…" /></label><label>Runtime service reference<input maxLength={240} value={serviceDraft.runtimeService} onChange={(event) => setServiceDraft({ ...serviceDraft, runtimeService: event.target.value })} /></label></div><div className={styles.formGrid}><label>Environment<select value={serviceDraft.environment} onChange={(event) => setServiceDraft({ ...serviceDraft, environment: event.target.value })}>{["DEVELOPMENT","PREVIEW","STAGING","PRODUCTION"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Owner team<input maxLength={120} value={serviceDraft.ownerTeam} onChange={(event) => setServiceDraft({ ...serviceDraft, ownerTeam: event.target.value })} /></label></div><label>Public URL<input type="url" maxLength={600} value={serviceDraft.publicUrl} onChange={(event) => setServiceDraft({ ...serviceDraft, publicUrl: event.target.value })} /></label><div className={styles.guard}><ShieldCheck /><p>Store references only. API keys, deploy tokens, database passwords and other provider credentials never belong in this registry.</p></div><button className={styles.submit} type="submit" disabled={busy === "service"}>{busy === "service" ? <LoaderCircle className="spin" /> : <Plus />} Register service</button></form></aside></div> : null}

    {create === "incident" ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setCreate(undefined)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Create incident" onMouseDown={(event) => event.stopPropagation()}><header><div><p>INCIDENT</p><h2>Open an engineering incident</h2></div><button type="button" aria-label="Close" onClick={() => setCreate(undefined)}><X /></button></header><form onSubmit={createIncident}><label>Service<select required value={incidentDraft.service} onChange={(event) => setIncidentDraft({ ...incidentDraft, service: event.target.value })}><option value="">Choose service</option>{data.services.filter((service) => service.permissions.issue_manage).map((service) => <option key={service.id} value={service.id}>{service.service_code} · {service.name}</option>)}</select></label><label>Severity<select value={incidentDraft.severity} onChange={(event) => setIncidentDraft({ ...incidentDraft, severity: event.target.value })}>{["SEV1","SEV2","SEV3","SEV4"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Title<input required minLength={3} maxLength={180} value={incidentDraft.title} onChange={(event) => setIncidentDraft({ ...incidentDraft, title: event.target.value })} /></label><label>Summary<textarea rows={5} maxLength={6000} value={incidentDraft.summary} onChange={(event) => setIncidentDraft({ ...incidentDraft, summary: event.target.value })} /></label><label>Incident owner<select value={incidentDraft.owner} onChange={(event) => setIncidentDraft({ ...incidentDraft, owner: event.target.value })}><option value="">Current actor</option>{data.people.map((person) => <option key={person.user_id} value={person.user_id}>{person.display_name || person.job_title || person.user_id}</option>)}</select></label><button className={styles.submit} type="submit" disabled={busy === "incident" || !incidentDraft.service}>{busy === "incident" ? <LoaderCircle className="spin" /> : <AlertTriangle />} Open incident</button></form></aside></div> : null}

    {selectedIncident ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelectedIncident(undefined)}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Incident details" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{selectedIncident.incident_code} · {selectedIncident.severity}</p><h2>{selectedIncident.title}</h2></div><button type="button" aria-label="Close" onClick={() => setSelectedIncident(undefined)}><X /></button></header><div className={styles.modalBody}><p>{selectedIncident.summary || "No incident summary."}</p><div className={styles.incidentFacts}><span><small>Status</small><b>{label(selectedIncident.status)}</b></span><span><small>Service</small><b>{serviceMap.get(selectedIncident.service_id)?.name || "Service"}</b></span><span><small>Started</small><b>{readable(selectedIncident.started_at)}</b></span><span><small>Owner</small><b>{selectedIncident.owner_user_id ? peopleMap.get(selectedIncident.owner_user_id)?.display_name || "Assigned" : "Unassigned"}</b></span></div>{selectedIncident.can_manage ? <><label>Lifecycle note<textarea rows={3} maxLength={2000} value={incidentNote} onChange={(event) => setIncidentNote(event.target.value)} placeholder="Optional operational note" /></label><div className={styles.transitionActions}>{selectedIncident.status === "OPEN" ? <button type="button" disabled={busy === selectedIncident.id} onClick={() => void transition("MITIGATE")}><Activity /> Mitigating</button> : null}{["OPEN","MITIGATING"].includes(selectedIncident.status) ? <button type="button" disabled={busy === selectedIncident.id} onClick={() => void transition("MONITOR")}><CircleDot /> Monitoring</button> : null}{selectedIncident.status !== "RESOLVED" ? <button className={styles.resolve} type="button" disabled={busy === selectedIncident.id} onClick={() => void transition("RESOLVE")}><CheckCircle2 /> Resolve</button> : <button type="button" disabled={busy === selectedIncident.id} onClick={() => void transition("REOPEN")}><AlertTriangle /> Reopen</button>}</div></> : <div className={styles.redacted}><ShieldCheck /> You can view this incident but do not have issue-management authority for its project.</div>}</div></section></div> : null}
  </section>;
}
