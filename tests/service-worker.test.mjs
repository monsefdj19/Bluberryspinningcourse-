import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const listeners={};
let cachePutAttempts=0;
const fallback=new Response('offline fallback',{status:200});
const context={
  URL,Request,Response,Promise,
  self:{
    location:{origin:'https://example.test'},
    addEventListener:(type,handler)=>{listeners[type]=handler},
    skipWaiting:async()=>{},
    clients:{claim:async()=>{}}
  },
  caches:{
    open:async()=>({
      addAll:async()=>{},
      put:async()=>{cachePutAttempts++;throw new Error('quota exceeded')}
    }),
    keys:async()=>[],
    delete:async()=>true,
    match:async()=>fallback.clone()
  },
  fetch:async()=>new Response('fresh network response',{status:200})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),context);

let responsePromise;
listeners.fetch({
  request:new Request('https://example.test/live-app.js'),
  respondWith:value=>{responsePromise=value}
});
const response=await responsePromise;
assert.equal(await response.text(),'fresh network response','cache-write failure must not replace a successful network response');
assert.equal(cachePutAttempts,1,'successful responses should attempt to update the cache');

context.fetch=async()=>{throw new Error('offline')};
listeners.fetch({
  request:new Request('https://example.test/programs.js'),
  respondWith:value=>{responsePromise=value}
});
const offlineResponse=await responsePromise;
assert.equal(await offlineResponse.text(),'offline fallback','network failure should use the cache fallback');

console.log('service-worker regression contract: PASS');
