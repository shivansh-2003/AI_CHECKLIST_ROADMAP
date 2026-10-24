'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen, Search, LogOut, LogIn, ChevronDown, ChevronRight, Download, Upload, CheckCircle2, Circle, Layers, Target, Cloud, RefreshCw, AlertTriangle, X, UserRound, ArrowRight} from 'lucide-react';
import template from '../lib/curriculum.json';
import ChecklistEditor from '../components/ChecklistEditor';
import {defaultChecklist, domainStats, topicIds, validateChecklist} from '../lib/checklist.mjs';
import {getBrowserSupabase} from '../lib/supabase';

const priority=(v)=>v==='P0'?'critical':v==='P1'?'high':v==='P2'?'medium':'keep';
const INITIAL_OPEN=new Set(['6','7','8','9','2']);
function iconFor(id){return ['1','2','3','4'].includes(id)?<Layers size={17}/>:['6','7','8'].includes(id)?<Cloud size={17}/>:<BookOpen size={17}/>}

export default function Home(){
 const [plan,setPlan]=useState(()=>defaultChecklist(template));
 const [editing,setEditing]=useState(false);
 const [ready,setReady]=useState(false);
 const revision=useRef(0);
 const mutationBusy=useRef(false);
 const accountId=useRef(null);
 const curriculum=plan.domains;
 const all=curriculum.flatMap(d=>d.groups.flatMap(g=>g.items));
 const VALID=new Set(topicIds(curriculum));
 const focus=curriculum.find(d=>d.id===plan.focusId);
 const [supabase,setSupabase]=useState(null);
 const [session,setSession]=useState(null);
 const [authReady,setAuthReady]=useState(false);
 const [mode,setMode]=useState('signin');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [done,setDone]=useState(new Set());
 const doneRef=useRef(new Set());
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(new Set());
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('all');
 const [pFilter,setPFilter]=useState('all');
 const [expanded,setExpanded]=useState(INITIAL_OPEN);
 const fileInput=useRef(null);
 const authEpoch=useRef(0);

 const setProgress=(updater)=>{const next=updater(doneRef.current);doneRef.current=new Set(next);setDone(new Set(next));};
 useEffect(()=>{
   const c=getBrowserSupabase();setSupabase(c);
   if(!c){setAuthReady(true);return;}
   c.auth.getSession().then(({data})=>{accountId.current=data.session?.user?.id;setSession(data.session);setAuthReady(true);});
   const {data:{subscription}}=c.auth.onAuthStateChange((_event,current)=>{accountId.current=current?.user?.id;setSession(current);setError('');});
   return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
   const epoch=++authEpoch.current;
   doneRef.current=new Set();setDone(new Set());setPlan(defaultChecklist(template));setReady(false);setEditing(false);setNotice('');setQuery('');setStatus('all');setPFilter('all');setExpanded(INITIAL_OPEN);setSaving(new Set());setLoading(false);revision.current=0;mutationBusy.current=false;
   if(!session?.access_token)return;
   let ignore=false;
   const load=async()=>{
     setLoading(true);
     try{
       const r=await fetch('/api/progress',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
       const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not load progress');
       if(!validateChecklist(data.plan))throw new Error('The saved checklist is invalid. Restore a valid database backup.');
       if(!ignore&&authEpoch.current===epoch&&accountId.current===session.user.id){setPlan(data.plan);revision.current=data.revision;setProgress(()=>new Set(data.plan.completedIds));setReady(true);}
     }catch(e){if(!ignore)setError(e.message)}finally{if(!ignore)setLoading(false)}
   };load();return ()=>{ignore=true};
 },[session?.user?.id]);

 async function authenticate(e){
   e.preventDefault();setAuthBusy(true);setError('');setNotice('');
   try{
     const result=mode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
     if(result.error)throw result.error;
     if(mode==='signup'&&!result.data.session)setNotice('Account created. Check your email to confirm your address, then sign in.');
     else setNotice(mode==='signup'?'Account created. You are signed in.':'Signed in successfully.');
   }catch(e){setError(e.message)}finally{setAuthBusy(false)}
 }
 async function signout(){await supabase.auth.signOut();setNotice('Signed out.');}
 async function saveChange(body, method='PATCH'){
   if(!session||!ready||mutationBusy.current||accountId.current!==session.user.id)return false;
   const epoch=authEpoch.current, owner=session.user.id;
   mutationBusy.current=true;setLoading(true);setError('');
   try{
     const r=await fetch('/api/progress',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...body,revision:revision.current})});
     const data=await r.json();
     if(authEpoch.current!==epoch||accountId.current!==owner)return false;
     if(!r.ok){if(r.status===409)setReady(false);throw new Error(data.error||'Save failed');}
     revision.current=data.revision;setPlan(data.plan);setProgress(()=>new Set(data.plan.completedIds));
     return true;
   }catch(e){if(authEpoch.current===epoch&&accountId.current===owner)setError(e.message);return false;}
   finally{if(authEpoch.current===epoch&&accountId.current===owner){mutationBusy.current=false;setLoading(false);setSaving(new Set());}}
 }
 async function toggle(id,value){
   if(!ready||mutationBusy.current)return;
   const epoch=authEpoch.current,owner=session.user.id,previous=new Set(doneRef.current);
   setProgress(p=>{const n=new Set(p);value?n.add(id):n.delete(id);return n});setSaving(new Set([id]));
   const saved=await saveChange({topicId:id,completed:value});
   if(!saved&&authEpoch.current===epoch&&accountId.current===owner)setProgress(()=>previous);
 }
 async function bulk(completedIds){
   if(await saveChange({completedIds},'PUT'))setNotice(`Saved ${completedIds.length} completed topics.`);
 }
 async function savePlan(next){
   if(await saveChange({plan:next})){setEditing(false);setNotice('Your personal checklist has been saved.');}
 }
 async function importFile(e){
   const f=e.target.files?.[0];e.target.value='';if(!f)return;
   try{
     if(f.size>2000000)throw new Error('Backup must be smaller than 2 MB');
     const raw=JSON.parse(await f.text());
     if(raw?.version===2){
       if(!validateChecklist(raw.plan))throw new Error('Invalid checklist backup');
       if(confirm('Replace your checklist, settings and progress with this backup?'))await savePlan(raw.plan);
     }else{
       const ids=Array.isArray(raw)?raw:(raw?.checked||raw?.completedIds);
       if(!Array.isArray(ids)||ids.some(id=>!VALID.has(id)))throw new Error('Backup contains unknown topics. Use a full checklist backup for custom topics.');
       const list=[...new Set(ids)];if(confirm(`Replace current progress with ${list.length} completed topics?`))await bulk(list);
     }
   }catch(e){setError('Invalid import: '+e.message)}
 }
 function exportFile(){
   const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),plan:{...plan,completedIds:[...done]}},null,2)],{type:'application/json'});
   const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='ai-engineering-progress.json';a.click();URL.revokeObjectURL(u);
 }
 const filtered=useMemo(()=>curriculum.map(d=>{
   const groups=d.groups.map(g=>({...g,filtered:g.items.filter(t=>{
     if(query&&!`${t.id} ${t.name} ${g.name} ${d.name}`.toLowerCase().includes(query.toLowerCase()))return false;
     if(status==='done'&&!done.has(t.id))return false;
     if(status==='todo'&&done.has(t.id))return false;
     return true;
   })})).filter(g=>g.filtered.length);
   return {...d,groups};
 }).filter(d=>d.groups.length&&(pFilter==='all'||d.priority===pFilter)),[query,status,pFilter,done,curriculum]);
 const doneCount=done.size;const pct=(all.length?Math.round(doneCount/all.length*100):0);
 const originalDomain=d=>curriculum.find(item=>item.id===d.id);
 const domainTotal=(d)=>domainStats(originalDomain(d),[...done]).total;
 const domainCompleted=(d)=>domainStats(originalDomain(d),[...done]).completed;
 const domainPercent=(d)=>domainStats(originalDomain(d),[...done]).percent;
 const showConfig=!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 return <div className="app-shell">
   <header className="topbar"><div className="brand"><div className="logo"><BookOpen size={21}/></div><div><strong>AI Engineering</strong><span>2027 Career Tracker</span></div></div><div className="top-actions">{session?<><span className="user"><UserRound size={14}/>{session.user.email}</span><button className="btn subtle" onClick={signout}><LogOut size={15}/> Sign out</button></>:<span className="top-subtitle">11 domains · 534 topics</span>}</div></header>
   <main className="content-wrap">
     {showConfig?<div className="banner warn"><AlertTriangle size={18}/>Configure your Supabase URL and anon key in <code>.env.local</code> (and Vercel settings) to enable authentication and cloud syncing.</div>:null}
     {error?<div className="banner err"><AlertTriangle size={18}/><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>:null}
     {notice?<div className="banner good"><CheckCircle2 size={18}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={()=>setNotice('')}><X size={16}/></button></div>:null}
     {!authReady?<div className="auth-card"><RefreshCw className="spin"/> Loading your account...</div>:!session?<section className="auth-layout"><div className="auth-copy"><span className="eyebrow">YOUR AI ENGINEERING JOURNEY</span><h1>Master the systems behind intelligent agents.</h1><p>Track your preparation for Agentic AI Developer, AI Software Engineer (MCP Systems), and GenAI Engineer roles.</p><div className="stats-hero"><div><strong>11</strong><span>Domains</span></div><div><strong>73</strong><span>Modules</span></div><div><strong>534</strong><span>Topics</span></div></div><p className="small-note">Private progress tracking with secure login and PostgreSQL syncing.</p></div><div className="auth-card"><div className="auth-heading"><div className="auth-icon"><LogIn size={20}/></div><h2>{mode==='signup'?'Create your account':'Welcome back'}</h2><p>{mode==='signup'?'Start tracking your skills across devices.':'Sign in to continue your learning progress.'}</p></div><form onSubmit={authenticate}><label>Email address<input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required minLength={6} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder="At least 6 characters" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary full" type="submit" disabled={authBusy||!supabase}>{authBusy?'Please wait...':mode==='signup'?'Create account':'Sign in'}<ArrowRight size={16}/></button></form><div className="auth-switch">{mode==='signup'?'Already have an account?':'New here?'} <button onClick={()=>{setMode(mode==='signup'?'signin':'signup');setError('')}}>{mode==='signup'?'Sign in':'Create an account'}</button></div></div></section>:<>
     {!ready&&!loading?<div className="banner warn">Checklist is unavailable. Reload after resolving the error above. <button className="btn" onClick={()=>window.location.reload()}>Reload</button></div>:null}
     {editing&&ready?<ChecklistEditor key={session.user.id} plan={{...plan,completedIds:[...done]}} busy={loading} onSave={savePlan} onClose={()=>setEditing(false)}/>:null}
     <section className="intro"><div><span className="eyebrow">THE 2027 ENGINEERING ROADMAP</span><h1>Build exceptional engineering depth.</h1><p>Your personal curriculum, with every milestone synced to your account.</p></div><button className="btn primary" disabled={!ready||loading} onClick={()=>setEditing(true)}><Target size={18}/> Customize checklist</button></section>
     <section className="cards"><article className="metric highlight"><span>Overall progress</span><strong>{pct}%</strong><div className="bar"><div style={{width:`${pct}%`}}/></div><small>{doneCount} of {all.length} topics complete</small></article><article className="metric"><span>Topics completed</span><strong>{doneCount}<em> / {all.length}</em></strong><small>{all.length-doneCount} remaining</small></article><article className="metric"><span>Domains completed</span><strong>{curriculum.filter(d=>domainTotal(d)>0&&domainCompleted(d)===domainTotal(d)).length}<em> / {curriculum.length}</em></strong><small>Keep building every week</small></article><article className="metric"><span>Current focus</span><strong className="small-strong">{focus?.name||'Choose your focus'}</strong><small>{focus?`Priority ${focus.priority}`:'Set in Customize checklist'}</small></article></section>
     <section className="dashboard"><div className="sidebar"><div className="side-title">YOUR CURRICULUM</div>{curriculum.map(d=>{let count=domainCompleted(d),total=domainTotal(d);return <button key={d.id} className="side-link" onClick={()=>{setPFilter('all');setStatus('all');setQuery('');setExpanded(p=>new Set([...p,d.id]));setTimeout(()=>document.getElementById('domain-'+d.id)?.scrollIntoView({behavior:'smooth',block:'start'}),50)}}><span className="side-number">{d.id.startsWith('custom-')?'•':String(d.id).padStart(2,'0')}</span><span className="side-name">{d.name}<small>{count}/{total} · {domainPercent(d)}%</small></span></button>})}<div className="side-bottom"><strong>Your baseline</strong><p>Self-assessed scores are shown on each domain. They are not completion rates.</p></div></div>
     <div className="main-panel"><div className="toolbar"><div className="search"><Search size={18}/><input aria-label="Search topics" placeholder={`Search ${all.length} topics...`} value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Completion filter" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All topics</option><option value="todo">Not completed</option><option value="done">Completed</option></select><select aria-label="Priority filter" value={pFilter} onChange={e=>setPFilter(e.target.value)}><option value="all">All priorities</option><option value="P0">P0 · Critical</option><option value="P1">P1 · High</option><option value="P2">P2 · Medium</option><option value="Maintain">Maintain</option></select></div>
     <div className="actions"><span>{loading?'Syncing progress...':`${filtered.reduce((n,d)=>n+d.groups.reduce((z,g)=>z+g.filtered.length,0),0)} topics shown`}</span><div><button className="btn mini" onClick={()=>setExpanded(new Set(curriculum.map(d=>d.id)))}>Expand all</button><button className="btn mini" onClick={()=>setExpanded(new Set())}>Collapse all</button><button className="btn mini" disabled={!ready||loading} onClick={exportFile}><Download size={14}/> Export</button><button className="btn mini" disabled={!ready||loading} onClick={()=>fileInput.current?.click()}><Upload size={14}/> Import</button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile}/></div></div>
     {filtered.length===0?<div className="empty">{curriculum.length?'No matching topics. Try clearing your filters.':'Your checklist is empty. Use Customize checklist to add a domain, module and topics.'}</div>:filtered.map(d=>{const total=domainTotal(d),completed=domainCompleted(d),open=expanded.has(d.id);return <section id={'domain-'+d.id} className="domain" key={d.id}><button className="domain-header" aria-expanded={open} onClick={()=>setExpanded(p=>{let n=new Set(p);n.has(d.id)?n.delete(d.id):n.add(d.id);return n})}><span className="domain-icon">{iconFor(d.id)}</span><span className="domain-heading"><strong>{d.id.startsWith('custom-')?'•':String(d.id).padStart(2,'0')}. {d.name}</strong><small>Self-rating: {d.rating===null?'Not rated':`${d.rating}/5`} · {completed} of {total} topics</small></span><span className={'priority '+priority(d.priority)}>{d.priority}</span><span className="domain-percent">{domainPercent(d)}%</span>{open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button><div className="domain-bar"><div style={{width:`${domainPercent(d)}%`}}/></div>{open?<div className="domain-content">{d.groups.map(g=><div className="group" key={g.id}><div className="group-title"><span>{g.id.startsWith('custom-')?'':g.id} {g.name}</span><small>{g.items.filter(t=>done.has(t.id)).length}/{g.items.length}</small></div>{g.filtered.map(t=><label key={t.id} className={'task '+(done.has(t.id)?'completed':'')+(saving.has(t.id)?' saving':'')}><input type="checkbox" checked={done.has(t.id)} disabled={!ready||loading} onChange={e=>toggle(t.id,e.target.checked)}/><span className="fake-check">{done.has(t.id)?<CheckCircle2 size={19}/>:<Circle size={19}/>}</span>{!t.id.startsWith('custom-')?<span className="task-id">{t.id}</span>:null}<span className="task-name">{t.name}</span></label>)}</div>)}</div>:null}</section>})}
     <div className="reset-box"><div><strong>Backup or reset your progress</strong><p>Export a JSON backup before changing all completed topics.</p></div><button className="btn danger-outline" disabled={!ready||loading} onClick={()=>{if(confirm('Reset ALL topic progress to incomplete? This affects your synced account and cannot be undone unless you exported a backup.'))bulk([])}}>Reset progress</button></div>
     </div></section>
     </>}
   </main><footer className="footer">AI Engineering Career Tracker · Your learning plan, your priorities</footer>
 </div>;
}
