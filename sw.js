/* Bump VERSION for each release; refresh an installed PWA without reinstall. */
const VERSION='3.0.0';
const CACHE='general-zero-mobile-'+VERSION;
const PREFIX='general-zero-mobile-';
const ASSETS=['./','./index.html','./styles.css?v='+VERSION,'./game.js?v='+VERSION,'./pwa.js?v='+VERSION,'./manifest.webmanifest?v='+VERSION,'./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 // Network-first for freshness, cache fallback when offline.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(req);if(response.ok&&response.type==='basic')await cache.put(req,response.clone());return response;}
  catch(error){return await cache.match(req)||(req.mode==='navigate'?await cache.match('./index.html'):undefined)||Response.error();}
 })());
});
