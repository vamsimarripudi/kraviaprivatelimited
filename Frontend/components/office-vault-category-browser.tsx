"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,FolderClosed,Search,ShieldCheck} from "lucide-react";
import type {VaultCategory} from "@/lib/office/vault-categories";
import styles from "./office-vault-category-browser.module.css";
export function OfficeVaultCategoryBrowser({categories}:{categories:readonly VaultCategory[]}){
 const [query,setQuery]=useState("");
 const visible=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return q?categories.filter(c=>(c.title+" "+c.description).toLocaleLowerCase().includes(q)):categories;
 },[categories,query]);
 return <section className={styles.browser} aria-label="K-Vault authorized categories">
  <label htmlFor="vault-category-search"><Search size={16}/>Search accessible categories</label>
  <input id="vault-category-search" value={query} onChange={e=>setQuery(e.target.value)}
    maxLength={120} placeholder="Search your authorized categories"/>
  <p role="status" className={styles.count}>{visible.length} of {categories.length} authorized categories</p>
  {visible.length?<div className={styles.grid}>{visible.map(c=>
   <Link href={"/office/k-vault/categories/"+encodeURIComponent(c.slug)} key={c.slug}>
    <FolderClosed size={21} aria-hidden="true"/><span><strong>{c.title}</strong>
    <small>{c.description}</small></span><ArrowRight size={17} aria-hidden="true"/></Link>)}</div>:
   <div className={styles.empty} role="status"><ShieldCheck size={21}/>
    <p>{categories.length?"No permitted categories match the search.":"No Vault categories are currently available to your role."}</p>
    <Link href="/office/k-vault/requests">Request access</Link>
   </div>}
 </section>;
}
