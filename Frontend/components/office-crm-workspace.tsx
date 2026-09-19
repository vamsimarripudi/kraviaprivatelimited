"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CircleDollarSign, LoaderCircle, MessageSquareText, Plus, Search, ShieldCheck, Target, X } from "lucide-react";
import { officeMutation, officeQuery } from "@/lib/office/http-client";
import styles from "./office-crm-workspace.module.css";

const opportunityStages = ["QUALIFICATION","DISCOVERY","DEMO","PROPOSAL","NEGOTIATION","CONTRACTING","WON","LOST"] as const;
type OpportunityStage = (typeof opportunityStages)[number];
type LeadStage = "NEW" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED";

type Owner = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null };
type Customer = { id: string; legal_name: string; display_name?: string | null; status: string; country?: string | null; currency?: string | null };
type Product = { id: string; code: string; name: string; status: string; category?: string | null };
type Lead = { id: string; lead_code: string; account_name: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; source: string; stage: LeadStage; owner_user_id: string; estimated_value_minor?: number | null; currency: string; country?: string | null; notes?: string | null; converted_customer_id?: string | null; created_at: string; updated_at: string };
type Opportunity = { id: string; opportunity_code: string; lead_id?: string | null; customer_id?: string | null; product_id?: string | null; title: string; stage: OpportunityStage; owner_user_id: string; value_minor?: number | null; currency: string; expected_close_date?: string | null; next_step?: string | null; lost_reason?: string | null; won_at?: string | null; lost_at?: string | null; created_at: string; updated_at: string };
type Activity = { id: string; lead_id?: string | null; opportunity_id?: string | null; activity_type: string; subject: string; body?: string | null; occurred_at: string; actor_user_id: string };
type CrmData = { actor: { user_id: string; roles: string[]; department?: string | null }; scope: { source?: string | null; type?: string | null; key?: string | null }; can_write: boolean; owners: Owner[]; customers: Customer[]; products: Product[]; leads: Lead[]; opportunities: Opportunity[]; activities: Activity[] };

type LeadDraft = { owner: string; account: string; contact: string; email: string; phone: string; source: string; value: string; currency: string; country: string; notes: string };
type OpportunityDraft = { owner: string; lead: string; customer: string; product: string; title: string; value: string; currency: string; close: string; nextStep: string };

const emptyLead: LeadDraft = { owner: "", account: "", contact: "", email: "", phone: "", source: "OTHER", value: "", currency: "INR", country: "", notes: "" };
const emptyOpportunity: OpportunityDraft = { owner: "", lead: "", customer: "", product: "", title: "", value: "", currency: "INR", close: "", nextStep: "" };

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
    invalidate: "/api/office-crm",
  });
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function money(value?: number | null, currency = "INR") {
  if (typeof value !== "number") return "—";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); }
  catch { return `${currency} ${(value / 100).toLocaleString("en-IN")}`; }
}

function readableDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}

function minor(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined;
}

export function OfficeCrmWorkspace() {
  const [data, setData] = useState<CrmData>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"pipeline" | "leads" | "activity">("pipeline");
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState<"lead" | "opportunity">();
  const [leadDraft, setLeadDraft] = useState<LeadDraft>(emptyLead);
  const [opportunityDraft, setOpportunityDraft] = useState<OpportunityDraft>(emptyOpportunity);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity>();
  const [selectedLead, setSelectedLead] = useState<Lead>();
  const [stageDraft, setStageDraft] = useState<{ stage: OpportunityStage; nextStep: string; lostReason: string }>();
  const [leadStageDraft, setLeadStageDraft] = useState<{ stage: LeadStage; customer: string }>();
  const [activityDraft, setActivityDraft] = useState<{ lead?: string; opportunity?: string; type: string; subject: string; body: string }>();

  async function reload(message?: string) {
    const next = await json<CrmData>("/api/office-crm");
    setData(next);
    setNotice(message);
  }

  useEffect(() => {
    let alive = true;
    void json<CrmData>("/api/office-crm").then((next) => { if (alive) setData(next); }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load CRM");
    });
    return () => { alive = false; };
  }, []);

  const ownerMap = useMemo(() => new Map((data?.owners ?? []).map((owner) => [owner.user_id, owner])), [data?.owners]);
  const customerMap = useMemo(() => new Map((data?.customers ?? []).map((customer) => [customer.id, customer])), [data?.customers]);
  const productMap = useMemo(() => new Map((data?.products ?? []).map((product) => [product.id, product])), [data?.products]);
  const leadMap = useMemo(() => new Map((data?.leads ?? []).map((lead) => [lead.id, lead])), [data?.leads]);

  const filteredOpportunities = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.opportunities ?? [];
    return (data?.opportunities ?? []).filter((item) => `${item.opportunity_code} ${item.title} ${item.stage} ${item.next_step ?? ""}`.toLowerCase().includes(needle));
  }, [data?.opportunities, search]);
  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.leads ?? [];
    return (data?.leads ?? []).filter((item) => `${item.lead_code} ${item.account_name} ${item.contact_name ?? ""} ${item.contact_email ?? ""} ${item.stage}`.toLowerCase().includes(needle));
  }, [data?.leads, search]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_LEAD", owner_user_id: leadDraft.owner, account_name: leadDraft.account, contact_name: leadDraft.contact || undefined, contact_email: leadDraft.email || undefined, contact_phone: leadDraft.phone || undefined, source: leadDraft.source, value_minor: minor(leadDraft.value), currency: leadDraft.currency, country: leadDraft.country || undefined, notes: leadDraft.notes || undefined }) });
      setLeadDraft({ ...emptyLead, owner: data?.actor.user_id ?? "" }); setCreate(undefined); await reload("Lead created in the governed CRM pipeline.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create lead"); }
    finally { setBusy(false); }
  }

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_OPPORTUNITY", owner_user_id: opportunityDraft.owner, lead_id: opportunityDraft.lead || undefined, customer_id: opportunityDraft.customer || undefined, product_id: opportunityDraft.product || undefined, title: opportunityDraft.title, value_minor: minor(opportunityDraft.value), currency: opportunityDraft.currency, expected_close_date: opportunityDraft.close || undefined, next_step: opportunityDraft.nextStep || undefined }) });
      setOpportunityDraft({ ...emptyOpportunity, owner: data?.actor.user_id ?? "" }); setCreate(undefined); await reload("Opportunity added to the sales pipeline.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create opportunity"); }
    finally { setBusy(false); }
  }

  async function saveOpportunityStage() {
    if (!selectedOpportunity || !stageDraft) return;
    if (stageDraft.stage === "LOST" && stageDraft.lostReason.trim().length < 3) return;
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-crm", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SET_OPPORTUNITY_STAGE", opportunity_id: selectedOpportunity.id, stage: stageDraft.stage, next_step: stageDraft.nextStep || undefined, lost_reason: stageDraft.lostReason || undefined }) });
      setSelectedOpportunity(undefined); setStageDraft(undefined); await reload(stageDraft.stage === "WON" ? "Opportunity marked won. Contract, subscription and billing remain separate governed steps." : "Opportunity stage updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update opportunity"); }
    finally { setBusy(false); }
  }

  async function saveLeadStage() {
    if (!selectedLead || !leadStageDraft) return;
    if (leadStageDraft.stage === "CONVERTED" && !leadStageDraft.customer) return;
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-crm", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SET_LEAD_STAGE", lead_id: selectedLead.id, stage: leadStageDraft.stage, customer_id: leadStageDraft.customer || undefined }) });
      setSelectedLead(undefined); setLeadStageDraft(undefined); await reload("Lead stage updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update lead"); }
    finally { setBusy(false); }
  }

  async function logActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activityDraft) return;
    setBusy(true); setError(undefined);
    try {
      await json("/api/office-crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ADD_ACTIVITY", lead_id: activityDraft.lead || undefined, opportunity_id: activityDraft.opportunity || undefined, activity_type: activityDraft.type, subject: activityDraft.subject, body: activityDraft.body || undefined }) });
      setActivityDraft(undefined); await reload("CRM activity logged.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to log activity"); }
    finally { setBusy(false); }
  }

  if (error && !data) return <section className={styles.state}><Target /><div><h2>Sales CRM unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Opening sales CRM</h2><p>Resolving your sales permission and pipeline scope.</p></div></section>;

  const activePipeline = data.opportunities.filter((item) => !["WON", "LOST"].includes(item.stage));
  const pipelineValue = activePipeline.reduce((sum, item) => sum + (item.value_minor ?? 0), 0);
  const currency = activePipeline.find((item) => item.value_minor)?.currency ?? "INR";

  return <section className={styles.shell}>
    <header className={styles.hero}><div><p>SALES CRM</p><h2>Lead to commercial decision, without bypassing controls.</h2><span>{data.scope.type || "OWNER"} scope{data.scope.key ? ` · ${data.scope.key}` : ""} · Contract, subscription, invoice and payment stay downstream governed records.</span></div>{data.can_write ? <div className={styles.heroActions}><button type="button" onClick={() => { setLeadDraft({ ...emptyLead, owner: data.actor.user_id }); setCreate("lead"); }}><Plus /> Lead</button><button type="button" onClick={() => { setOpportunityDraft({ ...emptyOpportunity, owner: data.actor.user_id }); setCreate("opportunity"); }}><CircleDollarSign /> Opportunity</button></div> : <span className={styles.readOnly}><ShieldCheck /> Read only</span>}</header>

    <div className={styles.metrics}><article><span>Open pipeline</span><strong>{activePipeline.length}</strong><small>{money(pipelineValue, currency)} visible value</small></article><article><span>Leads</span><strong>{data.leads.length}</strong><small>{data.leads.filter((lead) => lead.stage === "QUALIFIED").length} qualified</small></article><article><span>Won</span><strong>{data.opportunities.filter((item) => item.stage === "WON").length}</strong><small>Requires downstream contracting/billing</small></article><article><span>Recent activity</span><strong>{data.activities.length}</strong><small>Latest visible CRM interactions</small></article></div>

    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)}><X /></button></div> : null}
    {error ? <div className={styles.error}>{error}</div> : null}

    <div className={styles.toolbar}><div className={styles.tabs}>{(["pipeline","leads","activity"] as const).map((item) => <button type="button" key={item} data-active={view === item} onClick={() => setView(item)}>{label(item)}</button>)}</div><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search CRM" /></label></div>

    {view === "pipeline" ? <div className={styles.pipeline}>{opportunityStages.map((stage) => <section className={styles.stage} key={stage}><header><div><span>{label(stage)}</span><b>{filteredOpportunities.filter((item) => item.stage === stage).length}</b></div><small>{money(filteredOpportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.value_minor ?? 0), 0), filteredOpportunities.find((item) => item.stage === stage)?.currency ?? "INR")}</small></header><div>{filteredOpportunities.filter((item) => item.stage === stage).map((item) => <button className={styles.card} type="button" key={item.id} onClick={() => { setSelectedOpportunity(item); setStageDraft({ stage: item.stage, nextStep: item.next_step ?? "", lostReason: item.lost_reason ?? "" }); }}><code>{item.opportunity_code}</code><strong>{item.title}</strong><span>{item.customer_id ? customerMap.get(item.customer_id)?.display_name || customerMap.get(item.customer_id)?.legal_name || "Customer" : item.lead_id ? leadMap.get(item.lead_id)?.account_name || "Lead" : "Unlinked prospect"}</span><div><b>{money(item.value_minor, item.currency)}</b><small>{item.expected_close_date ? `Close ${readableDate(item.expected_close_date)}` : "No close date"}</small></div>{item.next_step ? <p>Next · {item.next_step}</p> : null}</button>)}{!filteredOpportunities.some((item) => item.stage === stage) ? <div className={styles.columnEmpty}>No opportunities</div> : null}</div></section>)}</div> : null}

    {view === "leads" ? <div className={styles.leads}><div className={styles.tableHead}><span>Lead</span><span>Contact</span><span>Owner</span><span>Value</span><span>Stage</span></div>{filteredLeads.map((lead) => <button type="button" className={styles.leadRow} key={lead.id} onClick={() => { setSelectedLead(lead); setLeadStageDraft({ stage: lead.stage, customer: lead.converted_customer_id ?? "" }); }}><span><code>{lead.lead_code}</code><b>{lead.account_name}</b><small>{lead.source}</small></span><span><b>{lead.contact_name || "—"}</b><small>{lead.contact_email || lead.contact_phone || "No contact detail"}</small></span><span><b>{ownerMap.get(lead.owner_user_id)?.display_name || "Assigned user"}</b><small>{ownerMap.get(lead.owner_user_id)?.job_title || "CRM owner"}</small></span><span><b>{money(lead.estimated_value_minor, lead.currency)}</b><small>{lead.country || "—"}</small></span><span data-stage={lead.stage}>{label(lead.stage)} <ArrowRight /></span></button>)}{!filteredLeads.length ? <div className={styles.empty}>No matching leads.</div> : null}</div> : null}

    {view === "activity" ? <div className={styles.activityPanel}><header><div><p>ACTIVITY TIMELINE</p><h3>Calls, meetings, demos and follow-ups</h3></div>{data.can_write ? <button type="button" onClick={() => setActivityDraft({ type: "NOTE", subject: "", body: "" })}><Plus /> Log activity</button> : null}</header><div>{data.activities.length ? data.activities.map((activity) => <article key={activity.id}><div className={styles.activityIcon}><MessageSquareText /></div><div><span>{label(activity.activity_type)} · {readableDate(activity.occurred_at)}</span><b>{activity.subject}</b><p>{activity.body || "No additional note."}</p><small>{activity.opportunity_id ? `Opportunity ${data.opportunities.find((item) => item.id === activity.opportunity_id)?.opportunity_code ?? ""}` : `Lead ${data.leads.find((item) => item.id === activity.lead_id)?.lead_code ?? ""}`}</small></div></article>) : <div className={styles.empty}>No CRM activity logged yet.</div>}</div></div> : null}

    {create ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setCreate(undefined)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Create ${create}`} onMouseDown={(event) => event.stopPropagation()}><header><div><p>NEW {create.toUpperCase()}</p><h2>{create === "lead" ? "Capture a prospect" : "Create a commercial opportunity"}</h2></div><button type="button" aria-label="Close" onClick={() => setCreate(undefined)}><X /></button></header>{create === "lead" ? <form onSubmit={createLead}><label>Account / organisation<input required minLength={2} maxLength={180} value={leadDraft.account} onChange={(event) => setLeadDraft({ ...leadDraft, account: event.target.value })} /></label><div className={styles.formGrid}><label>Contact<input maxLength={180} value={leadDraft.contact} onChange={(event) => setLeadDraft({ ...leadDraft, contact: event.target.value })} /></label><label>Email<input type="email" maxLength={254} value={leadDraft.email} onChange={(event) => setLeadDraft({ ...leadDraft, email: event.target.value })} /></label></div><div className={styles.formGrid}><label>Phone<input maxLength={40} value={leadDraft.phone} onChange={(event) => setLeadDraft({ ...leadDraft, phone: event.target.value })} /></label><label>Source<input maxLength={80} value={leadDraft.source} onChange={(event) => setLeadDraft({ ...leadDraft, source: event.target.value })} /></label></div><label>Owner<select required value={leadDraft.owner} onChange={(event) => setLeadDraft({ ...leadDraft, owner: event.target.value })}>{data.owners.map((owner) => <option key={owner.user_id} value={owner.user_id}>{owner.display_name || owner.job_title || owner.user_id}</option>)}</select></label><div className={styles.formGrid}><label>Estimated value<input type="number" min="0" step="0.01" value={leadDraft.value} onChange={(event) => setLeadDraft({ ...leadDraft, value: event.target.value })} /></label><label>Currency<input required minLength={3} maxLength={3} value={leadDraft.currency} onChange={(event) => setLeadDraft({ ...leadDraft, currency: event.target.value.toUpperCase() })} /></label></div><label>Country<input maxLength={80} value={leadDraft.country} onChange={(event) => setLeadDraft({ ...leadDraft, country: event.target.value })} /></label><label>Notes<textarea rows={4} maxLength={4000} value={leadDraft.notes} onChange={(event) => setLeadDraft({ ...leadDraft, notes: event.target.value })} /></label><button className={styles.submit} type="submit" disabled={busy || !leadDraft.owner}>{busy ? <LoaderCircle className="spin" /> : <Plus />} Create lead</button></form> : <form onSubmit={createOpportunity}><label>Opportunity title<input required minLength={3} maxLength={180} value={opportunityDraft.title} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, title: event.target.value })} /></label><label>Owner<select required value={opportunityDraft.owner} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, owner: event.target.value })}>{data.owners.map((owner) => <option key={owner.user_id} value={owner.user_id}>{owner.display_name || owner.job_title || owner.user_id}</option>)}</select></label><label>Lead<select value={opportunityDraft.lead} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, lead: event.target.value })}><option value="">No lead link</option>{data.leads.filter((lead) => !["DISQUALIFIED"].includes(lead.stage)).map((lead) => <option key={lead.id} value={lead.id}>{lead.lead_code} · {lead.account_name}</option>)}</select></label><div className={styles.formGrid}><label>Canonical customer<select value={opportunityDraft.customer} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, customer: event.target.value })}><option value="">Not linked yet</option>{data.customers.filter((customer) => customer.status === "ACTIVE").map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name || customer.legal_name}</option>)}</select></label><label>Product<select value={opportunityDraft.product} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, product: event.target.value })}><option value="">Product not selected</option>{data.products.filter((product) => product.status === "ACTIVE").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div><div className={styles.formGrid}><label>Value<input type="number" min="0" step="0.01" value={opportunityDraft.value} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, value: event.target.value })} /></label><label>Currency<input required minLength={3} maxLength={3} value={opportunityDraft.currency} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, currency: event.target.value.toUpperCase() })} /></label></div><label>Expected close<input type="date" value={opportunityDraft.close} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, close: event.target.value })} /></label><label>Next step<textarea rows={3} maxLength={1000} value={opportunityDraft.nextStep} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, nextStep: event.target.value })} /></label><button className={styles.submit} type="submit" disabled={busy || !opportunityDraft.owner}>{busy ? <LoaderCircle className="spin" /> : <Plus />} Create opportunity</button></form>}</aside></div> : null}

    {selectedOpportunity && stageDraft ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelectedOpportunity(undefined)}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Opportunity details" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{selectedOpportunity.opportunity_code}</p><h2>{selectedOpportunity.title}</h2></div><button type="button" onClick={() => setSelectedOpportunity(undefined)} aria-label="Close"><X /></button></header><div className={styles.modalBody}><div className={styles.recordGrid}><span><small>Value</small><b>{money(selectedOpportunity.value_minor, selectedOpportunity.currency)}</b></span><span><small>Owner</small><b>{ownerMap.get(selectedOpportunity.owner_user_id)?.display_name || "Assigned user"}</b></span><span><small>Customer</small><b>{selectedOpportunity.customer_id ? customerMap.get(selectedOpportunity.customer_id)?.display_name || customerMap.get(selectedOpportunity.customer_id)?.legal_name || selectedOpportunity.customer_id : "Not linked"}</b></span><span><small>Product</small><b>{selectedOpportunity.product_id ? productMap.get(selectedOpportunity.product_id)?.name || selectedOpportunity.product_id : "Not linked"}</b></span></div>{data.can_write ? <><label>Stage<select value={stageDraft.stage} onChange={(event) => setStageDraft({ ...stageDraft, stage: event.target.value as OpportunityStage })}>{opportunityStages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label><label>Next step<textarea rows={3} maxLength={1000} value={stageDraft.nextStep} onChange={(event) => setStageDraft({ ...stageDraft, nextStep: event.target.value })} /></label>{stageDraft.stage === "LOST" ? <label>Lost reason<textarea required rows={3} minLength={3} maxLength={1000} value={stageDraft.lostReason} onChange={(event) => setStageDraft({ ...stageDraft, lostReason: event.target.value })} /></label> : null}<div className={styles.guard}><ShieldCheck /><p>Marking this WON does not create a contract, subscription, invoice or payment. Those stay in their own controlled workflows.</p></div><button className={styles.submit} type="button" disabled={busy || (stageDraft.stage === "LOST" && stageDraft.lostReason.trim().length < 3)} onClick={() => void saveOpportunityStage()}>Save stage</button></> : null}</div></section></div> : null}

    {selectedLead && leadStageDraft ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelectedLead(undefined)}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Lead details" onMouseDown={(event) => event.stopPropagation()}><header><div><p>{selectedLead.lead_code}</p><h2>{selectedLead.account_name}</h2></div><button type="button" onClick={() => setSelectedLead(undefined)} aria-label="Close"><X /></button></header><div className={styles.modalBody}><p className={styles.description}>{selectedLead.notes || "No additional lead notes."}</p>{data.can_write ? <><label>Stage<select value={leadStageDraft.stage} onChange={(event) => setLeadStageDraft({ ...leadStageDraft, stage: event.target.value as LeadStage })}>{["NEW","QUALIFIED","DISQUALIFIED","CONVERTED"].map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>{leadStageDraft.stage === "CONVERTED" ? <label>Canonical customer<select required value={leadStageDraft.customer} onChange={(event) => setLeadStageDraft({ ...leadStageDraft, customer: event.target.value })}><option value="">Choose existing customer</option>{data.customers.filter((customer) => customer.status === "ACTIVE").map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name || customer.legal_name}</option>)}</select></label> : null}<div className={styles.guard}><ShieldCheck /><p>Lead conversion links to an existing canonical customer. It never fabricates a customer record.</p></div><button className={styles.submit} type="button" disabled={busy || (leadStageDraft.stage === "CONVERTED" && !leadStageDraft.customer)} onClick={() => void saveLeadStage()}>Save lead stage</button></> : null}</div></section></div> : null}

    {activityDraft ? <div className={styles.backdrop} role="presentation" onMouseDown={() => setActivityDraft(undefined)}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Log CRM activity" onMouseDown={(event) => event.stopPropagation()}><header><div><p>CRM ACTIVITY</p><h2>Log an interaction</h2></div><button type="button" aria-label="Close" onClick={() => setActivityDraft(undefined)}><X /></button></header><form className={styles.modalBody} onSubmit={logActivity}><label>Attach to opportunity<select value={activityDraft.opportunity ?? ""} onChange={(event) => setActivityDraft({ ...activityDraft, opportunity: event.target.value || undefined, lead: undefined })}><option value="">Choose opportunity</option>{data.opportunities.map((item) => <option key={item.id} value={item.id}>{item.opportunity_code} · {item.title}</option>)}</select></label><label>Or lead<select value={activityDraft.lead ?? ""} onChange={(event) => setActivityDraft({ ...activityDraft, lead: event.target.value || undefined, opportunity: undefined })}><option value="">Choose lead</option>{data.leads.map((item) => <option key={item.id} value={item.id}>{item.lead_code} · {item.account_name}</option>)}</select></label><label>Type<select value={activityDraft.type} onChange={(event) => setActivityDraft({ ...activityDraft, type: event.target.value })}>{["NOTE","CALL","EMAIL","MEETING","DEMO","PROPOSAL","FOLLOW_UP"].map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label><label>Subject<input required minLength={2} maxLength={180} value={activityDraft.subject} onChange={(event) => setActivityDraft({ ...activityDraft, subject: event.target.value })} /></label><label>Notes<textarea rows={4} maxLength={4000} value={activityDraft.body} onChange={(event) => setActivityDraft({ ...activityDraft, body: event.target.value })} /></label><button className={styles.submit} type="submit" disabled={busy || (!activityDraft.lead && !activityDraft.opportunity)}>Log activity</button></form></section></div> : null}
  </section>;
}
