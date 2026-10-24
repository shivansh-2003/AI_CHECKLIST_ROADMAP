import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import curriculum from '../../../lib/curriculum.json';

export const runtime='nodejs';
const VALID_IDS=new Set(curriculum.flatMap(s=>s.groups.flatMap(g=>g.items.map(t=>t.id))));
function response(error,status=400){return NextResponse.json({error},{status});}
async function context(request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) return {error:'Supabase environment variables are missing',status:503};
  const bearer=request.headers.get('authorization')||'';
  const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  if(!token) return {error:'Authentication required',status:401};
  const authClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await authClient.auth.getUser(token);
  if(error||!user) return {error:'Invalid or expired session',status:401};
  const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  return {db,user};
}
export async function GET(request){
  const ctx=await context(request);
  if(ctx.error)return response(ctx.error,ctx.status);
  const {data,error}=await ctx.db.from('topic_progress').select('topic_id,completed,updated_at').eq('user_id',ctx.user.id);
  if(error)return response('Database read failed: '+error.message,500);
  return NextResponse.json({progress:data||[]});
}
export async function PATCH(request){
  const ctx=await context(request);
  if(ctx.error)return response(ctx.error,ctx.status);
  let body;
  try{body=await request.json();}catch{return response('Invalid JSON');}
  if(!body||typeof body.topicId!=='string'||!VALID_IDS.has(body.topicId)||typeof body.completed!=='boolean') return response('Invalid topic or completion state');
  const {error}=await ctx.db.from('topic_progress').upsert({user_id:ctx.user.id,topic_id:body.topicId,completed:body.completed,updated_at:new Date().toISOString()},{onConflict:'user_id,topic_id'});
  if(error)return response('Database update failed: '+error.message,500);
  return NextResponse.json({ok:true,topicId:body.topicId,completed:body.completed});
}
export async function PUT(request){
  const ctx=await context(request);
  if(ctx.error)return response(ctx.error,ctx.status);
  let body;
  try{body=await request.json();}catch{return response('Invalid JSON');}
  if(!Array.isArray(body?.completedIds)||body.completedIds.length>VALID_IDS.size||body.completedIds.some(id=>typeof id!=='string'||!VALID_IDS.has(id)))return response('Invalid checklist import');
  const completed=new Set(body.completedIds);
  // Batch upserts preserve the stable topic IDs; 534 rows is a manageable one-time import.
  const rows=[...VALID_IDS].map(topic_id=>({user_id:ctx.user.id,topic_id,completed:completed.has(topic_id),updated_at:new Date().toISOString()}));
  for(let i=0;i<rows.length;i+=200){
    const {error}=await ctx.db.from('topic_progress').upsert(rows.slice(i,i+200),{onConflict:'user_id,topic_id'});
    if(error)return response('Import failed: '+error.message,500);
  }
  return NextResponse.json({ok:true,count:completed.size});
}
