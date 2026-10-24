export const PRIORITIES = ['P0', 'P1', 'P2', 'Maintain'];
export function topicIds(domains) {
  return domains.flatMap(d => d.groups.flatMap(g => g.items.map(t => t.id)));
}
export function defaultChecklist(curriculum, progress = []) {
  const domains = structuredClone(curriculum).map(d => ({...d, rating: null}));
  const valid = new Set(topicIds(domains));
  return {domains, focusId: '', completedIds: progress.filter(p => p.completed && valid.has(p.topic_id)).map(p => p.topic_id)};
}
export function validateChecklist(plan) {
  if (!plan || !Array.isArray(plan.domains) || plan.domains.length > 100) return false;
  const seen = new Set();
  const validText = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 300;
  const validId = id => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(id) || seen.has(id)) return false;
    seen.add(id); return true;
  };
  let groups = 0, topics = 0;
  for (const d of plan.domains) {
    if (!d || !validId(d.id) || !validText(d.name) || !PRIORITIES.includes(d.priority) || !(d.rating === null || (typeof d.rating === 'number' && Number.isFinite(d.rating) && d.rating >= 0 && d.rating <= 5)) || !Array.isArray(d.groups)) return false;
    groups += d.groups.length;
    for (const g of d.groups) {
      if (!g || !validId(g.id) || !validText(g.name) || !Array.isArray(g.items)) return false;
      topics += g.items.length;
      for (const t of g.items) if (!t || !validId(t.id) || !validText(t.name)) return false;
    }
  }
  const ids = new Set(topicIds(plan.domains));
  return groups <= 500 && topics <= 2000 && typeof plan.focusId === 'string' && (plan.focusId === '' || plan.domains.some(d => d.id === plan.focusId)) && Array.isArray(plan.completedIds) && plan.completedIds.length <= topics && new Set(plan.completedIds).size === plan.completedIds.length && plan.completedIds.every(id => ids.has(id));
}
export function domainStats(domain, completedIds) {
  const ids = topicIds([domain]);
  const done = new Set(completedIds);
  const completed = ids.filter(id => done.has(id)).length;
  return {total: ids.length, completed, percent: ids.length ? Math.round(completed / ids.length * 100) : 0};
}
