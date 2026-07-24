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
  {programId:'02',index:12,audioSrc:'./test-audio/02-13.mp3',artworkSrc:'./test-art/02.svg'},
];

class FakeAudio{
  constructor(){this.src='';this.currentTime=0;this.duration=20;this.readyState=0;this.paused=true;this.loop=false;this.listeners={};this.playCount=0;this.loadCount=0}
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
assert.equal(audio.loop,true);
assert.equal(covers.at(-1),'./test-art/01.svg');
controller.pause();
assert.equal(audio.paused,true);
audio.currentTime=2;
await controller.sync('01',0,44,true);
assert.equal(audio.currentTime,4,'looping test audio should seek to exercise offset modulo file duration');
assert.equal(audio.paused,false);
assert.equal(await controller.load('02',12,4,false),true);
assert.equal(audio.src,'./test-audio/02-13.mp3');
const beforeRetry=audio.loadCount;
audio.emit('error');
await controller.sync('02',12,4,false);
assert.equal(audio.loadCount,beforeRetry+1,'retrying an errored track must reload its source');
assert.equal(await controller.load('05',0,0,true),false);
assert.equal(states.at(-1).status,'missing');

console.log('hosted-audio contract: PASS');
