'use client';
import {useEffect, useRef, useState} from 'react';
import {PRIORITIES, topicIds, validateChecklist} from '../lib/checklist.mjs';

const newId = () => `custom-${crypto.randomUUID()}`;
export default function ChecklistEditor({plan, busy, onSave, onClose}) {
  const [draft, setDraft] = useState(() => structuredClone(plan));
  const [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  function changeDomain(id, update) {
    setDraft(p => ({...p, domains: p.domains.map(d => d.id === id ? update(d) : d)}));
  }
  function changeGroup(domainId, groupId, update) {
    changeDomain(domainId, d => ({...d, groups: d.groups.map(g => g.id === groupId ? update(g) : g)}));
  }
  function removeDomain(id) {
    if (confirm('Remove this domain and all its modules and topics from your checklist?')) setDraft(p => ({...p, focusId: p.focusId === id ? '' : p.focusId, domains: p.domains.filter(d => d.id !== id)}));
  }
  async function submit(e) {
    e.preventDefault();
    const valid = new Set(topicIds(draft.domains));
    const next = {...draft, completedIds: draft.completedIds.filter(id => valid.has(id))};
    if (!validateChecklist(next)) {setError('Check all names and limits: 100 domains, 500 modules, 2000 topics.'); return;}
    setError(''); await onSave(next);
  }
  return <dialog ref={dialog} className="checklist-dialog" onCancel={e => {e.preventDefault(); if (!busy) onClose();}}>
    <form onSubmit={submit}>
      <div className="editor-heading"><div><h2>Customize your checklist</h2><p>These changes apply only to your account. Save when you are ready.</p></div><button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button></div>
      {error && <p role="alert" className="banner err">{error}</p>}
      <fieldset disabled={busy}>
      <label className="editor-field">Current focus<select value={draft.focusId} onChange={e => setDraft(p => ({...p, focusId: e.target.value}))}><option value="">Choose later</option>{draft.domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      {draft.domains.map(d => <section className="editor-domain" key={d.id}>
        <div className="editor-row"><label className="editor-field grow">Domain name<input required maxLength={300} value={d.name} onChange={e => changeDomain(d.id, x => ({...x, name:e.target.value}))}/></label><button type="button" className="btn danger-outline" onClick={() => removeDomain(d.id)}>Remove domain</button></div>
        <div className="editor-row"><label className="editor-field">Priority<select value={d.priority} onChange={e => changeDomain(d.id, x => ({...x, priority:e.target.value}))}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label><label className="editor-field">Self-rating (0–5)<input type="number" min="0" max="5" step="0.5" value={d.rating ?? ''} placeholder="Not rated" onChange={e => changeDomain(d.id, x => ({...x, rating:e.target.value === '' ? null : Number(e.target.value)}))}/></label></div>
        {d.groups.map(g => <details key={g.id} className="editor-module"><summary>{g.name || 'Untitled module'} · {g.items.length} topics</summary>
          <div className="editor-row"><label className="editor-field grow">Module name<input required maxLength={300} value={g.name} onChange={e => changeGroup(d.id,g.id,x => ({...x,name:e.target.value}))}/></label><button type="button" className="btn danger-outline" onClick={() => {if(confirm('Remove this module and its topics?')) changeDomain(d.id,x => ({...x,groups:x.groups.filter(item => item.id !== g.id)}));}}>Remove module</button></div>
          {g.items.map(t => <div className="editor-row" key={t.id}><input className="grow" aria-label={`Topic in ${g.name}`} required maxLength={300} value={t.name} onChange={e => changeGroup(d.id,g.id,x => ({...x,items:x.items.map(item => item.id === t.id ? {...item,name:e.target.value} : item)}))}/><button type="button" className="btn" aria-label={`Remove ${t.name}`} onClick={() => changeGroup(d.id,g.id,x => ({...x,items:x.items.filter(item => item.id !== t.id)}))}>Remove</button></div>)}
          <button type="button" className="btn" onClick={() => changeGroup(d.id,g.id,x => ({...x,items:[...x.items,{id:newId(),name:'New topic'}]}))}>Add topic</button>
        </details>)}
        <button type="button" className="btn" onClick={() => changeDomain(d.id,x => ({...x,groups:[...x.groups,{id:newId(),name:'New module',items:[]}]}))}>Add module</button>
      </section>)}
      <button type="button" className="btn" onClick={() => setDraft(p => ({...p,domains:[...p.domains,{id:newId(),name:'New domain',priority:'P1',rating:null,groups:[]}]}))}>Add domain</button>
      </fieldset>
      <div className="editor-footer"><span>{draft.domains.length} domains · {topicIds(draft.domains).length} topics</span><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save my checklist'}</button></div>
    </form>
  </dialog>;
}
