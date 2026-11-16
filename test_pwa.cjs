const vm=require('node:vm'),fs=require('node:fs');const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/pwa.js','utf8');
function runCase({controlled=true,game=null,save=true}){
 const docEvents={};const winEvents={};const swEvents={};const btnEvents={};
 let reg={waiting:null,installing:null,events:{},addEventListener(type,fn){this.events[type]=fn;},async update(){return true;}};
 const toast={classList:{state:'hidden',remove(x){this.state='shown';},add(x){this.state='hidden';}}};
 const buttons={updateNow:{addEventListener(type,fn){btnEvents.now=fn;}},updateLater:{addEventListener(type,fn){btnEvents.later=fn;}}};
 let reloads=0,saved=0,resume=null,alerts=[];
 const context={
  navigator:{onLine:true,serviceWorker:{controller:controlled?{}:null,addEventListener(t,fn){swEvents[t]=fn;},register:async()=>reg}},
  document:{hidden:false,getElementById(x){return x==='updateToast'?toast:buttons[x]||null;},addEventListener(t,fn){docEvents[t]=fn;}},
  window:{__zeroFrontier:{game,save:()=>{saved++;return save;}},addEventListener(t,fn){winEvents[t]=fn;}},
  sessionStorage:{setItem(k,v){resume=[k,v];}},
  location:{protocol:'https:',reload(){reloads++;}},alert(message){alerts.push(message)}
 };
 vm.runInNewContext(source,context,{filename:'pwa.js'});
 return {swEvents,btnEvents,reg,toast,reloads:()=>reloads,saved:()=>saved,resume:()=>resume,alerts};
}
(async()=>{
 let t=runCase({controlled:false,game:null});await new Promise(r=>setImmediate(r));t.swEvents.controllerchange();assert.equal(t.reloads(),0,'First install should not reload');
 t=runCase({controlled:true,game:null});await new Promise(r=>setImmediate(r));t.swEvents.controllerchange();assert.equal(t.reloads(),1,'New update at menu should reload');
 t=runCase({controlled:true,game:{over:false,paused:false}});await new Promise(r=>setImmediate(r));t.swEvents.controllerchange();assert.equal(t.reloads(),0);assert.equal(t.toast.classList.state,'shown');t.btnEvents.now();assert.equal(t.saved(),1);assert.equal(t.reloads(),1);assert.deepEqual(t.resume(),['gzmResumeAfterUpdate','1']);
 t=runCase({controlled:true,game:{over:false,paused:true}});await new Promise(r=>setImmediate(r));t.swEvents.controllerchange();assert.equal(t.saved(),1);assert.equal(t.reloads(),1);
 t=runCase({controlled:true,game:{over:false,paused:false},save:false});await new Promise(r=>setImmediate(r));t.swEvents.controllerchange();t.btnEvents.now();assert.equal(t.reloads(),0,'Do not discard match if save fails');assert.equal(t.alerts.length,1);
 console.log('PASS PWA first install, background update, midbattle save+reload, paused auto-update, save failure guard');
})();
