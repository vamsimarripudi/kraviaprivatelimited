"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Laptop, LoaderCircle, Search, ShieldCheck, SlidersHorizontal, UserCog, UsersRound, X } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import { EnterpriseCombobox } from "@/components/enterprise-combobox";
import styles from "./workforce-administration-panel.module.css";

type Tab = "people" | "profiles" | "permissions" | "devices" | "positions";
type Position = { code: string; label: string; family: string; level: number; is_manager: boolean; description: string };
type AccessProfile = { code: string; label: string; category: string; description: string; max_active_devices: number; requires_managed_device_for_high_risk: boolean; assignable_by_admin: boolean; owner_managed_only: boolean };
type ProfilePermission = { profile_code: string; permission_code: string; effect: "ALLOW" | "DENY"; default_scope_type: ScopeType };
type Permission = { code: string; module: string; action: string; label: string; description: string; sensitivity: string; high_risk: boolean; requires_managed_device: boolean };
type Department = { code: string; label: string; description: string };
type Job = { position_code: string; department_code: string; reports_to_user_id?: string | null; team_key?: string | null; product_key?: string | null; employment_type: string; status: string };
type UserProfile = { id: string; profile_code: string; scope_type: ScopeType; scope_key?: string | null; status: string; grant_reason?: string | null; expires_at?: string | null; active: boolean };
type Device = { id: string; user_id: string; device_label: string; device_kind: string; platform?: string | null; trust_state: string; company_managed: boolean; approved_at?: string | null; revoked_at?: string | null; last_seen_at?: string | null };
type Person = { user_id: string; email?: string | null; last_sign_in_at?: string | null; status: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; authorization_version: number; access_review_due_at?: string | null; roles: string[]; job?: Job | null; access_profiles: UserProfile[]; permission_overrides: Array<Record<string, unknown>>; devices: Device[] };
type State = { actor: { userId: string; email?: string; roles: string[] }; people: Person[]; positions: Position[]; access_profiles: AccessProfile[]; profile_permissions: ProfilePermission[]; permissions: Permission[]; departments: Department[]; devices: Device[] };
type ScopeType = "COMPANY" | "DEPARTMENT" | "TEAM" | "PRODUCT" | "PROJECT" | "REPOSITORY" | "COST_CENTER" | "OWN";

const scopeOptions = ["COMPANY", "DEPARTMENT", "TEAM", "PRODUCT", "PROJECT", "REPOSITORY", "COST_CENTER", "OWN"] as const;
const employmentTypes = ["EMPLOYEE", "CONTRACTOR", "INTERN", "TRAINEE", "ADVISOR", "PROFESSIONAL"] as const;
const deviceKinds = ["DESKTOP", "LAPTOP", "MOBILE", "TABLET", "OTHER"] as const;

async function json<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-access/workforce", { ...options, credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Workforce administration request failed");
  return payload as T;
}

function readable(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function initials(person: Person) {
  return (person.display_name || person.email || "KR").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function WorkforceAdministrationPanel({ identity }: { identity: OfficeIdentity }) {
  const [state, setState] = useState<State>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("people");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let alive = true;
    void json<State>().then((data) => { if (alive) setState(data); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load workforce administration"); });
    return () => { alive = false; };
  }, []);

  async function reload(message?: string) {
    const next = await json<State>();
    setState(next);
    if (message) setNotice(message);
  }

  async function mutate(body: Record<string, unknown>, success: string) {
    setPending(true);
    setNotice(undefined);
    try {
      await json({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await reload(success);
      return true;
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Workforce change failed");
      return false;
    } finally {
      setPending(false);
    }
  }

  const owner = identity.roles.includes("OWNER");
  const needle = query.trim().toLowerCase();
  const people = useMemo(() => (state?.people ?? []).filter((person) => !needle || `${person.display_name ?? ""} ${person.email ?? ""} ${person.job?.position_code ?? ""} ${person.primary_department ?? ""} ${person.roles.join(" ")}`.toLowerCase().includes(needle)), [needle, state?.people]);
  const selected = state?.people.find((person) => person.user_id === selectedId);

  if (error) return <section className={styles.state}><AlertTriangle /><div><h2>Workforce authorization unavailable</h2><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  if (!state) return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Loading workforce authorization</h2><p>Resolving positions, access profiles, scoped permissions and trusted devices.</p></div></section>;

  const tabs: Array<[Tab, string, number]> = [
    ["people", "People", state.people.length], ["positions", "Positions", state.positions.length], ["profiles", "Access profiles", state.access_profiles.length], ["permissions", "Permissions", state.permissions.length], ["devices", "Devices", state.devices.length],
  ];

  return <section className={styles.shell}>
    <div className={styles.hero}><div><p className="eyebrow">WORKFORCE AUTHORIZATION</p><h2>Position is context. Permission is power.</h2><p>Assign company position, reporting line, reusable access profile, resource scope, expiry and trusted-device policy independently. Every mutation remains bounded by OWNER/ADMIN authority.</p></div><div><article><span>Positions</span><strong>{state.positions.length}</strong></article><article><span>Profiles</span><strong>{state.access_profiles.length}</strong></article><article><span>Atomic permissions</span><strong>{state.permissions.length}</strong></article><article><span>Pending devices</span><strong>{state.devices.filter((device) => device.trust_state === "PENDING").length}</strong></article></div></div>

    {notice ? <div className={styles.notice}><ShieldCheck />{notice}<button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss"><X /></button></div> : null}

    <div className={styles.tabs}>{tabs.map(([key, label, count]) => <button key={key} type="button" data-active={tab === key} onClick={() => setTab(key)}><span>{label}</span><em>{count}</em></button>)}</div>
    <div className={styles.toolbar}><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab.replace("_", " ")}…`} /></label><span><SlidersHorizontal /> Least privilege · deny by default</span></div>

    {tab === "people" ? <PeopleView people={people} positions={state.positions} onSelect={setSelectedId} /> : null}
    {tab === "positions" ? <CatalogGrid items={state.positions.filter((item) => !needle || `${item.label} ${item.family} ${item.description}`.toLowerCase().includes(needle))} kind="position" /> : null}
    {tab === "profiles" ? <ProfileGrid profiles={state.access_profiles.filter((item) => !needle || `${item.label} ${item.category} ${item.description}`.toLowerCase().includes(needle))} mappings={state.profile_permissions} permissions={state.permissions} /> : null}
    {tab === "permissions" ? <PermissionGrid permissions={state.permissions.filter((item) => !needle || `${item.label} ${item.module} ${item.action} ${item.description}`.toLowerCase().includes(needle))} /> : null}
    {tab === "devices" ? <DeviceGrid devices={state.devices} people={state.people} onSelect={setSelectedId} /> : null}

    {selected ? <PersonDrawer person={selected} state={state} owner={owner} pending={pending} mutate={mutate} onClose={() => setSelectedId(undefined)} /> : null}
  </section>;
}

function PeopleView({ people, positions, onSelect }: { people: Person[]; positions: Position[]; onSelect: (id: string) => void }) {
  const positionMap = new Map(positions.map((position) => [position.code, position]));
  return <div className={styles.people}>{people.map((person) => {
    const position = person.job ? positionMap.get(person.job.position_code) : undefined;
    return <button key={person.user_id} type="button" onClick={() => onSelect(person.user_id)}><div className={styles.avatar}>{initials(person)}</div><span><b>{person.display_name || person.email || "KRAVIA member"}</b><small>{position?.label || person.job_title || "No position assigned"}</small><em>{person.job?.department_code || person.primary_department || "Unassigned"}{person.job?.team_key ? ` · ${person.job.team_key}` : ""}</em></span><div className={styles.personAccess}><strong>{person.access_profiles.filter((profile) => profile.active).length}</strong><small>profiles</small></div><div className={styles.personAccess}><strong>{person.devices.filter((device) => device.trust_state === "TRUSTED").length}</strong><small>trusted devices</small></div><i data-status={person.status}>{person.status}</i><ChevronRight /></button>;
  })}{!people.length ? <Empty title="No matching people" text="Try a different name, department, position or role." /> : null}</div>;
}

function CatalogGrid({ items, kind }: { items: Position[]; kind: "position" }) {
  return <div className={styles.catalog}>{items.map((item) => <article key={item.code}><div><span>{item.family}</span><em>L{item.level}</em></div><h3>{item.label}</h3><p>{item.description}</p><footer>{item.is_manager ? <b><UsersRound /> Manager position</b> : <b>Individual contributor</b>}<code>{item.code}</code></footer></article>)}</div>;
}

function ProfileGrid({ profiles, mappings, permissions }: { profiles: AccessProfile[]; mappings: ProfilePermission[]; permissions: Permission[] }) {
  const permissionMap = new Map(permissions.map((permission) => [permission.code, permission]));
  return <div className={styles.catalog}>{profiles.map((profile) => {
    const granted = mappings.filter((mapping) => mapping.profile_code === profile.code && mapping.effect === "ALLOW");
    const highRisk = granted.filter((mapping) => permissionMap.get(mapping.permission_code)?.high_risk).length;
    return <article key={profile.code}><div><span>{profile.category}</span><em>{profile.max_active_devices} devices</em></div><h3>{profile.label}</h3><p>{profile.description}</p><div className={styles.permissionPreview}>{granted.slice(0, 5).map((mapping) => <span key={mapping.permission_code}>{permissionMap.get(mapping.permission_code)?.label ?? mapping.permission_code}</span>)}{granted.length > 5 ? <span>+{granted.length - 5} more</span> : null}</div><footer><b data-risk={highRisk > 0}>{granted.length} permissions{highRisk ? ` · ${highRisk} high-risk` : ""}</b><code>{profile.code}</code></footer></article>;
  })}</div>;
}

function PermissionGrid({ permissions }: { permissions: Permission[] }) {
  return <div className={styles.permissionGrid}>{permissions.map((permission) => <article key={permission.code} data-risk={permission.high_risk}><div><span>{permission.module}</span><em>{permission.sensitivity}</em></div><h3>{permission.label}</h3><p>{permission.description}</p><footer><code>{permission.code}</code>{permission.requires_managed_device ? <b><Laptop /> Managed device</b> : null}</footer></article>)}</div>;
}

function DeviceGrid({ devices, people, onSelect }: { devices: Device[]; people: Person[]; onSelect: (id: string) => void }) {
  const peopleMap = new Map(people.map((person) => [person.user_id, person]));
  return <div className={styles.devices}>{devices.map((device) => { const person = peopleMap.get(device.user_id); return <button type="button" key={device.id} onClick={() => onSelect(device.user_id)}><Laptop /><span><b>{device.device_label}</b><small>{device.platform || device.device_kind}</small><em>{person?.display_name || person?.email || device.user_id}</em></span><i data-status={device.trust_state}>{device.trust_state}</i><strong>{device.company_managed ? "Managed" : "Personal"}</strong><ChevronRight /></button>; })}{!devices.length ? <Empty title="No devices registered" text="Device requests will appear here when workforce users register company or personal computers." /> : null}</div>;
}

function PersonDrawer({ person, state, owner, pending, mutate, onClose }: { person: Person; state: State; owner: boolean; pending: boolean; mutate: (body: Record<string, unknown>, success: string) => Promise<boolean>; onClose: () => void }) {
  const manageable = !person.roles.includes("OWNER") && (owner || (!person.roles.some((role) => ["DIRECTOR", "ADMIN"].includes(role)) && person.user_id !== state.actor.userId));
  const [section, setSection] = useState<"job" | "profiles" | "permissions" | "devices">("job");
  const positionOptions = state.positions.map((position) => ({ value: position.code, label: position.label, meta: `${position.family} · L${position.level}`, disabled: !owner && (position.family === "EXECUTIVE" || position.level >= 8) }));
  const departmentOptions = state.departments.map((department) => ({ value: department.code, label: department.label, meta: department.description }));
  const positionMap = new Map(state.positions.map((position) => [position.code, position]));
  const managerOptions = state.people.filter((candidate) => candidate.user_id !== person.user_id && (candidate.roles.includes("OWNER") || candidate.roles.includes("DIRECTOR") || Boolean(candidate.job && positionMap.get(candidate.job.position_code)?.is_manager))).map((candidate) => ({ value: candidate.user_id, label: candidate.display_name || candidate.email || "KRAVIA manager", meta: candidate.job ? positionMap.get(candidate.job.position_code)?.label : candidate.roles.join(" · ") }));
  const profileOptions = state.access_profiles.map((profile) => ({ value: profile.code, label: profile.label, meta: `${profile.category} · ${profile.max_active_devices} devices`, disabled: !owner && (!profile.assignable_by_admin || profile.owner_managed_only) }));
  const permissionOptions = state.permissions.map((permission) => ({ value: permission.code, label: permission.label, meta: `${permission.module} · ${permission.sensitivity}${permission.high_risk ? " · HIGH RISK" : ""}` }));

  return <div className={styles.drawerBackdrop} role="presentation" onMouseDown={onClose}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Workforce administration for ${person.display_name || person.email}`} onMouseDown={(event) => event.stopPropagation()}>
    <header><div className={styles.personHeader}><div className={styles.avatar}>{initials(person)}</div><span><p>WORKFORCE IDENTITY</p><h2>{person.display_name || person.email}</h2><small>{person.email} · {person.roles.join(" · ")}</small></span></div><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
    <div className={styles.drawerFacts}><span><b>{person.status}</b><small>Identity</small></span><span><b>{person.authorization_version}</b><small>Authz revision</small></span><span><b>{person.access_profiles.filter((profile) => profile.active).length}</b><small>Active profiles</small></span><span><b>{person.devices.filter((device) => device.trust_state === "TRUSTED").length}</b><small>Trusted devices</small></span></div>
    {!manageable ? <div className={styles.protected}><ShieldCheck /><p>{person.roles.includes("OWNER") ? "Protected OWNER authority cannot be changed through ordinary workforce administration." : "This privileged identity is outside your delegated ADMIN boundary."}</p></div> : null}
    <nav className={styles.drawerTabs}>{(["job", "profiles", "permissions", "devices"] as const).map((key) => <button type="button" key={key} data-active={section === key} onClick={() => setSection(key)}>{key === "job" ? "Position & reporting" : key === "profiles" ? "Access profiles" : key === "permissions" ? "Permission exceptions" : "Devices"}</button>)}</nav>
    {section === "job" ? <JobForm person={person} positions={positionOptions} departments={departmentOptions} managers={managerOptions} pending={pending || !manageable} mutate={mutate} /> : null}
    {section === "profiles" ? <ProfileForm person={person} profiles={profileOptions} allProfiles={state.access_profiles} mappings={state.profile_permissions} permissions={state.permissions} pending={pending || !manageable} mutate={mutate} /> : null}
    {section === "permissions" ? <PermissionForm person={person} options={permissionOptions} permissions={state.permissions} owner={owner} pending={pending || !manageable} mutate={mutate} /> : null}
    {section === "devices" ? <DevicePanel person={person} pending={pending || !manageable} mutate={mutate} /> : null}
  </aside></div>;
}

function JobForm({ person, positions, departments, managers, pending, mutate }: { person: Person; positions: Array<{ value: string; label: string; meta?: string; disabled?: boolean }>; departments: Array<{ value: string; label: string; meta?: string }>; managers: Array<{ value: string; label: string; meta?: string }>; pending: boolean; mutate: (body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [position, setPosition] = useState(person.job?.position_code ?? "");
  const [department, setDepartment] = useState(person.job?.department_code ?? person.primary_department ?? "");
  const [manager, setManager] = useState(person.job?.reports_to_user_id ?? "");
  const [employment, setEmployment] = useState(person.job?.employment_type ?? "EMPLOYEE");
  const [team, setTeam] = useState(person.job?.team_key ?? "");
  const [product, setProduct] = useState(person.job?.product_key ?? "");
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); await mutate({ action: "ASSIGN_JOB", target_user_id: person.user_id, position, department, reports_to: manager || undefined, team_key: team || undefined, product_key: product || undefined, employment_type: employment, reason }, "Position and reporting line updated."); setReason(""); }
  return <form className={styles.drawerForm} onSubmit={submit}><div className={styles.sectionIntro}><UserCog /><div><b>Position and reporting line</b><p>Job context controls routing and org structure. It does not directly grant business permissions.</p></div></div><EnterpriseCombobox label="Position" value={position} options={positions} onChange={setPosition} disabled={pending} /><EnterpriseCombobox label="Department" value={department} options={departments} onChange={setDepartment} disabled={pending} /><EnterpriseCombobox label="Reports to" value={manager} options={[{ value: "", label: "No reporting manager", meta: "Top-level or externally governed" }, ...managers]} onChange={setManager} disabled={pending} /><div className={styles.formGrid}><label>Employment type<select value={employment} onChange={(event) => setEmployment(event.target.value)} disabled={pending}>{employmentTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Team scope<input value={team} onChange={(event) => setTeam(event.target.value)} placeholder="e.g. Platform" disabled={pending} /></label><label>Product scope<input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="e.g. VidyaLuma" disabled={pending} /></label><label>Business reason<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} /></label></div><button type="submit" disabled={pending || !position || !department || reason.trim().length < 3}>{pending ? <LoaderCircle className="spin" /> : <Check />} Save workforce assignment</button></form>;
}

function ProfileForm({ person, profiles, allProfiles, mappings, permissions, pending, mutate }: { person: Person; profiles: Array<{ value: string; label: string; meta?: string; disabled?: boolean }>; allProfiles: AccessProfile[]; mappings: ProfilePermission[]; permissions: Permission[]; pending: boolean; mutate: (body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [profile, setProfile] = useState(""); const [scope, setScope] = useState<ScopeType>("COMPANY"); const [scopeKey, setScopeKey] = useState(""); const [expiry, setExpiry] = useState(""); const [reason, setReason] = useState("");
  const permissionMap = new Map(permissions.map((permission) => [permission.code, permission]));
  const selected = allProfiles.find((item) => item.code === profile);
  const preview = mappings.filter((mapping) => mapping.profile_code === profile && mapping.effect === "ALLOW");
  async function assign(event: FormEvent) { event.preventDefault(); const ok = await mutate({ action: "ASSIGN_PROFILE", target_user_id: person.user_id, profile, scope_type: scope, scope_key: scopeKey || undefined, expires_at: expiry ? new Date(expiry).toISOString() : undefined, reason }, `${selected?.label ?? profile} assigned.`); if (ok) { setReason(""); setScopeKey(""); setExpiry(""); } }
  async function revoke(assignment: UserProfile) { await mutate({ action: "REVOKE_PROFILE", target_user_id: person.user_id, assignment_id: assignment.id, reason: `Access profile ${assignment.profile_code} revoked through Office administration` }, `${assignment.profile_code} revoked.`); }
  return <div className={styles.drawerStack}><form className={styles.drawerForm} onSubmit={assign}><div className={styles.sectionIntro}><ShieldCheck /><div><b>Assign reusable access profile</b><p>Profiles grant atomic permissions only inside the selected resource scope and optional expiry.</p></div></div><EnterpriseCombobox label="Access profile" value={profile} options={profiles} onChange={setProfile} disabled={pending} /><div className={styles.formGrid}><label>Scope<select value={scope} onChange={(event) => setScope(event.target.value as ScopeType)} disabled={pending}>{scopeOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Scope key<input value={scopeKey} onChange={(event) => setScopeKey(event.target.value)} placeholder={scope === "REPOSITORY" ? "vidyaluma/web" : scope === "PRODUCT" ? "VidyaLuma" : "Optional when scope is broad"} disabled={pending} /></label><label>Expires<input type="datetime-local" value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={pending} /></label><label>Business reason<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} /></label></div>{selected ? <div className={styles.profilePreview}><header><span><b>{selected.label}</b><small>{selected.category} · max {selected.max_active_devices} active devices</small></span>{selected.requires_managed_device_for_high_risk ? <em><Laptop /> managed device for high-risk</em> : null}</header><div>{preview.map((mapping) => { const permission = permissionMap.get(mapping.permission_code); return <span key={mapping.permission_code} data-risk={permission?.high_risk}>{permission?.label ?? mapping.permission_code}<small>{mapping.default_scope_type}</small></span>; })}</div></div> : null}<button type="submit" disabled={pending || !profile || reason.trim().length < 3}>{pending ? <LoaderCircle className="spin" /> : <Check />} Assign profile</button></form><div className={styles.assignments}><h3>Current profile assignments</h3>{person.access_profiles.map((assignment) => <article key={assignment.id} data-active={assignment.active}><span><b>{assignment.profile_code}</b><small>{assignment.scope_type}{assignment.scope_key ? ` · ${assignment.scope_key}` : ""}{assignment.expires_at ? ` · until ${readable(assignment.expires_at)}` : ""}</small></span><em>{assignment.active ? "ACTIVE" : assignment.status}</em>{assignment.active ? <button type="button" disabled={pending} onClick={() => void revoke(assignment)}>Revoke</button> : null}</article>)}{!person.access_profiles.length ? <p>No access profile assigned.</p> : null}</div></div>;
}

function PermissionForm({ person, options, permissions, owner, pending, mutate }: { person: Person; options: Array<{ value: string; label: string; meta?: string }>; permissions: Permission[]; owner: boolean; pending: boolean; mutate: (body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [permission, setPermission] = useState(""); const [effect, setEffect] = useState<"ALLOW" | "DENY">("DENY"); const [scope, setScope] = useState<ScopeType>("COMPANY"); const [scopeKey, setScopeKey] = useState(""); const [expiry, setExpiry] = useState(""); const [reason, setReason] = useState("");
  const selected = permissions.find((item) => item.code === permission); const restrictedAllow = effect === "ALLOW" && !owner && Boolean(selected?.high_risk || ["HIGH", "CRITICAL"].includes(selected?.sensitivity ?? ""));
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await mutate({ action: "SET_PERMISSION", target_user_id: person.user_id, permission, effect, scope_type: scope, scope_key: scopeKey || undefined, expires_at: expiry ? new Date(expiry).toISOString() : undefined, reason }, `${permission} ${effect} override recorded.`); if (ok) setReason(""); }
  return <div className={styles.drawerStack}><form className={styles.drawerForm} onSubmit={submit}><div className={styles.sectionIntro}><SlidersHorizontal /><div><b>Permission exception</b><p>Use explicit DENY to narrow a profile. Individual ALLOW is exceptional; high-risk ALLOW is OWNER-controlled.</p></div></div><EnterpriseCombobox label="Atomic permission" value={permission} options={options} onChange={setPermission} disabled={pending} /><div className={styles.effectToggle}><button type="button" data-active={effect === "DENY"} onClick={() => setEffect("DENY")}>DENY</button><button type="button" data-active={effect === "ALLOW"} onClick={() => setEffect("ALLOW")}>ALLOW</button></div><div className={styles.formGrid}><label>Scope<select value={scope} onChange={(event) => setScope(event.target.value as ScopeType)} disabled={pending}>{scopeOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Scope key<input value={scopeKey} onChange={(event) => setScopeKey(event.target.value)} disabled={pending} /></label><label>Expires<input type="datetime-local" value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={pending} /></label><label>Business reason<input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} /></label></div>{selected ? <div className={styles.permissionImpact} data-risk={selected.high_risk}><b>{selected.label}</b><span>{selected.module} · {selected.sensitivity}{selected.requires_managed_device ? " · managed device" : ""}</span><p>{selected.description}</p>{restrictedAllow ? <em>OWNER authority is required to create this high-risk ALLOW exception.</em> : null}</div> : null}<button type="submit" disabled={pending || !permission || reason.trim().length < 3 || restrictedAllow}>{pending ? <LoaderCircle className="spin" /> : <Check />} Record permission exception</button></form><div className={styles.assignments}><h3>Existing exceptions</h3>{person.permission_overrides.map((override, index) => <article key={String(override.id ?? index)}><span><b>{String(override.permission_code ?? "Permission")}</b><small>{String(override.scope_type ?? "COMPANY")}{override.scope_key ? ` · ${String(override.scope_key)}` : ""}</small></span><em data-effect={String(override.effect ?? "")}>{String(override.effect ?? "")}</em></article>)}{!person.permission_overrides.length ? <p>No individual permission exceptions.</p> : null}</div></div>;
}

function DevicePanel({ person, pending, mutate }: { person: Person; pending: boolean; mutate: (body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [label, setLabel] = useState(""); const [kind, setKind] = useState("LAPTOP"); const [platform, setPlatform] = useState(""); const [reason, setReason] = useState("");
  async function register(event: FormEvent) { event.preventDefault(); const ok = await mutate({ action: "REGISTER_DEVICE", target_user_id: person.user_id, label, kind, platform: platform || undefined }, "Device registered as PENDING."); if (ok) { setLabel(""); setPlatform(""); } }
  async function trust(device: Device, action: "APPROVE" | "REVOKE") { await mutate({ action: "DEVICE_TRUST", target_user_id: person.user_id, device_id: device.id, trust_action: action, company_managed: action === "APPROVE", reason: reason || `${action === "APPROVE" ? "Approved" : "Revoked"} through Office device administration` }, `Device ${action === "APPROVE" ? "trusted" : "revoked"}.`); setReason(""); }
  return <div className={styles.drawerStack}><form className={styles.drawerForm} onSubmit={register}><div className={styles.sectionIntro}><Laptop /><div><b>Register device</b><p>Registration creates PENDING trust only. High-risk permissions can require a separately approved company-managed device.</p></div></div><div className={styles.formGrid}><label>Device label<input required minLength={2} maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} disabled={pending} placeholder="Vamsi MacBook Pro" /></label><label>Kind<select value={kind} onChange={(event) => setKind(event.target.value)} disabled={pending}>{deviceKinds.map((item) => <option key={item}>{item}</option>)}</select></label><label>Platform<input maxLength={120} value={platform} onChange={(event) => setPlatform(event.target.value)} disabled={pending} placeholder="macOS / Windows / Linux" /></label><label>Decision reason<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} placeholder="Used for approve/revoke" /></label></div><button type="submit" disabled={pending || label.trim().length < 2}>{pending ? <LoaderCircle className="spin" /> : <Laptop />} Register pending device</button></form><div className={styles.deviceCards}>{person.devices.map((device) => <article key={device.id}><Laptop /><span><b>{device.device_label}</b><small>{device.platform || device.device_kind} · last seen {readable(device.last_seen_at)}</small></span><em data-status={device.trust_state}>{device.trust_state}</em><strong>{device.company_managed ? "Company managed" : "Not managed"}</strong><div>{device.trust_state === "PENDING" ? <button type="button" disabled={pending} onClick={() => void trust(device, "APPROVE")}>Approve</button> : null}{device.trust_state !== "REVOKED" ? <button type="button" disabled={pending} onClick={() => void trust(device, "REVOKE")}>Revoke</button> : null}</div></article>)}{!person.devices.length ? <Empty title="No registered devices" text="Register a device here or let the user initiate device onboarding later." /> : null}</div></div>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className={styles.empty}><ShieldCheck /><div><b>{title}</b><p>{text}</p></div></div>; }
