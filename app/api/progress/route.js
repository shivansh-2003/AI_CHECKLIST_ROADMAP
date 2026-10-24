import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import curriculum from '../../../lib/curriculum.json';

export const runtime='nodejs';
import {defaultChecklist, topicIds, validateChecklist} from '../../../lib/checklist.mjs';
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
async function readChecklist(ctx) {
  const {data, error} = await ctx.db.from('account_checklists').select('state,revision').eq('user_id', ctx.user.id).maybeSingle();
  if (error) throw new Error('Could not load account checklist. Run the updated supabase/schema.sql. ' + error.message);
  if (data) return {plan: data.state, revision: data.revision};
  const legacy = await ctx.db.from('topic_progress').select('topic_id,completed').eq('user_id', ctx.user.id);
  if (legacy.error) throw new Error('Could not migrate existing progress: ' + legacy.error.message);
  return {plan: defaultChecklist(curriculum, legacy.data || []), revision: 0};
}
export async function GET(request) {
  const ctx = await context(request);
  if (ctx.error) return response(ctx.error, ctx.status);
  try { return NextResponse.json(await readChecklist(ctx)); }
  catch (error) { return response(error.message, 500); }
}
async function mutate(request, replaceProgress = false) {
  const ctx = await context(request);
  if (ctx.error) return response(ctx.error, ctx.status);
  let body;
  try { body = await request.json(); } catch { return response('Invalid JSON'); }
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0) return response('A checklist revision is required');
  try {
    const current = await readChecklist(ctx);
    if (current.revision !== body.revision) return response('Your checklist changed in another tab or device. Reload before saving again.', 409);
    let plan;
    if (replaceProgress) {
      plan = {...current.plan, completedIds: body.completedIds};
    } else if (Object.hasOwn(body, 'plan')) {
      plan = body.plan;
    } else {
      if (!topicIds(current.plan.domains).includes(body.topicId) || typeof body.completed !== 'boolean') return response('Invalid topic or completion state');
      const completed = new Set(current.plan.completedIds);
      body.completed ? completed.add(body.topicId) : completed.delete(body.topicId);
      plan = {...current.plan, completedIds: [...completed]};
    }
    if (!validateChecklist(plan)) return response('Invalid checklist. Check names, priorities, ratings, topic IDs, and size limits (100 domains, 500 modules, 2000 topics).');
    const row = {state: plan, revision: current.revision + 1, updated_at: new Date().toISOString()};
    const result = current.revision === 0
      ? await ctx.db.from('account_checklists').insert({...row, user_id: ctx.user.id}).select('revision').single()
      : await ctx.db.from('account_checklists').update(row).eq('user_id', ctx.user.id).eq('revision', current.revision).select('revision').maybeSingle();
    if (result.error?.code === '23505' || (!result.error && !result.data)) return response('Your checklist changed in another tab or device. Reload before saving again.', 409);
    if (result.error) return response('Checklist save failed: ' + result.error.message, 500);
    return NextResponse.json({ok: true, plan, revision: result.data.revision});
  } catch (error) { return response(error.message, 500); }
}
export async function PATCH(request) { return mutate(request); }
export async function PUT(request) { return mutate(request, true); }
