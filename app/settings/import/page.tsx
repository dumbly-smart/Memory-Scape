'use client';

import Link from 'next/link';
import { useState } from 'react';

type Preview = { items: { title:string; content:string; occurredAt:string; sourceUrl?:string; format:string }[]; total:number; duplicates:number; newEntries:number; totalBytes:number };
const maxBytes = 15 * 1024 * 1024;

export default function ImportPage() {
  const [files,setFiles]=useState<File[]>([]);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function post(action:'preview'|'apply') {
    setError('');setStatus('');setBusy(true);
    try {
      const total=files.reduce((sum,file)=>sum+file.size,0);
      if(total>maxBytes)throw new Error('Select files totaling no more than 15 MiB.');
      const content=await Promise.all(files.map(file=>file.text()));
      const response=await fetch('/api/import/text',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,files:files.map((file,index)=>({name:file.name,content:content[index]}))})});
      const value=await response.json();
      if(!response.ok)throw new Error(value.error??'Import failed');
      if(action==='preview')setPreview(value.data as Preview);
      else {setStatus(`Imported ${value.data.inserted} entries; skipped ${value.data.skipped} duplicates.`);setPreview(null);setFiles([]);}
    } catch(cause){setError(cause instanceof Error?cause.message:'Could not read selected files');}
    finally{setBusy(false);}
  }
  return <>
    <div className="page-head"><div><div className="eyebrow">PORTABILITY</div><h1>Import notes and events</h1><p>Preview parsed entries before adding them to your local memory archive.</p></div><Link className="button secondary" href="/settings">Settings</Link></div>
    {error&&<div className="error" role="alert">{error}</div>}{status&&<div className="success" role="status">{status}</div>}
    <section className="panel" style={{maxWidth:900}}>
      <label className="field"><span>Files (up to 15 MiB total)</span><input className="input" type="file" multiple accept=".md,.markdown,.txt,.html,.htm,.ics,text/markdown,text/plain,text/html,text/calendar" onChange={event=>{setFiles(Array.from(event.target.files??[]));setPreview(null);setError('');}} /></label>
      <p className="muted">Supported formats: Markdown/text (one memory per file), Netscape bookmark HTML (one per bookmark), and iCalendar (one per VEVENT). Calendar recurrence rules are not expanded; floating calendar times are treated as UTC.</p>
      <div className="toolbar"><button className="button secondary" disabled={!files.length||busy} onClick={()=>void post('preview')}>{busy?'Reading…':'Preview import'}</button>{files.length>0&&<span className="muted">{files.length} file(s) · {(files.reduce((sum,file)=>sum+file.size,0)/1024).toFixed(1)} KiB</span>}</div>
      {preview&&<div className="algorithm-note" role="status" style={{marginTop:14}}><strong>Preview only. Nothing has been written.</strong><p>{preview.total} entries · {preview.newEntries} new · {preview.duplicates} duplicates will be skipped.</p><div className="table-scroll"><table className="responsive-table"><thead><tr><th>TYPE</th><th>TITLE</th><th>EVENT DATE</th><th>CONTENT</th></tr></thead><tbody>{preview.items.map((item,index)=><tr key={`${item.title}:${index}`}><td>{item.format}</td><td>{item.title}</td><td>{new Date(item.occurredAt).toLocaleString()}</td><td>{item.content.slice(0,180)}</td></tr>)}</tbody></table></div><button className="button" disabled={busy||preview.newEntries===0} onClick={()=>void post('apply')}>{busy?'Importing…':`Import ${preview.newEntries} new entries`}</button></div>}
    </section>
  </>;
}
