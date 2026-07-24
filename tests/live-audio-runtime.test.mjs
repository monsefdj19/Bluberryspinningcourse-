import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {extname,join,normalize} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';

const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
statSync(chrome);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mp3':'audio/mpeg','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.pdf':'application/pdf'};
const server=createServer((req,res)=>{
  const requested=decodeURIComponent(new URL(req.url,'http://local.test').pathname);
  const relative=requested==='/'?'index.html':requested.replace(/^\//,'');
  const file=normalize(join(root,relative));
  if(!file.startsWith(`${root}/`)){res.writeHead(403).end();return}
  try{const body=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404).end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const pagePort=server.address().port;
const freePort=()=>new Promise((resolve,reject)=>{const socket=net.createServer();socket.once('error',reject);socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port))})});
const cdpPort=await freePort();
const profile=mkdtempSync(join(tmpdir(),'spinning-runtime-test-'));
const browser=spawn(chrome,['--headless=new','--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${cdpPort}`,`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check',`http://127.0.0.1:${pagePort}/`],{stdio:'ignore'});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;
try{
  let target;
  for(let attempt=0;attempt<60;attempt++){
    try{const targets=await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();target=targets.find(item=>item.type==='page'&&item.url.includes(`127.0.0.1:${pagePort}`));if(target)break}catch{}
    await wait(100);
  }
  assert.ok(target,'Chrome application page target did not start');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result)}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;const timer=setTimeout(()=>{pending.delete(call);reject(new Error(`${method} timed out`))},10000);pending.set(call,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});ws.send(JSON.stringify({id:call,method,params}))});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value};
  const elapsedSeconds=text=>{const [minutes,seconds]=text.split(':').map(Number);return minutes*60+seconds};

  await send('Page.enable');await send('Runtime.enable');
  await evaluate(`localStorage.clear();location.reload()`);await wait(1000);
  const landingTitle=await evaluate(`openLiveQuick.click();closeChooser.click();document.title`);
  assert.equal(landingTitle,'Blueberry Ride — Five indoor-cycling programs','Closing live mode must restore the rebranded landing title');
  await evaluate(`document.querySelector('[data-home-program="01"]').click()`);await wait(300);

  await evaluate(`liveToggle.click()`);await wait(1200);
  let state=await evaluate(`({elapsed:elapsedTime.textContent,label:liveToggleLabel.textContent,paused:localAudio.paused,status:localAudioState.textContent,audioTime:localAudioTime.textContent})`);
  assert.ok(elapsedSeconds(state.elapsed)>=1,'Start must advance the authoritative timer');
  assert.equal(state.label,'Pause music + timer');assert.equal(state.paused,false);assert.match(state.status,/playing/i);
  assert.equal(state.audioTime,'Looping until the next exercise');

  await evaluate(`liveToggle.click()`);await wait(100);const pausedAt=await evaluate(`elapsedTime.textContent`);await wait(1100);
  state=await evaluate(`({elapsed:elapsedTime.textContent,paused:localAudio.paused})`);
  assert.equal(state.elapsed,pausedAt,'Pause must freeze the timer');assert.equal(state.paused,true,'Pause must pause audio');

  await evaluate(`liveNext.click()`);await wait(300);
  state=await evaluate(`({src:localAudio.currentSrc||localAudio.src,paused:localAudio.paused,count:liveCount.textContent})`);
  assert.ok(state.src.endsWith('/test-audio/01-02.mp3'));assert.equal(state.paused,true);assert.equal(state.count,'Track 2 of 14');

  await evaluate(`liveToggle.click()`);await wait(200);await evaluate(`liveNext.click()`);await wait(400);
  state=await evaluate(`({src:localAudio.currentSrc||localAudio.src,paused:localAudio.paused,count:liveCount.textContent})`);
  assert.ok(state.src.endsWith('/test-audio/01-03.mp3'));assert.equal(state.paused,false);assert.equal(state.count,'Track 3 of 14');

  await evaluate(`changeProgram.click();document.querySelector('[data-program="02"]').click()`);await wait(300);
  state=await evaluate(`({program:liveProgramTitle.textContent,src:localAudio.currentSrc||localAudio.src,paused:localAudio.paused,elapsed:elapsedTime.textContent})`);
  assert.equal(state.program,'Rolling Hills and Recoveries');assert.ok(state.src.endsWith('/test-audio/02-01.mp3'));assert.equal(state.paused,true);assert.equal(state.elapsed,'00:00');

  await evaluate(`localAudio.play=()=>Promise.reject(new DOMException('forced rejection','NotAllowedError'));liveToggle.click()`);await wait(1200);
  state=await evaluate(`({elapsed:elapsedTime.textContent,label:liveToggleLabel.textContent,status:localAudioState.textContent})`);
  assert.ok(elapsedSeconds(state.elapsed)>=1,'Rejected audio.play() must not stop the authoritative timer');assert.equal(state.label,'Pause music + timer');assert.match(state.status,/could not be played/i);

  await evaluate(`liveToggle.click();localAudio.play=()=>new Promise(()=>{});liveToggle.click()`);await wait(1200);
  state=await evaluate(`({elapsed:elapsedTime.textContent,label:liveToggleLabel.textContent})`);
  assert.ok(elapsedSeconds(state.elapsed)>=1,'Pending audio.play() must not stop the authoritative timer');assert.equal(state.label,'Pause music + timer');

  await evaluate(`liveToggle.click();const first=TRAINING_PROGRAMS[0].tracks[0].seconds;localStorage.setItem('firstRideLiveV5',JSON.stringify({version:5,programId:'01',elapsed:first-0.5}));location.reload()`);await wait(900);
  await evaluate(`openLiveQuick.click();document.querySelector('[data-program="01"]').click();liveToggle.click()`);await wait(1600);
  state=await evaluate(`({count:liveCount.textContent,src:localAudio.currentSrc||localAudio.src,label:liveToggleLabel.textContent})`);
  assert.equal(state.count,'Track 2 of 14','Automatic boundary must advance to track 2');assert.ok(state.src.endsWith('/test-audio/01-02.mp3'));assert.equal(state.label,'Pause music + timer');

  console.log('live audio runtime contract: PASS');
}finally{
  try{ws?.close()}catch{}
  browser.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>browser.exitCode===null?browser.once('exit',resolve):resolve()),wait(2000)]);
  await new Promise(resolve=>server.close(resolve));
  rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
