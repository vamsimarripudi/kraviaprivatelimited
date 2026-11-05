/**
 * KRAVIA's deterministic, email-client-safe HTML templates.
 *
 * All six layouts and the plain-text fallbacks are built together.
 * Content is intentionally static except for backend-escaped placeholder tokens.
 * Tables + inline CSS work in Gmail/Outlook; optional social GIFs retain a
 * readable first frame when motion is not supported.
 */
export const PLACEHOLDERS = {
  "code": "@@KRAVIA_CODE@@",
  "expiryMinutes": "@@KRAVIA_EXPIRY_MINUTES@@",
  "name": "@@KRAVIA_NAME@@",
  "senderEmail": "@@KRAVIA_SENDER_EMAIL@@",
  "reference": "@@KRAVIA_REFERENCE@@",
  "requestKind": "@@KRAVIA_REQUEST_KIND@@",
  "nextStep": "@@KRAVIA_NEXT_STEP@@",
  "message": "@@KRAVIA_MESSAGE@@",
  "requestSubject": "@@KRAVIA_REQUEST_SUBJECT@@",
  "organisation": "@@KRAVIA_ORGANISATION@@",
  "deviceLabel": "@@KRAVIA_DEVICE_LABEL@@",
  "sourceAddress": "@@KRAVIA_SOURCE_ADDRESS@@",
  "reviewUrl": "@@KRAVIA_REVIEW_URL@@"
} as const;

export type KraviaEmailTemplateName =
  | "office_sign_in_code"
  | "office_device_approval"
  | "public_request_received"
  | "public_request_update"
  | "public_intake_internal_notification"
  | "public_welcome";
export type RenderedTemplate = {html: string; text: string};

function makeManifest(): Record<KraviaEmailTemplateName, RenderedTemplate> {
  const P = PLACEHOLDERS;
  const site = "https://www.kraviaprivatelimited.com";
  const profiles = [
    {name:"LinkedIn", href:"https://linkedin.com/company/kravia-private-limited", icon:"linkedin.gif"},
    {name:"X", href:"https://x.com/KraviaOfficial", icon:"x.gif"},
    {name:"Instagram",href:"https://www.instagram.com/kravia_private_limited/",icon:"instagram.gif"},
    {name:"Facebook",href:"https://www.facebook.com/profile.php?id=61595906774125",icon:"facebook.gif"},
  ];
  const themes = {
    office_sign_in_code: {eyebrow:"IDENTITY VERIFICATION",title:"Your sign-in code.",sub:"A private code for KRAVIA Office.",accent:"#2765C5",tint:"#EDF4FF",fg:"#173F80",mode:"security"},
    office_device_approval: {eyebrow:"SECURITY NOTICE",title:"A new device needs review.",sub:"Check this request before allowing access.",accent:"#B34F39",tint:"#FFF1EB",fg:"#883A2A",mode:"security"},
    public_request_received: {eyebrow:"REQUEST CONFIRMATION",title:"We’ve received your request.",sub:"Your message is now with KRAVIA.",accent:"#22846A",tint:"#ECFAF5",fg:"#176A55",mode:"service"},
    public_request_update: {eyebrow:"REQUEST UPDATE",title:"An update from our team.",sub:"The latest information on your request.",accent:"#355E95",tint:"#EFF5FC",fg:"#264A79",mode:"service"},
    public_intake_internal_notification: {eyebrow:"KRAVIA OFFICE · INTAKE",title:"A request needs your review.",sub:"Private operations notification.",accent:"#A06B1B",tint:"#FFF7E9",fg:"#795018",mode:"operations"},
    public_welcome: {eyebrow:"A NOTE FROM KRAVIA",title:"Welcome to KRAVIA.",sub:"A thoughtful beginning. A lasting connection.",accent:"#477EB5",tint:"#EFF5FA",fg:"#20496D",mode:"welcome"},
  };
  const legalLine = `Privacy ${site}/trust/privacy · Legal notices and terms ${site}/legal · Contact ${site}/contact`;
  const socialText = profiles.map(x=>`${x.name} ${x.href}`).join(" · ");
  const iconRow = profiles.map(x=>
    `<td width="25%" align="center" valign="top" style="width:25%;padding:4px 2px 2px;text-align:center"><a href="${x.href}" target="_blank" rel="noopener noreferrer" aria-label="KRAVIA on ${x.name}" style="color:#FFFFFF;text-decoration:none;display:inline-block"><img alt="${x.name}" src="${site}/brand/email/${x.icon}" width="60" height="60" style="display:block;margin:0 auto;width:60px;height:60px;border:0" /><span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;line-height:20px;color:#DAE7F3;text-decoration:none">${x.name}</span></a></td>`
  ).join("");
  const footer = `<tr><td style="padding:29px 28px 25px;background-color:#152D45;color:#FFFFFF">
  <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;line-height:16px;color:#BDD7EC;margin:0 0 17px">CONNECT WITH KRAVIA</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${iconRow}</tr></table>
  <div style="border-top:1px solid #38516B;height:1px;line-height:1px;font-size:1px;margin:20px 0"></div>
  <p style="font:700 10px/17px Arial,Helvetica,sans-serif;color:#BDD7EC;letter-spacing:1.5px;margin:0 0 7px">ACCOUNT SAFETY</p>
  <p style="font:12px/19px Arial,Helvetica,sans-serif;color:#EAF3FA;margin:0 0 17px">For your safety, KRAVIA will never ask for your password, one-time code, private key, or card PIN by email.</p>
  <p style="font:12px/21px Arial,Helvetica,sans-serif;color:#D5E4F2;margin:0 0 16px"><a style="color:#FFFFFF;text-decoration:underline" href="${site}/trust/privacy">Privacy</a> &nbsp;·&nbsp; <a style="color:#FFFFFF;text-decoration:underline" href="${site}/legal">Legal notices and terms</a> &nbsp;·&nbsp; <a style="color:#FFFFFF;text-decoration:underline" href="${site}/contact">Contact</a></p>
  <p style="font:11px/18px Arial,Helvetica,sans-serif;color:#BDD7EC;margin:0">© KRAVIA PRIVATE LIMITED. All rights reserved.</p></td></tr>`;
  const panel=(label: string,body: string,color: string,background: string)=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 21px;background-color:${background};border-left:4px solid ${color}"><tr><td style="padding:19px 20px"><p style="font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${color};margin:0 0 9px">${label}</p>${body}</td></tr></table>`;
  const ref=(reference: string)=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:9px 0 24px;border:1px solid #D8E3EC"><tr><td style="padding:15px 19px;background-color:#F7F9FC"><p style="font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:#59758F;margin:0 0 6px">YOUR REFERENCE</p><p style="font:700 15px/24px Consolas,Monaco,monospace;color:#173B5F;overflow-wrap:anywhere;margin:0">${reference}</p></td></tr></table>`;
  const p=(t: string)=>`<p class="copy" style="font:15px/25px Arial,Helvetica,sans-serif;color:#25374A;margin:0 0 18px">${t}</p>`;
  const hint=(t: string)=>`<p style="font:12px/20px Arial,Helvetica,sans-serif;color:#62778B;margin:0 0 18px">${t}</p>`;
  const detail=(name: string,value: string,last: boolean)=>`<tr><td style="padding:12px 12px 12px 0;border-bottom:${last?"0":"1px solid #E6EDF3"};font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1px;color:#5B7288;text-transform:uppercase;vertical-align:top" width="30%">${name}</td><td style="padding:10px 0;border-bottom:${last?"0":"1px solid #E6EDF3"};font:600 14px/22px Arial,Helvetica,sans-serif;color:#172F46;overflow-wrap:anywhere;vertical-align:top">${value}</td></tr>`;
  const configs = {
    office_sign_in_code: themes.office_sign_in_code,
    office_device_approval: themes.office_device_approval,
    public_request_received: themes.public_request_received,
    public_request_update: themes.public_request_update,
    public_intake_internal_notification: themes.public_intake_internal_notification,
    public_welcome: themes.public_welcome,
  };
  const wrap=(key: KraviaEmailTemplateName,body: string,textBody: string)=>{
    const cfg=configs[key];
    const headline = cfg.mode==="welcome"
      ? `<tr><td style="padding:32px 30px 31px;background-color:#193B5B"><p style="font:700 10px/18px Arial,Helvetica,sans-serif;color:#D1E7FA;letter-spacing:2px;margin:0 0 14px">${cfg.eyebrow}</p><h1 style="font:400 35px/43px Georgia,'Times New Roman',serif;letter-spacing:-.7px;color:#FFFFFF;margin:0 0 12px">${cfg.title}</h1><p style="font:14px/23px Arial,Helvetica,sans-serif;color:#E0EEF9;margin:0">${cfg.sub}</p></td></tr>`
      : `<tr><td style="padding:31px 30px 27px;background-color:#FFFFFF;border-top:4px solid ${cfg.accent}"><p style="display:inline-block;font:700 10px/17px Arial,Helvetica,sans-serif;letter-spacing:1.4px;padding:6px 10px;color:${cfg.fg};background-color:${cfg.tint};margin:0 0 19px">${cfg.eyebrow}</p><h1 style="font:700 29px/36px Arial,Helvetica,sans-serif;letter-spacing:-.9px;color:#172B3F;margin:0 0 10px">${cfg.title}</h1><p style="font:14px/23px Arial,Helvetica,sans-serif;color:#667B8E;margin:0">${cfg.sub}</p></td></tr>`;
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="color-scheme" content="light dark"/><meta name="supported-color-schemes" content="light dark"/><title>KRAVIA</title><style>body{margin:0;padding:0;-webkit-text-size-adjust:100%;font-synthesis:none}table{border-spacing:0}img{border:0}a{text-decoration-skip-ink:auto}@media screen and (max-width:620px){.kravia-shell{width:100%!important}.kravia-cell{padding:0!important}.kravia-content{padding:24px 23px 6px!important}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}@media(prefers-color-scheme:dark){.kravia-shell{border-color:#3E586E!important}.kravia-content{background-color:#172331!important}.copy{color:#ECF4FA!important}}</style></head><body style="margin:0;padding:0;background-color:#E8EDF3;font-family:Arial,Helvetica,sans-serif"><div style="display:none;font-size:1px;line-height:1px;color:#E8EDF3;max-height:0;max-width:0;opacity:0;overflow:hidden">${cfg.title} ${cfg.sub}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#E8EDF3"><tr><td class="kravia-cell" align="center" style="padding:36px 14px"><table role="presentation" class="kravia-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border:1px solid #D6E0E9"><tr><td style="height:4px;background-color:#193B5B;font-size:1px;line-height:4px">&nbsp;</td></tr><tr><td style="padding:22px 30px;background-color:#F7FAFC"><a href="${site}" style="display:inline-block;color:#193B5B;text-decoration:none" title="KRAVIA website"><img alt="KRAVIA PRIVATE LIMITED" width="163" height="55" src="${site}/brand/kravia-header-lockup-v2.png" style="display:block;width:163px;height:55px;max-width:100%;border:0"/></a><p style="font:700 10px/16px Arial,Helvetica,sans-serif;letter-spacing:1.7px;color:#6C8299;margin:10px 0 0">OFFICIAL COMPANY COMMUNICATION</p></td></tr>${headline}<tr><td class="kravia-content" style="padding:30px 30px 10px;background-color:#FFFFFF">${body}</td></tr>${footer}</table><p style="font:11px/18px Arial,Helvetica,sans-serif;color:#6D8093;margin:16px 0 0">Sent by KRAVIA PRIVATE LIMITED.</p></td></tr></table></body></html>`;
    const text=`KRAVIA PRIVATE LIMITED\n\n${cfg.eyebrow}\n${cfg.title}\n${cfg.sub}\n\n${textBody}\n\nCONNECT WITH KRAVIA\n${socialText}\n\nACCOUNT SAFETY\nFor your safety, KRAVIA will never ask for your password, one-time code, private key, or card PIN by email.\n\n${legalLine}\n\n© KRAVIA PRIVATE LIMITED. All rights reserved.`;
    return {html,text};
  };
  return {
    office_sign_in_code: wrap("office_sign_in_code",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:3px 0 22px;background-color:#EDF4FF;border:1px solid #D1E0F5"><tr><td align="center" style="padding:29px 13px 24px;text-align:center"><p style="font:700 10px/17px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#315E9B;margin:0 0 13px">ONE-TIME SIGN-IN CODE</p><p style="font:700 43px/55px Consolas,Monaco,monospace;letter-spacing:7px;color:#163B66;margin:0">${P.code}</p><p style="font:13px/21px Arial,Helvetica,sans-serif;color:#50718E;margin:12px 0 0">Valid for ${P.expiryMinutes} minutes · Single use</p></td></tr></table>${p("Use this one-time code to finish signing in to KRAVIA Office. Do not share it with anyone, including KRAVIA staff.")}${panel("NOT YOU?","<p style=\"font:13px/21px Arial,Helvetica,sans-serif;color:#3D5367;margin:0\">You can safely ignore this email if you did not request the sign-in.</p>","#315E9B","#F6F9FD")}`,
      `ONE-TIME SIGN-IN CODE\n${P.code}\n\nThis code expires in ${P.expiryMinutes} minutes and works only once. Use it to finish signing in to KRAVIA Office. Do not share it with anyone, including KRAVIA staff.\n\nDidn’t try to sign in? You can safely ignore this email.`),
    office_device_approval: wrap("office_device_approval",
      `${panel("UNRECOGNIZED DEVICE CHECK","<p style=\"font:600 14px/23px Arial,Helvetica,sans-serif;color:#6B392B;margin:0\">A new KRAVIA sign-in device completed password and email checks, but does not have account access yet.</p>","#B34F39","#FFF1EB")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #D8E3EC;margin:0 0 21px"><tr><td style="padding:15px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detail("Device",P.deviceLabel,false)}${detail("Observed address",P.sourceAddress,true)}</table></td></tr></table>${p("Review the request and choose Trust or Cancel and block sign-in. Trust only if you recognize this exact device.")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px"><tr><td align="center" style="padding:14px 20px;background-color:#A44332"><a href="${P.reviewUrl}" style="display:block;font:700 15px/22px Arial,Helvetica,sans-serif;color:#FFFFFF;text-decoration:none">Review this sign-in →</a></td></tr></table>${hint("Trusting a request locks your KRAVIA account to the original device and securely signs out any previously trusted device. Opening the link never signs in the device displaying this email.")}${hint("New to KRAVIA Authenticator? Install only the company-provided app, enter your registered credentials and one-time code, then return to this email. If it was not you, choose ignore to block the request and sign out the device.")}`,
      `A new device needs review.\nDEVICE: ${P.deviceLabel}\nADDRESS OBSERVED BY KRAVIA: ${P.sourceAddress}\n\nThe sign-in cannot access your account until you approve it. Open the secure review page and choose Trust or Cancel and block sign-in. Trust only if this was you.\nReview this sign-in: ${P.reviewUrl}\n\nTrusting the request locks your KRAVIA account to the original device and signs out any previously trusted device. Opening the link never signs in the browser or phone that opens it.\n\nNew to KRAVIA Authenticator? Install only the company-provided app, enter registered credentials and the one-time code, then return to this email. If it was not you, choose ignore.`),
    public_request_received: wrap("public_request_received",
      `${p(`Hello ${P.name},`)}${panel("RECEIVED · CONFIRMED",`<p style="font:600 15px/24px Arial,Helvetica,sans-serif;color:#176A55;margin:0">We received your ${P.requestKind}.</p>`,"#22846A","#ECFAF5")}${ref(P.reference)}<p style="font:700 12px/18px Arial,Helvetica,sans-serif;color:#172F46;margin:0 0 9px">What happens next</p>${p(P.nextStep)}${hint("Keep the reference above for future communication with KRAVIA.")}`,
      `Hello ${P.name},\n\nWe received your ${P.requestKind}.\n\nYOUR REFERENCE\n${P.reference}\n\nWhat happens next\n${P.nextStep}\n\nKeep this reference for future communication.`),
    public_request_update: wrap("public_request_update",
      `${p(`Hello ${P.name},`)}${ref(P.reference)}${panel("LATEST MESSAGE",`<p class="copy" style="font:15px/26px Arial,Helvetica,sans-serif;color:#243D56;white-space:pre-line;margin:0">${P.message}</p>`,"#355E95","#EFF5FC")}${hint("This message concerns the reference above. Reply to this email if you need to provide a clarification.")}`,
      `Hello ${P.name},\n\nREQUEST REFERENCE: ${P.reference}\n\nLATEST MESSAGE\n${P.message}\n\nReply to this email if you need to provide a clarification.`),
    public_intake_internal_notification: wrap("public_intake_internal_notification",
      `${panel("ACTION · REVIEW IN OFFICE",`<p style="font:600 14px/23px Arial,Helvetica,sans-serif;color:#795018;margin:0">A new ${P.requestKind} was submitted through the KRAVIA website.</p>`,"#A06B1B","#FFF7E9")}${ref(P.reference)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-top:1px solid #D8E3EC;border-bottom:1px solid #D8E3EC"><tr><td style="padding:8px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detail("From",P.name,false)}${detail("Email",P.senderEmail,false)}${detail("Subject",P.requestSubject,false)}${detail("Organisation",P.organisation,true)}</table></td></tr></table>${hint("Reply to this email to contact the requester directly. The full request remains in the appropriate KRAVIA Office intake queue. Do not forward Trust or security requests outside authorized channels.")}`,
      `A new ${P.requestKind} needs review.\nREFERENCE: ${P.reference}\nFROM: ${P.name}\nEMAIL: ${P.senderEmail}\nSUBJECT: ${P.requestSubject}\nORGANISATION: ${P.organisation}\n\nReply to contact the requester directly. The full request remains in the appropriate KRAVIA Office intake queue.`),
    public_welcome: wrap("public_welcome",
      `<p style="font:italic 21px/34px Georgia,'Times New Roman',serif;color:#234F76;margin:0 0 26px">“You belong here — wherever you are building what matters.”</p>${p(`Hello ${P.name},`)}${p("Thank you for connecting with KRAVIA. We believe meaningful work begins with clear ideas, thoughtful decisions, and people who care about doing things well.")}${p("Whether you are exploring what we build or planning what comes next, we look forward to staying connected.")}<p style="font:italic 17px/28px Georgia,'Times New Roman',serif;color:#234F76;margin:20px 0 18px">With warm wishes,<br/>KRAVIA</p>`,
      `“You belong here — wherever you are building what matters.”\n\nHello ${P.name},\n\nThank you for connecting with KRAVIA. We believe meaningful work begins with clear ideas, thoughtful decisions, and people who care about doing things well.\n\nWhether you are exploring what we build or planning what comes next, we look forward to staying connected.\n\nWith warm wishes,\nKRAVIA`),
  };
}

export async function renderTemplateManifest(): Promise<Record<KraviaEmailTemplateName, RenderedTemplate>> {
  return makeManifest();
}
