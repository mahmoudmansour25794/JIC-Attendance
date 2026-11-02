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
 let rows=structuredClone(initialRows),exports=[],queries=[],fail=false,confirmed=true,loginBody,loseInsertResponse=false;
 const session={user:{id:'u1',email:'private@example.invalid'}};
 const db={auth:{onAuthStateChange(){},async getSession(){return {data:{session:loggedIn?session:null},error:null}},async setSession(tokens){assert.equal(tokens.access_token,'access');return {data:{session},error:null}},async signOut(){return {error:null}}},from(table){
  let from,to,id,less,greater,ascending=true,operation='select',payload;
  const q={select(){return q},gte(k,v){from=v;return q},lte(k,v){to=v;return q},lt(k,v){less=v;return q},gt(k,v){greater=v;return q},order(k,options){if(options)ascending=options.ascending;return q},async limit(n){if(fail)return {error:{message:'offline'}};return {data:rows.filter(r=>(!less||r.attendance_date<less)&&(!greater||r.attendance_date>greater)).sort((a,b)=>(ascending?1:-1)*a.attendance_date.localeCompare(b.attendance_date)).slice(0,n),error:null}},eq(k,v){id=v;return q},insert(p){operation='insert';payload=p;return q},update(p){operation='update';payload=p;return q},delete(){operation='delete';return q},
   async maybeSingle(){if(table==='app_users')return {data:{user_id:'u1',username:'hashem'},error:null};return {data:structuredClone(rows.find(r=>r.id===id) || null),error:null}},
   async range(start,end){queries.push({from,to,start,end});if(fail)return {error:{message:'offline'}};return {data:rows.filter(r=>r.attendance_date>=from&&r.attendance_date<=to).sort((a,b)=>a.attendance_date.localeCompare(b.attendance_date)||a.id.localeCompare(b.id)).slice(start,end+1),error:null}},
   then(resolve,reject){return Promise.resolve({data:[{id:795,name:'Ahmed',lob:'Justice'}],error:null}).then(resolve,reject)},
   async single(){if(fail)return {error:{message:'offline'}};let r=rows.find(r=>r.id===id);if(operation==='insert'){if(rows.some(r=>r.id===payload.id || (r.employee_id===payload.employee_id && r.attendance_date===payload.attendance_date)))return {error:{code:'23505',message:'duplicate key'}};r={...payload,created_at:'2026-10-28T12:00:00Z'};rows.push(r);if(loseInsertResponse){loseInsertResponse=false;return {error:{message:'response lost'}}}}if(operation==='update'&&r)Object.assign(r,payload);if(operation==='delete')rows=rows.filter(r=>r.id!==id);return r?{data:structuredClone(r),error:null}:{error:{message:'not found'}}},
  };return q;
 }};
 const c={Date:FixedDate,Intl,console,crypto:webcrypto,setTimeout,window:{supabase:{createClient:()=>db}},document:{getElementById:el,querySelector:()=>el('tbody'),createElement:()=>new Element()},alert:message=>el('alert').textContent=message,confirm:()=>confirmed,fetch:async(url,opts)=>{loginBody=JSON.parse(opts.body);assert(url.endsWith('/username-login'));return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh'})}},XLSX:{utils:{book_new:()=>({}),aoa_to_sheet:x=>x,book_append_sheet:(wb,s,n)=>wb[n]=s},writeFile:(wb,name)=>exports.push({wb,name})}};
 vm.createContext(c);vm.runInContext(script,c);
 const run=s=>vm.runInContext(s,c); const tick=()=>new Promise(r=>setImmediate(r)); await tick();await tick();
 const filter=async(from,to)=>{el('fromDate').value=from;el('toDate').value=to;await run('applyDateFilter()')};
 return {el,run,filter,exports,queries,rows:()=>rows,fail:v=>fail=v,confirm:v=>confirmed=v,login:()=>loginBody,loseInsertResponse:()=>loseInsertResponse=true,tick};
}
const sample=()=>[record('2026-10-09','r9'),record('2026-10-05','r5'),record('2026-10-07','r7','Sick Leave'),record('2026-10-28','today'),record('2026-10-04','before'),record('2026-10-10','after')];
test('opens on Cairo today, loads only today and shows current username',async()=>{
 const a=await app(sample());assert.equal(a.el('fromDate').value,'2026-10-28');assert.equal(a.el('toDate').value,'2026-10-28');assert.equal(a.el('appPanel').hidden,false);assert.equal(a.el('accountUsername').textContent,'hashem');assert.equal(a.el('tbody').children.length,1);assert.equal(a.queries[0].from,'2026-10-28');assert.equal(a.run("todayDate(new Date('2026-10-27T22:30:00Z'))"),'2026-10-28');
});
test('range starts at first populated day, arrows skip gaps and export the entire sorted period',async()=>{
 const a=await app(sample());await a.filter('2026-10-05','2026-10-09');
 assert.equal(a.run('selectedDay'),'2026-10-05');assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('previousDayButton').disabled,true);assert.equal(a.el('nextDayButton').disabled,false);
 await a.run('navigateDay(1)');assert.equal(a.run('selectedDay'),'2026-10-07');assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('tbody').children[0].children[0].textContent,'2026-10-07');
 a.run('exportToExcel()');const exported=a.exports[0];
 assert.deepEqual(Array.from(exported.wb['Support Team Attendance'].slice(1),r=>r[0]),['2026-10-05','2026-10-07','2026-10-09']);assert.equal(exported.wb.Summary[1][4],2);assert.equal(exported.wb.Summary[1][7],1);assert.equal(exported.wb.Summary[1][3],21);assert.equal(exported.wb.Summary[1][10].v,1);assert.equal(exported.wb.Summary[1][10].z,'[h]:mm');assert.equal(exported.name,'Attendance_Report_2026-10-05_to_2026-10-09.xlsx');
 await a.run('navigateDay(1)');assert.equal(a.run('selectedDay'),'2026-10-09');assert.equal(a.el('nextDayButton').disabled,true);await a.run('navigateDay(1)');assert.equal(a.run('selectedDay'),'2026-10-09');
 await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-07');
});
test('blank To uses today; equal dates select one day; empty days omitted',async()=>{
 const a=await app(sample());await a.filter('2026-10-09','');assert.equal(a.run('activeRange.to'),'2026-10-28');assert.equal(a.el('tbody').children.length,1);assert.equal(a.run('records.length'),3);
 await a.filter('2026-10-07','2026-10-07');assert.equal(a.el('tbody').children.length,1);
 await a.filter('2026-10-06','2026-10-06');assert.equal(a.el('previousDayButton').disabled,true);assert.equal(a.el('nextDayButton').disabled,true);assert.equal(a.el('emptyRecords').hidden,false);a.run('exportToExcel()');assert.equal(a.exports.length,0);
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
test('delete last record of displayed day advances to next remaining day; cancellation preserves it',async()=>{
 const a=await app(sample());await a.filter('2026-10-05','2026-10-09');await a.run('navigateDay(1)');
 a.confirm(false);await a.run("deleteRecord('r7')");assert.equal(a.rows().length,6);a.confirm(true);await a.run("deleteRecord('r7')");
 assert.equal(a.run('selectedDay'),'2026-10-09');assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('nextDayButton').disabled,true);await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-05');
});
test('edit recalculates hours and export sees updated row',async()=>{
 const a=await app(sample());a.run("startEdit('today')");a.el('checkIn').value='10:00';a.el('checkOut').value='17:00';a.el('empSelect').value='795';await a.run('addRecord()');assert.equal(a.rows().find(r=>r.id==='today').hours,'07:00');a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'][1][5].v,7/24);assert.equal(a.exports[0].wb['Support Team Attendance'][1][5].f,'IF(OR(D2="",E2=""),0,MOD(E2-D2,1))');
});
test('inserting outside the period saves but does not contaminate displayed/exported range',async()=>{
 const a=await app(sample());a.el('empSelect').value='795';a.el('attDate').value='2026-10-01';a.el('checkIn').value='09:00';a.el('checkOut').value='17:00';await a.run('addRecord()');assert.equal(a.rows().length,7);assert.equal(a.el('tbody').children.length,1);a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'].length,2);
});
test('username login uses endpoint then adopts Supabase session',async()=>{
 const a=await app(sample(),false);a.el('username').value=' Hashem ';a.el('password').value='unchanged password';await a.el('loginForm').events.submit({preventDefault(){}});assert.equal(a.login().username,'hashem');assert.equal(a.login().password,'unchanged password');assert.equal(a.el('password').value,'');assert.equal(a.el('appPanel').hidden,false);
});

test('homepage arrows browse nearest saved dates and export only the displayed day',async()=>{
 const a=await app(sample());assert.equal(a.run('selectedDay'),'2026-10-28');assert.equal(a.el('nextDayButton').disabled,true);
 await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-10');assert.equal(a.el('tbody').children.length,1);assert.equal(a.el('fromDate').value,'2026-10-10');
 a.run('exportToExcel()');assert.deepEqual(Array.from(a.exports[0].wb['Support Team Attendance'].slice(1),r=>r[0]),['2026-10-10']);assert.equal(a.exports[0].name,'Attendance_Report_2026-10-10_to_2026-10-10.xlsx');
 await a.run('navigateDay(1)');assert.equal(a.run('selectedDay'),'2026-10-28');
});
test('empty today remains visible initially and arrows can reach nearest saved date',async()=>{
 const a=await app([record('2026-10-05','past'),record('2026-10-30','future')]);
 assert.equal(a.run('selectedDay'),'2026-10-28');assert.equal(a.el('emptyRecords').hidden,false);assert.equal(a.el('previousDayButton').disabled,false);assert.equal(a.el('nextDayButton').disabled,false);
 await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-05');assert.equal(a.el('previousDayButton').disabled,true);await a.run('navigateDay(1)');assert.equal(a.run('selectedDay'),'2026-10-30');
});
test('no records disable both arrows on homepage and in filtered range',async()=>{
 const a=await app([]);assert.equal(a.el('previousDayButton').disabled,true);assert.equal(a.el('nextDayButton').disabled,true);assert.equal(a.el('emptyRecords').hidden,false);
 await a.filter('2026-10-01','2026-10-31');assert.equal(a.run('selectedDay'),null);assert.equal(a.el('previousDayButton').disabled,true);assert.equal(a.el('nextDayButton').disabled,true);
});
test('navigation confirms unsaved edits, blocks dirty filters and preserves prior day on fetch failure',async()=>{
 const a=await app(sample());a.run("startEdit('today')");a.confirm(false);await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-28');assert.equal(a.run('editingId'),'today');
 a.confirm(true);await a.run('navigateDay(-1)');assert.equal(a.run('editingId'),null);assert.equal(a.run('selectedDay'),'2026-10-10');
 a.fail(true);await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-10');assert.equal(a.el('tbody').children[0].children[0].textContent,'2026-10-10');a.fail(false);
 a.el('fromDate').value='2026-10-01';a.run('updateFilterHint()');assert.equal(a.el('previousDayButton').disabled,true);await a.run('navigateDay(-1)');assert.equal(a.run('selectedDay'),'2026-10-10');
});
test('Today restores home browsing and single-day export after a range',async()=>{
 const a=await app(sample());await a.filter('2026-10-05','2026-10-09');await a.run('openHomeDay(todayDate())');assert.equal(a.run('browseMode'),'home');assert.equal(a.run('selectedDay'),'2026-10-28');a.run('exportToExcel()');assert.equal(a.exports[0].wb['Support Team Attendance'].length,2);
});

function enterAttendance(a,date='2026-10-28') {
 a.el('empSelect').value='795';a.el('attDate').value=date;a.el('checkIn').value='09:00';a.el('checkOut').value='17:00';
}
test('same employee and day is rejected locally with a clear Arabic error; editing remains available',async()=>{
 const a=await app(sample());enterAttendance(a);await a.run('addRecord()');assert.equal(a.rows().length,6);assert.match(a.el('status').textContent,/الشخص مسجل من قبل في هذا اليوم/);assert.equal(a.el('status').attributes.role,'alert');
 a.run("startEdit('today')");a.el('checkIn').value='10:00';await a.run('addRecord()');assert.equal(a.rows().length,6);assert.equal(a.rows().find(r=>r.id==='today').hours,'07:00');
});
test('database duplicate outside the viewed day displays the same error without changing existing data',async()=>{
 const a=await app(sample());enterAttendance(a,'2026-10-05');await a.run('addRecord()');assert.equal(a.rows().length,6);assert.match(a.el('status').textContent,/الشخص مسجل من قبل في هذا اليوم/);assert.equal(a.rows().find(r=>r.id==='r5').check_in,'09:00:00');assert.equal(a.el('addButton').disabled,false);
});
test('a concurrent addition from another browser is caught by the database conflict',async()=>{
 const a=await app([]);a.rows().push(record('2026-10-28','other-browser'));enterAttendance(a);await a.run('addRecord()');assert.equal(a.rows().length,1);assert.match(a.el('status').textContent,/الشخص مسجل من قبل في هذا اليوم/);
});
test('employee can be added on another day, and after deleting their existing same-day record',async()=>{
 const a=await app([record('2026-10-27','yesterday')]);enterAttendance(a);await a.run('addRecord()');assert.equal(a.rows().length,2);
 const id=a.rows().find(r=>r.attendance_date==='2026-10-28').id;await a.run(`deleteRecord('${id}')`);assert.equal(a.rows().length,1);enterAttendance(a);await a.run('addRecord()');assert.equal(a.rows().length,2);
});
test('different employees can have attendance on the same day',async()=>{
 const other={...record('2026-10-28','other-employee'),employee_id:829};const a=await app([other]);enterAttendance(a);await a.run('addRecord()');assert.equal(a.rows().length,2);assert.equal(a.rows().filter(r=>r.employee_id===795).length,1);
});
test('retry after lost insert response recovers the saved UUID without duplication',async()=>{
 const a=await app([]);enterAttendance(a);a.loseInsertResponse();await a.run('addRecord()');assert.equal(a.rows().length,1);const savedId=a.rows()[0].id;assert.match(a.el('status').textContent,/تعذر تأكيد الحفظ/);await a.run('addRecord()');assert.equal(a.rows().length,1);assert.equal(a.rows()[0].id,savedId);assert.equal(a.run('records.length'),1);assert.match(a.el('status').textContent,/تم حفظ التسجيل/);
});

test('Excel formulas use entered times only and ignore notes and previously saved hour totals',async()=>{
 const permission={...record('2026-10-05','permission','إذن ساعتين'),check_in:'11:00:00',check_out:'17:00:00',hours:'08:00'};
 const leave={...record('2026-10-07','leave','Sick Leave'),check_in:'10:00:00',check_out:'17:00:00',hours:'00:00'};
 const a=await app([permission,leave]);await a.filter('2026-10-05','2026-10-09');a.run('exportToExcel()');const wb=a.exports[0].wb;
 const detail=wb['Support Team Attendance'];assert.equal(detail[1][3].v,11/24);assert.equal(detail[1][4].v,17/24);assert.equal(detail[1][3].z,'hh:mm');assert.equal(detail[1][5].v,6/24);assert.equal(detail[2][5].v,7/24);assert.equal(detail[2][5].f,'IF(OR(D3="",E3=""),0,MOD(E3-D3,1))');
 assert(Math.abs(wb.Summary[1][10].v-13/24)<1e-12);assert.equal(wb.Summary[1][10].f,"SUMIF('Support Team Attendance'!$H$2:$H$3,A2,'Support Team Attendance'!$F$2:$F$3)");assert.equal(detail['!cols'][7].hidden,true);
});
test('Excel durations preserve minutes, total beyond 24h, overnight shifts and empty times',async()=>{
 const rs=Array.from({length:22},(_,i)=>({...record(`2026-10-${String(i+1).padStart(2,'0')}`,String(i)),check_out:i===0?'17:30:00':'17:00:00'}));
 const a=await app(rs);await a.filter('2026-10-01','2026-10-31');a.run('exportToExcel()');const cell=a.exports[0].wb.Summary[1][10];assert(Math.abs(cell.v*24-176.5)<1e-9);assert.equal(cell.z,'[h]:mm');assert.match(cell.f,/\$F\$23/);
 const overnight={...record('2026-10-28','night'),check_in:'23:00:00',check_out:'01:30:00'};
 const b=await app([overnight]);b.run('exportToExcel()');assert.equal(b.exports[0].wb['Support Team Attendance'][1][5].v,150/1440);
 const c=await app([{...record('2026-10-28','empty'),check_in:null,check_out:null,hours:'08:00'}]);c.run('exportToExcel()');assert.equal(c.exports[0].wb['Support Team Attendance'][1][5].v,0);assert.equal(c.exports[0].wb.Summary[1][10].v,0);
});
test('Excel groups by employee ID even when names are identical',async()=>{
 const a=await app([{...record('2026-10-28','first'),check_in:'11:00:00'}, {...record('2026-10-28','second'),employee_id:829,check_out:'10:00:00'}]);
 a.run("employees.push({id:829,name:'Ahmed',lob:'Justice'});records=records.map(r=>({...r,Name:'Ahmed'}));exportToExcel()");
 const wb=a.exports[0].wb;assert.equal(wb.Summary[1][10].v,6/24);assert.equal(wb.Summary[2][10].v,1/24);assert.match(wb.Summary[2][10].f,/,A3,/);assert.equal(wb['Support Team Attendance'][1][7],795);assert.equal(wb['Support Team Attendance'][2][7],829);
});
