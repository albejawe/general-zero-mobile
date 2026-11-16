/* v4: versioned app shell, network-first to prevent stale PWA after new Git deploys. */
const VERSION='4.0.0';
const CACHE='general-zero-mobile-'+VERSION;
const PREFIX='general-zero-mobile-';
const SHELL=['./','./index.html','./styles.css?v='+VERSION,'./game.js?v='+VERSION,'./pwa.js?v='+VERSION,'./manifest.webmanifest?v='+VERSION,'./icon.svg','./sprite_atlas.png?v='+VERSION];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const res=await fetch(req);if(res.ok&&res.type==='basic')await cache.put(req,res.clone());return res;}
  catch(err){const offline=await cache.match(req)||await cache.match(url.pathname==='/'?'./index.html':req);
   return offline||(req.mode==='navigate'?await cache.match('./index.html'):undefined)||Response.error();}
 })());
});
