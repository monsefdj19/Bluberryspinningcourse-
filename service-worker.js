const CACHE='first-ride-live-v9';
const CORE=['./','./index.html','./programs.js','./live-app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./First-Ride-Instructor-Guide.pdf'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){try{const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}catch(cacheError){}}
      return response;
    }catch(error){return(await caches.match(event.request))||(await caches.match('./index.html'))}
  })());
});
