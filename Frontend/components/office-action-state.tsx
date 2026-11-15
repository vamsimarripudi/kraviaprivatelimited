"use client";
import styles from "./office-action-state.module.css";
type Kind="success"|"error"|"not-found";
const embed:Record<Kind,string>={
  success:"https://lottie.host/embed/b39c538c-c6db-4d74-94d1-25f66744e08b/UBKtBipjmY.lottie",
  error:"https://lottie.host/embed/dd1ae3bd-470d-465a-9a15-509b9264dd03/uI9g0OWry2.lottie",
  "not-found":"https://lottie.host/embed/b6274016-c330-43a5-8617-55a38c2d2827/mhYCgKQq4L.lottie",
};
/** Decorative user-selected states; source actions still report success/error text.
 * An iframe never receives Office identity, message data or tokens. */
export function OfficeActionState({kind,label,compact=false}:{
 kind:Kind;label:string;compact?:boolean
}){
 return <div className={styles.state} data-kind={kind} data-compact={compact} role={kind==="error"?"alert":"status"}>
  <iframe className={styles.illustration} src={embed[kind]} loading="lazy"
    title={kind==="success"?"Action completed":kind==="error"?"Action failed":"No matching results"}
    referrerPolicy="no-referrer" sandbox="allow-scripts" tabIndex={-1}
    aria-hidden="true"/>
  <span>{label}</span>
 </div>;
}
