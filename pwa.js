/* V4 update-on-return: no reinstall; never discard an active unsaved battle. */
(()=>{
'use strict';
const VERSION='4.0.0';
if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
let reg=null,updated=false;
const hadController=!!navigator.serviceWorker.controller;
const game=()=>window.__zeroFrontier?.game;
function saveAndReload(){
 const current=game();
 if(current&&!current.over){
  const ok=window.__zeroFrontier?.save?.();
  if(!ok){alert('تعذر حفظ المباراة. أكمل المعركة ثم حدّث اللعبة حتى لا تفقد تقدمك.');return;}
  try{sessionStorage.setItem('gzmResumeAfterUpdate','1');}catch(err){}
 }
 location.reload();
}
function onUpdate(){
 if(!hadController||updated)return;
 updated=true;
 const current=game();
 if(!current||current.over||current.paused){saveAndReload();return;}
 document.getElementById('updateToast')?.classList.remove('hidden');
}
navigator.serviceWorker.addEventListener('controllerchange',onUpdate);
document.getElementById('updateNow')?.addEventListener('click',saveAndReload);
document.getElementById('updateLater')?.addEventListener('click',()=>document.getElementById('updateToast')?.classList.add('hidden'));
navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async registration=>{
 reg=registration;
 if(reg.waiting&&navigator.serviceWorker.controller)reg.waiting.postMessage({type:'SKIP_WAITING'});
 reg.addEventListener('updatefound',()=>{
  const worker=reg.installing;worker?.addEventListener('statechange',()=>{
   if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});
  });
 });
 try{await reg.update();}catch(err){}
}).catch(()=>{});
const check=()=>{if(!document.hidden&&navigator.onLine)reg?.update().catch(()=>{});};
document.addEventListener('visibilitychange',check);
window.addEventListener('pageshow',check);
window.addEventListener('online',check);
window.__gamePWA={version:VERSION,check,saveAndReload};
})();
