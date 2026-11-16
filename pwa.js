/* PWA lifecycle v2.0.0 — reload when safe; otherwise prompt mid-battle. */
(()=>{
 'use strict';
 const VERSION='2.0.0';
 if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
 let refreshing=false,registration=null,prompted=false;
 function safe(){const g=window.__zeroFrontier?.game;return !g||g.paused||g.over;}
 function reload(){if(!refreshing){refreshing=true;location.reload();}}
 function newer(){
  if(prompted)return;prompted=true;
  if(safe()){reload();return;}
  document.getElementById('updateToast')?.classList.remove('hidden');
  document.getElementById('updateNow')?.addEventListener('click',reload,{once:true});
 }
 navigator.serviceWorker.addEventListener('controllerchange',newer);
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
  registration=reg;
  if(reg.waiting&&navigator.serviceWorker.controller)reg.waiting.postMessage({type:'SKIP_WAITING'});
  reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{
   if(w.state==='installed'&&navigator.serviceWorker.controller)w.postMessage({type:'SKIP_WAITING'});
  });});
  try{await reg.update();}catch(e){}
 }).catch(()=>{});
 const check=()=>{if(!document.hidden&&navigator.onLine)registration?.update().catch(()=>{});};
 document.addEventListener('visibilitychange',check);
 window.addEventListener('pageshow',check);
 window.addEventListener('online',check);
 window.__gamePWA={version:VERSION,check};
})();
