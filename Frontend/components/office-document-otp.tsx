"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BadgeCheck, FileSignature, LoaderCircle, MailCheck, MapPin, ShieldCheck, X } from "lucide-react";
import styles from "./office-document-otp.module.css";

export type DocumentOtpApproval = {
  id: string; document_instance_id: string; render_id: string;
  signer_name: string; employee_reference: string; signer_email_masked: string;
  latitude: number; longitude: number; accuracy_m: number;
  location_captured_at: string; location_source: string;
  approved_at: string; render_sha256: string; status: "APPROVED";
  method: "FIRST_PARTY_EMAIL_OTP";
};
type Assigned = {
  id: string; title: string; document_code: string; render_id: string;
  sha256: string; approved: DocumentOtpApproval | null; can_approve: boolean;
};
type Listing = {
  documents: Assigned[]; employee_reference: string | null;
  masked_email: string; note: string;
};
type Challenge = {
  challenge_id: string; masked_email: string;
  expires_at: string; document_code: string;
};

function ist(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "Timestamp unavailable"
    : new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "short",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(parsed) + " IST";
}
function coordinate(value: number) {
  return Number.isFinite(value) ? Number(value).toFixed(6) : "Unavailable";
}
async function request<T>(options?: RequestInit) {
  const response = await fetch("/api/office-documents/otp", {
    ...options, cache: "no-store", credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({})) as { detail?: string };
  if (!response.ok) throw new Error(data.detail || "Document OTP service unavailable");
  return data as T;
}

export function OfficeDocumentOtpStamp({ approval }: { approval: DocumentOtpApproval }) {
  return <section className={styles.stamp} aria-label="OTP-verified internal document approval">
    <div className={styles.stampTitle}><BadgeCheck size={19} aria-hidden="true"/>
      <strong>APPROVED · EMAIL OTP</strong></div>
    <div className={styles.stampGrid}>
      <span>Approved by <b>{approval.signer_name}</b></span>
      <span>Employee ID <b>{approval.employee_reference}</b></span>
      <span>Verified at <b>{ist(approval.approved_at)}</b></span>
      <span>Verified email <b>{approval.signer_email_masked}</b></span>
      <span>Latitude <b>{coordinate(Number(approval.latitude))}°</b></span>
      <span>Longitude <b>{coordinate(Number(approval.longitude))}°</b></span>
      <span>Location accuracy <b>±{Number(approval.accuracy_m).toFixed(1)} m</b></span>
    </div>
    <small><MapPin size={12} aria-hidden="true"/>
      Coordinates were reported by the signer's permitted browser location service
      at {ist(approval.location_captured_at)}. They are not independently GPS-attested.
    </small>
    <small>Internal approval receipt bound to the document PDF hash. Not a certificate-based digital signature.</small>
  </section>;
}

export function OfficeDocumentOtpButton({
  instanceId, renderId, documentCode, onApproved,
}: {
  instanceId: string; renderId: string; documentCode: string; onApproved?: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [approval, setApproval] = useState<DocumentOtpApproval>();
  const dialog = useRef<HTMLDialogElement>(null);
  const fieldId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (opened && node && !node.open) node.showModal();
    else if (!opened && node?.open) node.close();
  }, [opened]);

  async function open() {
    setError(""); setChallenge(undefined); setCode(""); setEmail(""); setEmployeeId(null);
    setOpened(true); setLoading(true);
    try {
      const listing = await request<Listing>();
      const item = listing.documents.find(x => x.id === instanceId && x.render_id === renderId);
      if (!item) throw new Error("The current signed-in person is not assigned to this document.");
      if (item.approved) { setApproval(item.approved); setOpened(false); return; }
      setEmail(listing.masked_email);
      setEmployeeId(listing.employee_reference);
      if (!item.can_approve) throw new Error("An approved PDF and an issued employee ID are required.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document assignment unavailable");
    } finally { setLoading(false); }
  }

  async function send() {
    setError("");setLoading(true);
    try {
      const next = await request<Challenge>({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST", instance_id: instanceId, render_id: renderId }),
      });
      setChallenge(next); setEmail(next.masked_email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "OTP mail was not confirmed");
    } finally { setLoading(false); }
  }

  function freshDeviceLocation(): Promise<{
    latitude: number; longitude: number; accuracy_m: number; captured_at: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext || !navigator.geolocation) {
        reject(new Error("Location permission requires a secure browser connection (HTTPS)."));
        return;
      }
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = new Date(position.timestamp);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 5000 ||
            !Number.isFinite(timestamp.getTime())) {
          reject(new Error("Location accuracy is insufficient or unavailable. No coordinates will be invented."));
          return;
        }
        resolve({
          latitude, longitude, accuracy_m: accuracy, captured_at: timestamp.toISOString(),
        });
      }, (cause) => {
        reject(new Error(cause.code === 1
          ? "Location permission was denied. Approval has not been recorded."
          : "Current device location is unavailable. Approval has not been recorded."));
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    });
  }

  async function verify() {
    if (!challenge || !/^\d{6}$/.test(code)) {
      setError("Enter the six digits sent to your verified email."); return;
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      setError("This OTP has expired. Request a new one after the cooldown."); return;
    }
    setError("");setLoading(true);
    try {
      // Only ask for location after the signer deliberately submits their code.
      // The browser's reported device coordinates are never a GPS attestation.
      const location = await freshDeviceLocation();
      const result = await request<{ approval: DocumentOtpApproval }>({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY", instance_id: instanceId, render_id: renderId,
          challenge_id: challenge.challenge_id, code, location,
        }),
      });
      setApproval(result.approval);
      setChallenge(undefined); setCode(""); setOpened(false);
      onApproved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "OTP verification was not completed");
    } finally { setLoading(false); }
  }

  return <>
    {approval ? <OfficeDocumentOtpStamp approval={approval}/> :
      <button className={styles.approveButton} type="button" onClick={() => void open()}>
        <FileSignature size={16} aria-hidden="true"/> eSign · Approve with OTP
      </button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={fieldId}
      onClose={() => setOpened(false)} onCancel={() => setOpened(false)}>
      <header className={styles.dialogHead}>
        <div><small>FIRST-PARTY DOCUMENT APPROVAL</small><h3 id={fieldId}>{documentCode}</h3></div>
        <button type="button" aria-label="Close OTP approval" disabled={loading}
          onClick={() => setOpened(false)}><X size={17}/></button>
      </header>
      <div className={styles.dialogBody}>
        <p>This approval belongs to your signed-in Office identity. It cannot approve another person's document.</p>
        {loading && !email ? <p role="status"><LoaderCircle size={14}/> Verifying signer identity…</p> : null}
        {email ? <div className={styles.email}>
          <MailCheck size={18} aria-hidden="true"/>
          <span>Verification email <b>{email}</b></span>
        </div> : null}
        {employeeId ? <p className={styles.employee}>Employee ID: <strong>{employeeId}</strong></p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {!challenge && email && employeeId ? <button type="button" className={styles.primary}
          disabled={loading} onClick={() => void send()}>
          {loading ? "Sending…" : "Send six-digit email OTP"}
        </button> : null}
        {challenge ? <>
          <label className={styles.codeLabel} htmlFor={fieldId + "-code"}>Enter six-digit OTP</label>
          <input id={fieldId + "-code"} type="text" inputMode="numeric" autoComplete="one-time-code"
            value={code} maxLength={6} pattern="[0-9]{6}" disabled={loading}
            onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"/>
          <small>Code expires at {ist(challenge.expires_at)}. Your location permission is requested when you confirm.</small>
          <button type="button" className={styles.primary} disabled={loading || code.length !== 6}
            onClick={() => void verify()}>
            <ShieldCheck size={15} aria-hidden="true"/>
            {loading ? "Verifying…" : "Verify OTP & approve document"}
          </button>
        </> : null}
        <p className={styles.finePrint}>
          The approval records the actual employee reference, server timestamp and
          browser-reported latitude/longitude with accuracy. If location is denied
          or unavailable, no approval is recorded. This is not a licensed digital signature.
        </p>
      </div>
    </dialog>
  </>;
}

export function OfficeDocumentOtpPanel() {
  const [listing, setListing] = useState<Listing>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh() {
    setLoading(true);
    try { setListing(await request<Listing>()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Approval records unavailable"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  return <section className={styles.panel} aria-label="My document email OTP approvals">
    <header><FileSignature size={20} aria-hidden="true"/>
      <div><h3>My document approvals</h3>
        <p>Verify your own email OTP before approving a real assigned PDF.</p></div>
    </header>
    {loading ? <p>Checking assigned documents…</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!loading && listing && !listing.documents.length ?
      <p className={styles.empty}>No approved PDF is currently assigned to your Office identity.</p> : null}
    {listing && !listing.employee_reference ?
      <p className={styles.error}>Your permanent employee ID has not been issued. OTP approval is blocked until it exists.</p> : null}
    {listing?.documents.map(item => <article className={styles.assignment} key={item.id}>
      <div><strong>{item.title}</strong><small>{item.document_code}</small></div>
      {item.approved ? <OfficeDocumentOtpStamp approval={item.approved}/> :
        item.can_approve ? <OfficeDocumentOtpButton
          instanceId={item.id} renderId={item.render_id} documentCode={item.document_code}
          onApproved={() => void refresh()}/> :
        <span className={styles.pending}>Employee reference pending</span>}
    </article>)}
    <p className={styles.finePrint}>Locations are captured only with browser permission and are not independently attested.</p>
  </section>;
}
