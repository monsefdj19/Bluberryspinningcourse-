const CACHE='first-ride-live-v13';
const CORE=['./','./index.html','./programs.js','./local-audio.js','./live-app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./hero-spin.jpg','./First-Ride-Instructor-Guide.pdf','./test-art/01.svg','./test-art/02.svg','./test-art/03.svg','./test-art/04.svg','./test-art/05.svg'];
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
