import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../local-audio.js',import.meta.url),'utf8');
const context={console,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context);
const api=context.LocalAudio;
assert.ok(api,'LocalAudio API must be exposed');

const tracks=[
  {programId:'01',index:0,audioSrc:'./test-audio/01-01.mp3',artworkSrc:'./test-art/01.svg'},
  {programId:'01',index:1,audioSrc:'./test-audio/01-02.mp3',artworkSrc:'./test-art/01.svg'},
  {programId:'02',index:12,audioSrc:'./test-audio/02-13.mp3',artworkSrc:'./test-art/02.svg'},
  {programId:'02',index:13,audioSrc:'./test-audio/02-14.mp3',artworkSrc:'./test-art/02.svg'},
  {programId:'03',index:0,audioSrc:'./test-audio/03-01.mp3',artworkSrc:'./test-art/03.svg'},
  {programId:'03',index:1,audioSrc:'./test-audio/03-02.mp3',artworkSrc:'./test-art/03.svg'},
  {programId:'04',index:0,audioSrc:'./test-audio/04-01.mp3',artworkSrc:'./test-art/04.svg'},
  {programId:'04',index:1,audioSrc:'./test-audio/04-02.mp3',artworkSrc:'./test-art/04.svg'},
  {programId:'05',index:0,audioSrc:'./test-audio/05-01.mp3',artworkSrc:'./test-art/05.svg'},
  {programId:'05',index:1,audioSrc:'./test-audio/05-02.mp3',artworkSrc:'./test-art/05.svg'},
];

class FakeAudio{
  constructor(){this.src='';this.currentTime=0;this.duration=20;this.readyState=0;this.paused=true;this.loop=false;this.volume=.9;this.listeners={};this.playCount=0;this.loadCount=0}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)}
  removeEventListener(type,handler){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==handler)}
  load(){this.loadCount++;queueMicrotask(()=>{this.readyState=1;this.emit('loadedmetadata')})}
  async play(){this.paused=false;this.playCount++}
  pause(){this.paused=true}
  removeAttribute(name){if(name==='src')this.src=''}
  emit(type){for(const handler of [...(this.listeners[type]||[])])handler()}
}

const audio=new FakeAudio(),states=[],covers=[];
const controller=api.createController({audio,onState:state=>states.push(state),onCover:src=>covers.push(src)});
controller.setSources(tracks);
assert.equal(controller.sourceFor('01',0).audioSrc,'./test-audio/01-01.mp3');
assert.equal(await controller.load('01',0,12,true),true);
assert.equal(audio.src,'./test-audio/01-01.mp3');
assert.equal(audio.currentTime,12);
assert.equal(audio.paused,false);
assert.equal(audio.loop,false,'complete songs must never restart at their ending');
assert.equal(covers.at(-1),'./test-art/01.svg');
controller.pause();
assert.equal(audio.paused,true);
audio.currentTime=2;
await controller.sync('01',0,44,true);
assert.equal(audio.currentTime,20,'a late synchronization must clamp at the recording end instead of wrapping to its beginning');
assert.equal(audio.paused,false);
assert.equal(await controller.load('02',12,4,false),true);
assert.equal(audio.src,'./test-audio/02-13.mp3');
const beforeRetry=audio.loadCount;
audio.emit('error');
await controller.sync('02',12,4,false);
assert.equal(audio.loadCount,beforeRetry+1,'retrying an errored track must reload its source');
assert.equal(await controller.load('99',0,0,true),false);
assert.equal(states.at(-1).status,'missing');

const delayedAudio=new FakeAudio(),delayedStates=[];
delayedAudio.duration=NaN;
delayedAudio.load=function(){this.loadCount++};
const delayedController=api.createController({audio:delayedAudio,onState:state=>delayedStates.push(state)});
delayedController.setSources(tracks);
const preparing=delayedController.sync('01',0,0,false);
await Promise.resolve();
await delayedController.sync('01',0,0,true);
assert.equal(delayedAudio.paused,false,'a newer Start request must begin playback while initial metadata is pending');
delayedAudio.duration=20;delayedAudio.readyState=1;delayedAudio.emit('loadedmetadata');
await preparing;
assert.equal(delayedAudio.paused,false,'stale preparation must not pause audio after Start');
assert.equal(delayedStates.at(-1).status,'playing','stale preparation must not overwrite playing state');

let now=0;const frames=[];
const transitionAudio=new FakeAudio();transitionAudio.volume=.8;
const transitionController=api.createController({
  audio:transitionAudio,
  now:()=>now,
  requestAnimationFrame:callback=>{frames.push(callback);return frames.length},
  fadeOutSeconds:2,
  fadeInMs:1000,
});
transitionController.setSources(tracks);
await transitionController.load('01',0,0,true);
transitionController.setVolume(.8);
transitionController.prepareBoundary(1);
assert.equal(transitionAudio.volume,.4,'the outgoing song must fade during the final boundary seconds');
const switching=transitionController.load('02',12,0,true);
await Promise.resolve();
await switching;
assert.equal(transitionAudio.volume,0,'the incoming song must start silently before fading in');
now=500;frames.shift()();
assert.equal(transitionAudio.volume,.4,'the incoming song must fade in progressively');
now=1000;frames.shift()();
assert.equal(transitionAudio.volume,.8,'the incoming song must return to the instructor volume');

for(const programId of ['01','02','03','04','05']){
  now=0;frames.length=0;
  const playlistAudio=new FakeAudio();playlistAudio.volume=.9;
  const playlistController=api.createController({audio:playlistAudio,now:()=>now,requestAnimationFrame:callback=>{frames.push(callback);return frames.length},fadeOutSeconds:2,fadeInMs:1000});
  playlistController.setSources(tracks);
  const firstIndex=programId==='02'?12:0,nextIndex=firstIndex+1;
  await playlistController.load(programId,firstIndex,0,true);
  playlistController.setVolume(.6);
  assert.equal(playlistAudio.volume,.6,`Program ${programId} volume slider target must apply immediately`);
  playlistController.prepareBoundary(1);
  assert.equal(playlistAudio.volume,.3,`Program ${programId} must fade out before its boundary`);
  await playlistController.load(programId,nextIndex,0,true);
  assert.equal(playlistAudio.volume,0,`Program ${programId} transition must load the incoming track silently`);
  playlistController.setVolume(.4);
  now=500;frames.shift()();
  assert.equal(playlistAudio.volume,.2,`Program ${programId} slider change must retarget an active fade`);
  now=1000;frames.shift()();
  assert.equal(playlistAudio.volume,.4,`Program ${programId} fade must finish at the selected slider volume`);
}

console.log('hosted-audio contract: PASS');
