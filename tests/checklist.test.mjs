import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultChecklist, domainStats, validateChecklist} from '../lib/checklist.mjs';
const curriculum=JSON.parse(readFileSync(new URL('../lib/curriculum.json',import.meta.url)));
test('account defaults are independent and migrate only valid legacy progress',()=>{
 const a=defaultChecklist(curriculum,[{topic_id:'1.1.1',completed:true},{topic_id:'missing',completed:true}]);
 const b=defaultChecklist(curriculum);
 a.domains[0].name='Personal';
 assert.notEqual(a.domains[0].name,b.domains[0].name);
 assert.deepEqual(a.completedIds,['1.1.1']);
 assert.equal(validateChecklist(a),true);
 assert.equal(b.domains[0].rating,null);
});
test('custom checklist supports an empty plan and custom topic IDs',()=>{
 assert.equal(validateChecklist({domains:[],focusId:'',completedIds:[]}),true);
 const p={domains:[{id:'custom-domain',name:'My learning',priority:'P2',rating:2.5,groups:[{id:'custom-module',name:'Module',items:[{id:'custom-topic',name:'Topic'}]}]}],focusId:'custom-domain',completedIds:['custom-topic']};
 assert.equal(validateChecklist(p),true);
 assert.deepEqual(domainStats(p.domains[0],p.completedIds),{total:1,completed:1,percent:100});
});
test('invalid priorities, ratings, duplicates, focus and deleted topics are rejected',()=>{
 const fresh=()=>defaultChecklist(curriculum);
 for(const edit of [p=>p.domains[0].priority='urgent',p=>p.domains[0].rating=6,p=>p.domains[0].rating='3',p=>p.focusId='missing',p=>p.completedIds=['missing'],p=>p.domains[0].groups[0].items[1].id='1.1.1',p=>p.domains[0].name='   ',p=>p.completedIds=['1.1.1','1.1.1']]){
  const p=fresh();edit(p);assert.equal(validateChecklist(p),false);
 }
});
test('completion metric uses the entire domain',()=>{
 const done=curriculum[0].groups[0].items.map(t=>t.id);
 assert.deepEqual(domainStats(curriculum[0],done),{total:49,completed:7,percent:14});
 assert.equal(domainStats({groups:[]},[]).percent,0);
});
