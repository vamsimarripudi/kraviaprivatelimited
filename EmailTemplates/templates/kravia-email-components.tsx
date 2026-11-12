import type { CSSProperties, ReactNode } from "react";

/**
 * Reusable corporate Office email primitives.
 *
 * Keep these presentation-only: they NEVER resolve recipients, employment
 * state, MFA eligibility, signing state, salary, permissions or delivery.
 * Those values must come from approved, committed Office events upstream.
 * No JS, tracking pixels, fabricated staff details or attachment payloads.
 */
const SITE = "https://www.kraviaprivatelimited.com";
const BRAND_LOGO = SITE + "/brand/kravia-header-lockup-v2.png";
const FONT = "Arial, Helvetica, sans-serif";
const INK = "#142338";
const MUTED = "#485D73";
const BORDER = "#DAE3EE";
const BLUE = "#174EA6";
const CORAL = "#BA5046";

const body: CSSProperties = { margin: 0, padding: 0, width: "100%", backgroundColor: "#F1F4F8", color: INK, fontFamily: FONT };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", borderSpacing: 0 };
const cell: CSSProperties = { padding: "0 24px" };

export function validateOfficeEmailUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    throw new Error("Office email actions require an approved secure destination");
  }
  if (url.origin !== SITE || !url.pathname.startsWith("/office/") || url.pathname.includes("..")) {
    throw new Error("Office email actions must stay within the private Office origin");
  }
  return value;
}

export function KraviaEmailShell({ children, preview }: { children: ReactNode; preview: string }) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <style>{`@media screen and (max-width:620px){.kravia-mail-frame{width:100%!important;max-width:100%!important}.kravia-mail-content{padding:22px 18px!important}.kravia-mail-action{display:block!important;max-width:100%!important;text-align:center!important}} @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}`}</style>
    </head>
    <body style={body}>
      <div style={{ display:"none",fontSize:1,lineHeight:"1px",maxHeight:0,maxWidth:0,opacity:0,overflow:"hidden" }}>{preview}</div>
      <table role="presentation" cellPadding={0} cellSpacing={0} style={table}>
        <tbody><tr><td align="center" style={{padding:"26px 12px 32px"}}>
          <table className="kravia-mail-frame" role="presentation" cellPadding={0} cellSpacing={0}
            width="600" style={{width:"100%",maxWidth:600,tableLayout:"fixed",borderCollapse:"separate",backgroundColor:"#FFFFFF",border:"1px solid "+BORDER,borderRadius:18}}>
            <tbody><tr><td><KraviaEmailHeader/></td></tr>
            <tr><td className="kravia-mail-content" style={{padding:"28px 30px 32px",fontFamily:FONT}}>{children}</td></tr>
            <tr><td><KraviaEmailFooter/></td></tr></tbody>
          </table>
        </td></tr></tbody>
      </table>
    </body>
  </html>;
}

export function KraviaEmailHeader() {
  return <table role="presentation" cellPadding={0} cellSpacing={0} style={{...table,backgroundColor:"#FFFFFF",borderRadius:"18px 18px 0 0"}}>
    <tbody><tr><td align="center" style={{padding:"25px 24px 20px",borderBottom:"1px solid "+BORDER,backgroundColor:"#FFFFFF"}}>
      <img src={BRAND_LOGO} alt="KRAVIA PRIVATE LIMITED" width={218}
        style={{display:"block",width:218,maxWidth:"100%",height:"auto",border:0,backgroundColor:"#FFFFFF"}} />
    </td></tr></tbody>
  </table>;
}

export function KraviaEmailHero({ eyebrow, title, children }: { eyebrow:string;title:string;children?:ReactNode }) {
  return <div>
    <p style={{color:BLUE,fontSize:11,fontWeight:700,letterSpacing:1.6,lineHeight:"18px",margin:"0 0 12px",textTransform:"uppercase"}}>{eyebrow}</p>
    <h1 style={{color:INK,fontSize:29,lineHeight:"36px",letterSpacing:-0.4,margin:"0 0 14px",fontWeight:700}}>{title}</h1>
    {children ? <div style={{fontSize:15,lineHeight:"25px",color:MUTED,marginBottom:20}}>{children}</div> : null}
  </div>;
}

export function KraviaEmailFooter() {
  return <table role="presentation" cellPadding={0} cellSpacing={0} style={{...table,backgroundColor:"#172C48"}}>
    <tbody><tr><td align="center" style={{padding:"21px 24px 24px",color:"#EFF5FC",fontFamily:FONT}}>
      <p style={{fontSize:12,fontWeight:700,letterSpacing:1,lineHeight:"19px",margin:"0 0 8px"}}>KRAVIA PRIVATE LIMITED</p>
      <p style={{fontSize:12,lineHeight:"20px",color:"#DDE8F7",margin:"0 0 11px"}}>Corporate Office · Private staff correspondence</p>
      <p style={{fontSize:12,lineHeight:"20px",margin:"0 0 12px"}}>
        <a href={SITE+"/trust/privacy"} style={{color:"#FFFFFF",textDecoration:"underline"}}>Privacy</a>
        {"  ·  "}
        <a href={SITE+"/legal"} style={{color:"#FFFFFF",textDecoration:"underline"}}>Legal</a>
        {"  ·  "}
        <a href={SITE+"/contact"} style={{color:"#FFFFFF",textDecoration:"underline"}}>Contact</a>
      </p>
      <p style={{color:"#DDE8F7",fontSize:11,lineHeight:"18px",margin:0}}>
        KRAVIA will never request your password, verification code or payment credentials by email.
      </p>
    </td></tr></tbody>
  </table>;
}

export function KraviaEmailActionButton({ href, children }: { href: string; children: ReactNode }) {
  const safeHref = validateOfficeEmailUrl(href);
  return <table role="presentation" cellPadding={0} cellSpacing={0} style={{borderCollapse:"separate",margin:"19px 0"}}>
    <tbody><tr><td bgcolor={BLUE} style={{borderRadius:10,backgroundColor:BLUE}}>
      <a className="kravia-mail-action" href={safeHref} style={{display:"inline-block",minHeight:42,padding:"12px 20px",fontFamily:FONT,fontSize:14,lineHeight:"22px",fontWeight:700,color:"#FFFFFF",textDecoration:"none"}}>{children}</a>
    </td></tr></tbody>
  </table>;
}

export function KraviaEmailInfoCard({ title, children }: { title: string;children:ReactNode }) {
  return <table role="presentation" cellPadding={0} cellSpacing={0} style={{...table,backgroundColor:"#F2F6FC",borderLeft:"4px solid "+BLUE,margin:"14px 0 18px"}}>
    <tbody><tr><td style={{padding:"17px 19px"}}>
      <p style={{fontFamily:FONT,fontWeight:700,fontSize:12,lineHeight:"19px",color:INK,margin:"0 0 6px"}}>{title}</p>
      <div style={{fontFamily:FONT,fontSize:13,lineHeight:"21px",color:MUTED}}>{children}</div>
    </td></tr></tbody>
  </table>;
}

export function KraviaOtpCode({code}: {code:string}) {
  if (!/^\d{6}$/.test(code)) throw new Error("Office verification codes must contain exactly six digits");
  return <table role="presentation" cellPadding={0} cellSpacing={0} style={{borderCollapse:"separate",borderSpacing:4,margin:"14px 0 20px"}}>
    <tbody><tr>{code.split("").map((digit,index)=><td key={index} align="center" style={{minWidth:37,padding:"11px 6px",backgroundColor:"#EAF2FF",border:"1px solid #C7D9F3",borderRadius:7,fontFamily:"Consolas, Courier New, monospace",fontWeight:700,fontSize:23,lineHeight:"27px",color:"#15417C"}}>{digit}</td>)}</tr></tbody>
  </table>;
}

export function KraviaEmailStatus({tone, children}:{tone:"INFO"|"ACTION_REQUIRED"|"APPROVED"|"PENDING";children:ReactNode}) {
  const caution=tone==="ACTION_REQUIRED";
  return <p role="status" style={{fontFamily:FONT,fontSize:13,lineHeight:"20px",fontWeight:700,padding:"10px 12px",margin:"13px 0",color:caution?CORAL:BLUE,backgroundColor:caution?"#FFF2EF":"#EFF5FD",borderLeft:"3px solid "+(caution?CORAL:BLUE)}}>
    {tone.replaceAll("_"," ")}: {children}
  </p>;
}

export function KraviaEmailDocumentNotice({reference,href}:{reference:string;href:string}) {
  if (!/^[A-Za-z0-9_.:/-]{5,120}$/.test(reference)) throw new Error("Invalid document reference");
  return <KraviaEmailInfoCard title="Private document available">
    <p style={{margin:"0 0 7px"}}>Document reference: <strong>{reference}</strong></p>
    <p style={{margin:0}}>Your document is stored in the private Office vault; it is not attached to this email.</p>
    <KraviaEmailActionButton href={href}>Open secure Office documents</KraviaEmailActionButton>
  </KraviaEmailInfoCard>;
}
