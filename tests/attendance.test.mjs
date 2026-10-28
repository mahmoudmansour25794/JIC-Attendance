import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element {
 constructor(){this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.children=[];this.events={};this.style={};this.dataset={};this.attributes={}}
 addEventListener(type,fn){this.events[type]=fn}
 replaceChildren(){this.children=[]}
 append(...items){this.children.push(...items)}
 insertRow(){const row=new Element();this.children.push(row);return row}
 insertCell(){const cell=new Element();this.children.push(cell);return cell}
 setAttribute(k,v){this.attributes[k]=v}
 focus(){} scrollIntoView(){}
}
class FixedDate extends Date {constructor(...a){super(...(a.length?a:['2026-10-28T12:00:00Z']))} static now(){return new Date('2026-10-28T12:00:00Z').getTime()}}
function record(date,id,comments=''){return {id,employee_id:795,attendance_date:date,created_at:date+'T09:00:00Z',check_in:'09:00:00',check_out:'17:00:00',hours:'08:00',comments,created_by:'u1'}}
async function app(initialRows,loggedIn=true){
 const nodes={};const el=id=>nodes[id]??=new Element();
 let rows=structuredClone(initialRows),exports=[],queries=[],fail=false,confirmed=true,loginBody;
 const session={user:{id:'u1',email:'private@example.invalid'}};
 const db={auth:{onAuthStateChange(){},async getSession(){return {data:{session:loggedIn?session:null},error:null}},async setSession(tokens){assert.equal(tokens.access_token,'access');return {data:{session},error:null}},async signOut(){return {error:null}}},from(table){
  let from,to,id,operation='select',payload;
  const q={select(){return q},gte(k,v){from=v;return q},lte(k,v){to=v;return q},order(){return q},eq(k,v){id=v;return q},insert(p){operation='insert';payload=p;return q},update(p){operation='update';payload=p;return q},delete(){operation='delete';return q},
   async maybeSingle(){return {data:{user_id:'u1',username:'hashem'},error:null}},
   async range(start,end){queries.push({from,to,start,end});if(fail)return {error:{message:'offline'}};return {data:rows.filter(r=>r.attendance_date>=from&&r.attendance_date<=to).sort((a,b)=>a.attendance_date.localeCompare(b.attendance_date)||a.id.localeCompare(b.id)).slice(start,end+1),error:null}},
   then(resolve,reject){return Promise.resolve({data:[{id:795,name:'Ahmed',lob:'Justice'}],error:null}).then(resolve,reject)},
   async single(){if(fail)return {error:{message:'offline'}};let r=rows.find(r=>r.id===id);if(operation==='insert'){r={...payload,created_at:'2026-10-28T12:00:00Z'};rows.push(r)}if(operation==='update'&&r)Object.assign(r,payload);if(operation==='delete')rows=rows.filter(r=>r.id!==id);return r?{data:structuredClone(r),error:null}:{error:{message:'not found'}}},
  };return q;
 }};
 const c={Date:FixedDate,Intl,console,crypto:webcrypto,setTimeout,window:{supabase:{createClient:()=>db}},document:{getElementById:el,querySelector:()=>el('tbody'),createElement:()=>new Element()},alert:message=>el('alert').textContent=message,confirm:()=>confirmed,fetch:async(url,opts)=>{loginBody=JSON.parse(opts.body);assert(url.endsWith('/username-login'));return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh'})}},XLSX:{utils:{book_new:()=>({}),aoa_to_sheet:x=>x,book_append_sheet:(wb,s,n)=>wb[n]=s},writeFile:(wb,name)=>exports.push({wb,name})}};
 vm.createContext(c);vm.runInContext(script,c);
 const run=s=>vm.runInContext(s,c); const tick=()=>new Promise(r=>setImmediate(r)); await tick();await tick();
 const filter=async(from,to)=>{el('fromDate').value=from;el('toDate').value=to;await run('applyDateFilter()')};
 return {el,run,filter,exports,queries,rows:()=>rows,fail:v=>fail=v,confirm:v=>confirmed=v,login:()=>loginBody,tick};
}
const sample=()=>[record('2026-10-09','r9'),record('2026-10-05','r5'),record('2026-10-07','r7','Sick Leave'),record('2026-10-28','today'),record('2026-10-04','before'),record('2026-10-10','after')];
test('opens on Cairo today, loads only today and shows current username',async()=>{
 const a=await app(sample());assert.equal(a.el('fromDate').value,'2026-10-28');assert.equal(a.el('toDate').value,'2026-10-28');assert.equal(a.el('appPanel').hidden,false);assert.equal(a.el('accountUsername').textContent,'hashem');assert.equal(a.el('tbody').children.length,1);assert.equal(a.queries[0].from,'2026-10-28');assert.equal(a.run("todayDate(new Date('2026-10-27T22:30:00Z'))"),'2026-10-28');
});
test('inclusive range, only populated date tabs, single-day view exports whole sorted range',async()=>{
 const a=await app(sample());await a.filter('2026-10-05','2026-10-09');assert.deepEqual(a.el('datePages').children.map(b=>b.dataset.date),['all','2026-10-05','2026-10-07','2026-10-09']);
 a.el('datePages').children[2].events.click();assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('tbody').children[0].children[0].textContent,'2026-10-07');a.run('exportToExcel()');
 const exported=a.exports[0];assert.deepEqual(Array.from(exported.wb['Support Team Attendance'].slice(1),r=>r[0]),['2026-10-05','2026-10-07','2026-10-09']);assert.equal(exported.wb.Summary[1][4],2);assert.equal(exported.wb.Summary[1][7],1);assert.equal(exported.wb.Summary[1][3],21);assert.equal(exported.wb.Summary[1][10],'140:00');assert.equal(exported.name,'Attendance_Report_2026-10-05_to_2026-10-09.xlsx');
});
test('blank To uses today; equal dates select one day; empty days omitted',async()=>{
 const a=await app(sample());await a.filter('2026-10-09','');assert.equal(a.run('activeRange.to'),'2026-10-28');assert.equal(a.el('tbody').children.length,3);
 await a.filter('2026-10-07','2026-10-07');assert.equal(a.el('tbody').children.length,1);
 await a.filter('2026-10-06','2026-10-06');assert.equal(a.el('datePages').hidden,true);assert.equal(a.el('emptyRecords').hidden,false);a.run('exportToExcel()');assert.equal(a.exports.length,0);
});
test('invalid/reversed ranges do not fetch; dirty filters cannot export stale data',async()=>{
 const a=await app(sample());const count=a.queries.length;await a.filter('2026-10-09','2026-10-05');assert.equal(a.queries.length,count);a.run('exportToExcel()');assert.equal(a.exports.length,0);
 await a.filter('2026-02-30','2026-10-28');assert.equal(a.queries.length,count);
});
test('all API batches are fetched and exported beyond 1000 rows',async()=>{
 const a=await app(Array.from({length:1005},(_,i)=>record('2026-10-28',String(i).padStart(4,'0'))));assert.equal(a.el('tbody').children.length,1005);assert.equal(a.queries.length,2);a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'].length,1006);
});
test('failed filter preserves prior results and prevents mismatched export',async()=>{
 const a=await app(sample());a.fail(true);await a.filter('2026-10-05','2026-10-09');assert.equal(a.run('activeRange.from'),'2026-10-28');assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('exportButton').disabled,true);
});
test('delete last record of selected day removes its date tab; cancel prevents deletion',async()=>{
 const a=await app(sample());await a.filter('2026-10-05','2026-10-09');a.el('datePages').children[2].events.click();a.confirm(false);await a.run("deleteRecord('r7')");assert.equal(a.rows().length,6);a.confirm(true);await a.run("deleteRecord('r7')");assert.equal(a.run('selectedDay'),null);assert.deepEqual(a.el('datePages').children.map(b=>b.dataset.date),['all','2026-10-05','2026-10-09']);
});
test('edit recalculates hours and export sees updated row',async()=>{
 const a=await app(sample());a.run("startEdit('today')");a.el('checkIn').value='10:00';a.el('checkOut').value='17:00';a.el('empSelect').value='795';await a.run('addRecord()');assert.equal(a.rows().find(r=>r.id==='today').hours,'07:00');a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'][1][5],'07:00');
});
test('inserting outside the period saves but does not contaminate displayed/exported range',async()=>{
 const a=await app(sample());a.el('empSelect').value='795';a.el('attDate').value='2026-10-01';a.el('checkIn').value='09:00';a.el('checkOut').value='17:00';await a.run('addRecord()');assert.equal(a.rows().length,7);assert.equal(a.el('tbody').children.length,1);a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'].length,2);
});
test('username login uses endpoint then adopts Supabase session',async()=>{
 const a=await app(sample(),false);a.el('username').value=' Hashem ';a.el('password').value='unchanged password';await a.el('loginForm').events.submit({preventDefault(){}});assert.equal(a.login().username,'hashem');assert.equal(a.login().password,'unchanged password');assert.equal(a.el('password').value,'');assert.equal(a.el('appPanel').hidden,false);
});
