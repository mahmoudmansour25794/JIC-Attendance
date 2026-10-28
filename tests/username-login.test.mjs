import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLoginHandler } from '../supabase/functions/username-login/handler.js';
function fixture({known=true,passwordOk=true,allowed=true,limiterError=false,lookupError=false}={}) {
  const calls=[];
  const admin={
    async rpc(name,args){calls.push({name,args});return {data:allowed,error:limiterError?{}:null}},
    from(){return {select(){return {eq(key,value){calls.push({key,value});return {async maybeSingle(){return {data:known?{user_id:'u1'}:null,error:lookupError?{}:null}}}}}}}},
    auth:{admin:{async getUserById(id){assert.equal(id,'u1');return {data:{user:{email:'private@example.invalid'}},error:null}}}},
  };
  const authClient = () => ({
    auth: {
      async signInWithPassword(args) {
        calls.push({credentials:args});
        return {
          data: passwordOk ? {user:{id:'u1'},session:{access_token:'access',refresh_token:'refresh'}} : {},
          error: passwordOk ? null : {message:'private upstream error'},
        };
      },
    },
  });
  const handler=makeLoginHandler({admin,hash:async s=>'hash:'+s,delay:async()=>{},authClient});
  const request=(body={username:'hashem',password:'password'})=>handler(new Request('https://example.invalid/login',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)}));
  return {handler,request,calls};
}
test('normalizes username, preserves password, returns tokens only after Auth success',async()=>{
 const f=fixture();const r=await f.request({username:' Hashem ',password:' unchanged password '});assert.equal(r.status,200);assert.deepEqual(await r.json(),{access_token:'access',refresh_token:'refresh'});assert(f.calls.some(c=>c.value==='hashem'));assert.equal(f.calls.find(c=>c.credentials).credentials.password,' unchanged password ');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unknown account and wrong password have identical generic response',async()=>{
 const a=await fixture({known:false,passwordOk:false}).request();const b=await fixture({passwordOk:false}).request();assert.equal(a.status,401);assert.equal(b.status,401);assert.equal(await a.text(),await b.text());
});
test('rate limits block password verification',async()=>{
 const f=fixture({allowed:false});const r=await f.request();assert.equal(r.status,429);assert(!f.calls.some(c=>c.credentials));
});
test('limiter failure fails closed',async()=>{assert.equal((await fixture({limiterError:true}).request()).status,503)});
test('invalid username and email-as-username rejected before lookup',async()=>{
 for(const username of ['x','hashem@example.com','has hem','x'.repeat(33)]) {const f=fixture();assert.equal((await f.request({username,password:'p'})).status,401);assert.equal(f.calls.length,0)}
});
test('body size, malformed JSON and method restrictions',async()=>{
 const {handler,request}=fixture();assert.equal((await request({username:'hashem',password:'x'.repeat(9000)})).status,413);
 assert.equal((await handler(new Request('https://example.invalid',{method:'POST',body:'{'}))).status,400);
 assert.equal((await handler(new Request('https://example.invalid'))).status,405);
 const preflight=await handler(new Request('https://example.invalid',{method:'OPTIONS'}));assert.equal(preflight.status,200);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
});
