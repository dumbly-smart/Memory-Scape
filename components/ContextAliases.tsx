'use client';

import { FormEvent,useEffect,useState } from 'react';

type Alias={id:string;alias:string;normalized_alias:string};
type ContextOption={id:string;type:string;label:string};
export function ContextAliases({contextId,type,label}: {contextId:string;type:string;label:string}) {
  const [aliases,setAliases]=useState<Alias[]>([]);
  const [contexts,setContexts]=useState<ContextOption[]>([]);
  const [alias,setAlias]=useState('');
  const [targetId,setTargetId]=useState('');
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function load() {
    const [aliasResponse,contextResponse]=await Promise.all([fetch(`/api/contexts/${contextId}/aliases`),fetch('/api/contexts')]);
    const [aliasBody,contextBody]=await Promise.all([aliasResponse.json(),contextResponse.json()]);
    if(!aliasResponse.ok)throw new Error(aliasBody.error??'Could not load aliases');
    if(!contextResponse.ok)throw new Error(contextBody.error??'Could not load contexts');
    setAliases(aliasBody.data as Alias[]);
    setContexts((contextBody.data as ContextOption[]).filter(context=>context.type===type&&context.id!==contextId));
  }
  useEffect(()=>{load().catch(cause=>setError(cause instanceof Error?cause.message:'Could not load context aliases'));},[contextId,type]);
  async function addAlias(event:FormEvent) {
    event.preventDefault();setError('');setStatus('');setBusy(true);
    try {const response=await fetch(`/api/contexts/${contextId}/aliases`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias})});const value=await response.json();if(!response.ok)throw new Error(value.error??'Could not add alias');setAlias('');setStatus(`Added “${value.data.alias}” as an alias for ${label}.`);await load();}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not add alias');}finally{setBusy(false);}
  }
  async function removeAlias(aliasId:string) {
    setError('');setStatus('');const response=await fetch(`/api/contexts/${contextId}/aliases/${aliasId}`,{method:'DELETE'});const value=await response.json();if(!response.ok){setError(value.error??'Could not remove alias');return;}await load();setStatus('Alias removed.');
  }
  async function merge() {
    if(!targetId)return;
    const target=contexts.find(context=>context.id===targetId);
    if(!target||!window.confirm(`Merge “${label}” into “${target.label}”? Linked memories, follow-ups, decisions, and aliases will move; this context will be removed.`))return;
    setError('');setStatus('');setBusy(true);
    try {const response=await fetch('/api/contexts/merge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceId:contextId,targetId})});const value=await response.json();if(!response.ok)throw new Error(value.error??'Could not merge contexts');window.location.assign(`/contexts/${targetId}`);}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not merge contexts');setBusy(false);}
  }
  return <section className="panel" aria-label="Context aliases and merge" style={{marginTop:16}}>
    <div className="panel-title"><h2>Names and aliases</h2><span className="muted">Aliases resolve to this {type.toLowerCase()} context</span></div>
    {error&&<p className="error" role="alert">{error}</p>}{status&&<p className="success" role="status">{status}</p>}
    {aliases.length?<ul>{aliases.map(item=><li key={item.id} style={{marginBottom:8}}>{item.alias} <span className="muted">({item.normalized_alias})</span> <button className="button ghost" onClick={()=>removeAlias(item.id)} aria-label={`Remove alias ${item.alias}`}>Remove</button></li>)}</ul>:<p className="muted">No aliases yet. Add alternate names, abbreviations, or spellings.</p>}
    <form className="toolbar" onSubmit={addAlias} style={{alignItems:'end'}}><label className="field" style={{flex:1}}><span>Add alias</span><input className="input" maxLength={160} value={alias} onChange={event=>setAlias(event.target.value)} placeholder="Alternate name" /></label><button className="button secondary" disabled={busy||!alias.trim()}>Add alias</button></form>
    {contexts.length>0&&<div className="toolbar" style={{alignItems:'end'}}><label className="field" style={{flex:1}}><span>Merge into a same-type context</span><select className="input" value={targetId} onChange={event=>setTargetId(event.target.value)}><option value="">Choose target…</option>{contexts.map(context=><option key={context.id} value={context.id}>{context.label}</option>)}</select></label><button className="button secondary" disabled={busy||!targetId} onClick={merge}>Merge context</button></div>}
    <p className="muted">Merging moves memory links, follow-ups, decisions, and aliases in one database transaction. Context types must match. Existing memory strength is unchanged.</p>
  </section>;
}
