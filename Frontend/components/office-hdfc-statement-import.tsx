"use client";

import {useMemo,useState} from "react";
import {BadgeCheck,CircleAlert,FileSpreadsheet,Landmark,LoaderCircle,LockKeyhole,ShieldCheck,X} from "lucide-react";
import styles from "./office-hdfc-statement-import.module.css";

type Account={id:string;bank_name:string;account_name:string;masked_account:string;currency:string;status:string};
type PreviewRow={row:number;date:string;direction:"CREDIT"|"DEBIT";amount:string;reference:string;description:string;status:string};
type Preview={bank:string;account_masked:string;mode:"MANUAL_STATEMENT_EVIDENCE";live_bank_feed:false;
 digest:string;rows_total:number;new_rows:number;duplicates:number;conflicts:number;
 issues:{row:number;reason:string}[];preview_rows:PreviewRow[]};
type ImportResult={status:string;source:string;imported:number;duplicates_skipped:number;live_bank_feed:false};

async function request<T>(action:"preview"|"confirm",payload:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/office-runtime/banking/hdfc/statement/"+action,{
  method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"HDFC statement review unavailable");
 return data as T;
}

export function OfficeHdfcStatementImport({accounts,canImport,disabled,onImported}:{
 accounts:Account[];canImport:boolean;disabled:boolean;onImported:(result:ImportResult)=>Promise<void>;
}){
 const allowed=useMemo(()=>accounts.filter(a=>a.status==="ACTIVE"&&a.bank_name.toLowerCase().includes("hdfc")&&a.currency==="INR"),[accounts]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [account,setAccount]=useState(""),[fileName,setFileName]=useState(""),[text,setText]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false);
 function close(){
  if(busy)return;
  setOpen(false);setText("");setFileName("");setPreview(null);setApproved(false);setError("");
 }
 async function load(file:File|null){
  setPreview(null);setApproved(false);setText("");setFileName("");setError("");
  if(!file)return;
  if(!/\.csv$/i.test(file.name)){setError("Upload a bank-exported .csv file. PDF/Excel statements require a separate verified parser.");return;}
  if(file.size>1_000_000||file.size<20){setError("HDFC statement must be between 20 bytes and 1 MB. Split large exports by date.");return;}
  try{
   const source=await file.text();
   if(source.length>750_000||source.includes("\u0000")){setError("The statement is too large or contains binary data.");return;}
   setText(source);setFileName(file.name);
  }catch{setError("Could not read the selected CSV statement");}
 }
 async function runPreview(){
  if(!account||!text)return;
  setError("");setBusy(true);setPreview(null);setApproved(false);
  try{setPreview(await request<Preview>("preview",{bank_account_id:account,csv_text:text}));}
  catch(e){setError(e instanceof Error?e.message:"Statement preview failed");}
  finally{setBusy(false);}
 }
 async function confirm(){
  if(!account||!preview||!approved||preview.issues.length||!text)return;
  setError("");setBusy(true);
  try{
   const result=await request<ImportResult>("confirm",{
    bank_account_id:account,csv_text:text,preview_digest:preview.digest,confirm:true
   });
   setOpen(false);setText("");setFileName("");setPreview(null);setApproved(false);
   await onImported(result);
  }catch(e){setError(e instanceof Error?e.message:"Statement import not confirmed");}
  finally{setBusy(false);}
 }
 return <section className={styles.summary} aria-label="HDFC account statement import">
  <div className={styles.about}>
   <Landmark size={18} aria-hidden="true"/>
   <div>
    <strong>HDFC Bank · statements</strong>
    <p>Manual ENet CSV evidence. Automatic bank API feed is not connected.</p>
   </div>
  </div>
  {canImport?<button type="button" className={styles.action} disabled={disabled||!allowed.length}
   title={!allowed.length?"Register an active masked HDFC account first":"Preview HDFC bank statement"}
   onClick={()=>{setOpen(true);setAccount(allowed[0]?.id??"");}}>
   <FileSpreadsheet size={17}/> Import CSV
  </button>:<span className={styles.readonly}><LockKeyhole size={15}/> Finance reviewer access required</span>}
  {!allowed.length?<p className={styles.hint}>Register an active, masked HDFC company account above before importing transactions.</p>:null}
  {open?<div className={styles.backdrop} role="presentation" onMouseDown={close}>
   <div role="dialog" aria-modal="true" aria-labelledby="office-hdfc-heading" className={styles.dialog}
    onMouseDown={e=>e.stopPropagation()}>
    <header className={styles.dialogHead}>
     <div><small>HDFC BANK · READ-ONLY BANK EVIDENCE</small><h3 id="office-hdfc-heading">Review account statement</h3></div>
     <button type="button" disabled={busy} aria-label="Close HDFC statement import" onClick={close}><X size={18}/></button>
    </header>
    <p className={styles.disclaimer}>The HDFC ENet export is supplied by you, not retrieved through a connected API.
     No transfers, bank credentials, OTPs or live balance updates occur here.</p>
    <div className={styles.fields}>
     <label>Masked HDFC account
      <select value={account} disabled={busy} onChange={e=>{setAccount(e.target.value);setPreview(null);setApproved(false);}}>
       {allowed.map(a=><option key={a.id} value={a.id}>{a.account_name} · {a.masked_account}</option>)}
      </select>
     </label>
     <label>CSV statement
      <input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void load(e.target.files?.[0]??null)}/>
     </label>
    </div>
    {fileName?<p className={styles.filename}><FileSpreadsheet size={14}/>{fileName}</p>:null}
    {error?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error}</p>:null}
    {preview?<div className={styles.preview}>
      <div className={styles.metrics}>
       <div><small>Transactions</small><strong>{preview.rows_total}</strong></div>
       <div><small>Ready to import</small><strong>{preview.new_rows}</strong></div>
       <div><small>Duplicates skipped</small><strong>{preview.duplicates}</strong></div>
       <div><small>Review issues</small><strong>{preview.issues.length}</strong></div>
      </div>
      {preview.issues.length?<div className={styles.issues} role="alert">
       <strong>Import blocked until these statement rows are corrected or recorded manually:</strong>
       {preview.issues.map(x=><p key={x.row}>{x.row}: {x.reason}</p>)}
      </div>:null}
      <div className={styles.tableWrap}><table><thead><tr><th>Row</th><th>Date</th><th>Type</th><th>Amount</th><th>Bank ref.</th><th>Review</th></tr></thead>
       <tbody>{preview.preview_rows.map(x=><tr key={x.row}>
        <td>{x.row}</td><td>{x.date}</td><td>{x.direction}</td><td>₹{x.amount}</td>
        <td>{x.reference}</td><td>{x.status}</td>
       </tr>)}</tbody></table></div>
      <p className={styles.hint}>Showing the first {preview.preview_rows.length} rows.
       A reviewed import records transaction evidence only; unmatched receipts still require reconciliation.</p>
      {!preview.issues.length?<label className={styles.approval}>
       <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} disabled={busy}/>
       I verified this HDFC export and masked company account. Record only new rows.
      </label>:null}
     </div>:null}
    <footer className={styles.footer}>
     <span><ShieldCheck size={15}/> Source: HDFC user export, not live sync</span>
     <button type="button" disabled={busy} onClick={close}>Cancel</button>
     {!preview?<button type="button" className={styles.primary} disabled={busy||!text||!account} onClick={()=>void runPreview()}>
      {busy?<LoaderCircle size={16} className={styles.spin}/>:<FileSpreadsheet size={16}/>} Preview rows</button>:
      <button type="button" className={styles.primary}
       disabled={busy||!approved||preview.issues.length>0||!preview.new_rows}
       onClick={()=>void confirm()}>
       {busy?<LoaderCircle size={16} className={styles.spin}/>:<BadgeCheck size={16}/>}
       Confirm {preview.new_rows} new rows
      </button>}
    </footer>
   </div>
  </div>:null}
 </section>;
}
