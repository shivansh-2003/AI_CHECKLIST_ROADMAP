import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

// Exercise the real production route with an in-memory Supabase HTTP substitute.
// This verifies handler behavior; actual PostgreSQL RLS requires live Supabase testing.
test('API isolates two accounts, persists customization, validates and rejects stale writes',async t=>{
 const rows=new Map();
 const mock=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const owner=(req.headers.authorization||'').replace('Bearer ','');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/v1/user') return owner==='alice'||owner==='bob' ? send(200,{id:owner,aud:'authenticated',email:`${owner}@example.test`}) : send(401,{message:'Invalid token'});
  if(url.searchParams.get('user_id')!==`eq.${owner}` && req.method!=='POST')return send(403,{message:'User isolation failure'});
  if(url.pathname==='/rest/v1/topic_progress')return send(200,owner==='alice'?[{topic_id:'1.1.1',completed:true}]:[]);
  if(url.pathname!=='/rest/v1/account_checklists')return send(404,{});
  if(req.method==='GET')return send(200,rows.has(owner)?[rows.get(owner)]:[]);
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text);
  if(req.method==='POST'){
   if(body.user_id!==owner)return send(403,{});
   if(rows.has(owner))return send(409,{code:'23505'});
   rows.set(owner,body);return send(201,{revision:body.revision});
  }
  if(req.method==='PATCH'){
   const row=rows.get(owner);
   if(!row||url.searchParams.get('revision')!==`eq.${row.revision}`)return send(200,[]);
   rows.set(owner,{...row,...body});return send(200,[{revision:body.revision}]);
  }
  send(405,{});
 });
 mock.listen(0,'127.0.0.1');await once(mock,'listening');
 t.after(()=>new Promise(resolve=>mock.close(resolve)));
 const portServer=createServer();portServer.listen(0,'127.0.0.1');await once(portServer,'listening');const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
 let logs='';
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${mock.address().port}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-key'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 t.after(async()=>{child.kill();await once(child,'exit');});
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<100;i++){try{await fetch(base);break;}catch{if(child.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,100));}}
 async function api(owner,method='GET',body){const r=await fetch(base+'/api/progress',{method,headers:{...(owner?{Authorization:`Bearer ${owner}`} : {}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 assert.equal((await api('')).status,401);
 assert.equal((await api('bad')).status,401);
 const a=await api('alice'),b=await api('bob');
 assert.equal(a.status,200,JSON.stringify(a));assert.equal(b.status,200);
 assert.deepEqual(a.data.plan.completedIds,['1.1.1']);assert.deepEqual(b.data.plan.completedIds,[]);
 const plan={domains:[{id:'personal',name:'Alice only',priority:'P2',rating:3,groups:[{id:'module',name:'My module',items:[{id:'topic',name:'My topic'}]}]}],focusId:'personal',completedIds:[]};
 const save=await api('alice','PATCH',{revision:0,plan});assert.equal(save.status,200,JSON.stringify(save));assert.equal(save.data.revision,1);
 assert.equal((await api('bob')).data.plan.domains.length,11);
 assert.equal((await api('alice')).data.plan.domains[0].name,'Alice only');
 assert.equal((await api('alice','PATCH',{revision:0,plan})).status,409);
 assert.equal((await api('alice','PATCH',{revision:1,topicId:'1.1.1',completed:true})).status,400);
 const done=await api('alice','PATCH',{revision:1,topicId:'topic',completed:true});assert.equal(done.status,200);assert.deepEqual(done.data.plan.completedIds,['topic']);
 assert.equal((await api('alice','PUT',{revision:2,completedIds:[]})).status,200);
 const concurrent=await Promise.all([api('alice','PATCH',{revision:3,topicId:'topic',completed:true}),api('alice','PATCH',{revision:3,topicId:'topic',completed:true})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 assert.equal((await api('alice','PATCH',{revision:4,plan:{...plan,focusId:'bob-domain'}})).status,400);
 assert.deepEqual((await api('bob')).data.plan.completedIds,[]);
});
