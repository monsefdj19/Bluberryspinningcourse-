(()=>{
  const programs=Array.isArray(window.TRAINING_PROGRAMS)?window.TRAINING_PROGRAMS:[];
  const $=id=>document.getElementById(id);
  const overlay=$('liveOverlay'),chooser=$('programChooser'),programGrid=$('programGrid'),shell=$('liveShell');
  const open=$('openLive'),openQuick=$('openLiveQuick'),close=$('closeLive'),closeChooser=$('closeChooser'),changeProgram=$('changeProgram');
  const toggle=$('liveToggle'),toggleIcon=$('liveToggleIcon'),toggleLabel=$('liveToggleLabel'),prev=$('livePrev'),next=$('liveNext'),queue=$('liveQueue'),liveReset=$('liveReset');
  const audio=$('localAudio'),audioState=$('localAudioState'),audioTime=$('localAudioTime'),audioBar=$('localAudioBar'),cover=$('localCover'),coverFallback=$('localCoverFallback'),volume=$('localVolume');
  const liveKey='firstRideLiveV5';
  const safeStore=(key,value)=>{try{localStorage.setItem(key,value)}catch(e){}};
  let saved={};try{saved=JSON.parse(localStorage.getItem(liveKey)||'{}')}catch(e){}
  if(!saved||typeof saved!=='object')saved={};
  if(!programs.some(program=>program.id===saved.programId)){
    try{
      const legacy=JSON.parse(localStorage.getItem('firstRideLiveV4')||'{}'),rhythm=programs.find(program=>program.id==='01'),rawIndex=Number(legacy?.index);
      if(rhythm&&Number.isFinite(rawIndex)){
        const legacyIndex=Math.min(Math.max(Math.trunc(rawIndex),0),rhythm.tracks.length-1),rawOffset=Number(legacy.offset),trackSeconds=rhythm.tracks[legacyIndex].seconds,legacyOffset=Number.isFinite(rawOffset)?Math.min(Math.max(rawOffset,0),Math.max(0,trackSeconds-1)):0,legacyElapsed=rhythm.tracks.slice(0,legacyIndex).reduce((sum,track)=>sum+track.seconds,0)+legacyOffset;
        saved={version:5,programId:'01',elapsed:Math.min(legacyElapsed,rhythm.totalSeconds)};safeStore(liveKey,JSON.stringify(saved));
      }
    }catch(e){saved={}}
  }
  let currentProgram=null,ride=[],index=0,offset=0,elapsed=Math.max(0,Number(saved.elapsed)||0),running=false,runningBaseElapsed=elapsed,runningStartedAt=0,lastSecond=-1,audioCtx,wakeLock,returnFocus=null,coverUrl='';
  const fmt=s=>`${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
  const totalSeconds=()=>currentProgram?.totalSeconds||ride.reduce((sum,t)=>sum+t.seconds,0);
  const before=i=>ride.slice(0,i).reduce((sum,t)=>sum+t.seconds,0);
  const elapsedNow=()=>running?runningBaseElapsed+(Date.now()-runningStartedAt)/1000:elapsed;
  const save=()=>{if(!currentProgram)return;saved={version:5,programId:currentProgram.id,elapsed:Math.min(elapsedNow(),totalSeconds())};safeStore(liveKey,JSON.stringify(saved))};

  function setCover(art){
    coverUrl=art||'';
    if(coverUrl){cover.src=coverUrl;cover.hidden=false;coverFallback.hidden=true}
    else{cover.removeAttribute('src');cover.hidden=true;coverFallback.hidden=false}
    updateMediaSession();
  }
  function showAudioState(state){
    const labels={missing:'Test track unavailable',ready:'Ready · starts with the exercise timer',playing:'Test music playing with the exercise',paused:'Music and timer paused',ended:'Loop restarting',error:'Test audio could not be played'};
    audioState.textContent=labels[state.status]||'Built-in test music ready';
    audioTime.textContent=state.status==='playing'?'Looping until the next exercise':state.duration?'Test loop ready':'Preparing test loop';
    audioBar.style.width=`${state.duration?Math.min(100,state.currentTime/state.duration*100):0}%`;
    $('localPlayerCard').dataset.status=state.status;
  }
  const audioPlayer=LocalAudio.createController({audio,onState:showAudioState,onCover:setCover});
  audioPlayer.setSources(programs.flatMap(program=>program.tracks.map((track,index)=>({programId:program.id,index,audioSrc:track.audioSrc,artworkSrc:track.artworkSrc}))));

  function tone(freq=740,duration=.12,delay=0){try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain(),at=audioCtx.currentTime+delay;o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.16,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(audioCtx.destination);o.start(at);o.stop(at+duration+.02)}catch(e){}}
  function transitionSignal(){tone(720,.12);tone(980,.18,.16);if(navigator.vibrate)navigator.vibrate([100,70,180]);overlay.classList.remove('countdown-flash');void overlay.offsetWidth;overlay.classList.add('countdown-flash')}
  function locate(value){let rest=Math.max(0,Math.min(value,totalSeconds()));let nextIndex=0;while(nextIndex<ride.length-1&&rest>=ride[nextIndex].seconds){rest-=ride[nextIndex].seconds;nextIndex++}return{index:nextIndex,offset:Math.min(rest,ride[nextIndex]?.seconds||0)}}
  function reconcileClock(signal=false){if(!currentProgram)return false;const prior=index;elapsed=Math.min(elapsedNow(),totalSeconds());const located=locate(elapsed);index=located.index;offset=located.offset;if(elapsed>=totalSeconds()){running=false;audioPlayer.pause();releaseWakeLock()}const transitioned=index!==prior;if(transitioned&&signal)transitionSignal();return transitioned}

  function renderProgramCards(){
    programGrid.innerHTML=programs.map(program=>{
      const selected=saved.programId===program.id;
      return `<button class="program-card${selected?' selected':''}" type="button" data-program="${program.id}"><span class="program-number">${program.id}</span><span class="program-card-copy"><b>${program.name}</b><small>${program.objective}</small><em>${program.totalTime} · ${program.tracks.length} tracks${selected?' · Continue available':''}</em></span><span class="program-arrow" aria-hidden="true">→</span></button>`;
    }).join('');
    programGrid.querySelectorAll('.program-card').forEach(card=>card.addEventListener('click',()=>selectProgram(card.dataset.program)));
  }

  function selectProgram(id){
    const program=programs.find(item=>item.id===id);if(!program)return;
    const continuing=saved.programId===id;
    currentProgram=program;ride=program.tracks;
    elapsed=continuing?Math.min(Math.max(0,Number(saved.elapsed)||0),totalSeconds()):0;
    running=false;runningBaseElapsed=elapsed;runningStartedAt=0;lastSecond=-1;
    const located=locate(elapsed);index=located.index;offset=located.offset;
    saved={programId:id,elapsed};save();
    $('liveProgramTitle').textContent=program.name;
    overlay.setAttribute('aria-label',`${program.name} live instructor console`);
    chooser.hidden=true;shell.hidden=false;overlay.scrollTop=0;
    buildQueue();render();syncAudio(false);requestAnimationFrame(()=>toggle.focus());
  }

  function buildQueue(){queue.innerHTML=ride.map((track,i)=>`<button class="queue-item" type="button" data-i="${i}"><span class="queue-no">${String(i+1).padStart(2,'0')}</span><b>${track.exercise}</b><small>${fmt(track.seconds)}</small></button>`).join('');queue.querySelectorAll('.queue-item').forEach(item=>item.addEventListener('click',()=>jump(Number(item.dataset.i))))}
  function updateMediaSession(){
    if(!('mediaSession'in navigator)||!currentProgram||!ride[index])return;
    const track=ride[index],artwork=coverUrl?[{src:coverUrl}]:[];
    try{navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:currentProgram.name,artwork});navigator.mediaSession.playbackState=running?'playing':'paused'}catch(e){}
  }
  function render(){
    if(!currentProgram||!ride.length)return;
    reconcileClock(false);
    const track=ride[index],upNext=ride[index+1],remaining=Math.max(0,track.seconds-offset),sessionElapsed=Math.min(elapsed,totalSeconds());
    $('liveProgramTitle').textContent=currentProgram.name;
    $('livePhase').textContent=remaining<=10&&running?`Next in ${Math.ceil(remaining)} sec`:track.phase;
    $('liveCount').textContent=`Track ${index+1} of ${ride.length}`;$('liveExercise').textContent=track.exercise;$('liveCue').textContent=track.cue;$('livePosition').textContent=track.position;$('liveResistance').textContent=track.resistance;$('livePattern').textContent=track.pattern;$('liveRpm').textContent=track.rpm;$('liveRpe').textContent=track.rpe;$('liveTrack').textContent=track.title;$('liveArtist').textContent=track.artist;$('localAudioTitle').textContent=track.title;$('localAudioArtist').textContent=track.artist;
    $('elapsedTime').textContent=fmt(sessionElapsed);$('remainingTime').textContent=fmt(Math.ceil(remaining));$('liveBar').style.width=`${Math.min(100,(offset/track.seconds)*100)}%`;
    $('nextExercise').textContent=upNext?upNext.exercise:'Ride complete';$('nextMeta').textContent=upNext?`${upNext.title} · ${upNext.rpm} RPM · RPE ${upNext.rpe}`:'Cooldown complete · hydrate and thank the room';
    toggleIcon.textContent=running?'Ⅱ':'▶';toggleLabel.textContent=running?'Pause music + timer':'Start music + timer';toggle.setAttribute('aria-label',running?'Pause music and timer':'Start music and timer');prev.disabled=index===0&&offset<1;next.textContent=index===ride.length-1?'Finish ✓':'Next →';
    queue.querySelectorAll('.queue-item').forEach((item,i)=>{item.classList.toggle('done',i<index);item.classList.toggle('current',i===index)});
    const current=queue.querySelector('.queue-item.current');if(current&&!current.dataset.seen){queue.querySelectorAll('.queue-item').forEach(item=>delete item.dataset.seen);current.dataset.seen='1';current.scrollIntoView({block:'nearest'})}
    document.title=running?`${fmt(Math.ceil(remaining))} · ${currentProgram.name} · ${track.exercise}`:`${currentProgram.name} — paused`;
    updateMediaSession();
  }
  async function syncAudio(shouldPlay=running){if(!currentProgram)return false;return audioPlayer.sync(currentProgram.id,index,offset,shouldPlay)}
  async function requestWakeLock(){if(!('wakeLock'in navigator)||!running)return;try{wakeLock=await navigator.wakeLock.request('screen')}catch(e){}}
  async function releaseWakeLock(){try{if(wakeLock)await wakeLock.release()}catch(e){}wakeLock=null}
  async function setRunning(value){
    if(!currentProgram)return false;
    reconcileClock(false);
    if(value){
      const hasAudio=Boolean(audioPlayer.sourceFor(currentProgram.id,index));
      if(elapsed>=totalSeconds()){elapsed=0;index=0;offset=0}
      if(hasAudio)syncAudio(true);else audioState.textContent='Timer running · this generated test track is unavailable';
      running=true;runningBaseElapsed=elapsed;runningStartedAt=Date.now();requestWakeLock();
    }else{running=false;runningBaseElapsed=elapsed;runningStartedAt=0;audioPlayer.pause();releaseWakeLock()}
    save();render();return true;
  }
  function setElapsed(value){elapsed=Math.max(0,Math.min(value,totalSeconds()));runningBaseElapsed=elapsed;if(running)runningStartedAt=Date.now();const located=locate(elapsed);index=located.index;offset=located.offset;lastSecond=-1;save();render();syncAudio(running)}
  function jump(i){setElapsed(before(Math.min(Math.max(i,0),ride.length-1)))}
  function advance(auto=false){if(index<ride.length-1){setElapsed(before(index+1));if(auto)transitionSignal()}else{setElapsed(totalSeconds());setRunning(false);transitionSignal()}}
  function tick(){
    if(running){const prior=index;reconcileClock(false);const remaining=ride[index].seconds-offset,second=Math.ceil(remaining);if(second!==lastSecond){lastSecond=second;if(second===10)tone(520,.1);if(second>0&&second<=3)tone(620+(3-second)*90,.08);save()}if(index!==prior){transitionSignal();syncAudio(true)}render()}
    requestAnimationFrame(tick);
  }
  function showChooser(){if(!overlay.hidden)setRunning(false);chooser.hidden=false;shell.hidden=true;overlay.scrollTop=0;overlay.setAttribute('aria-label','Choose a training program');renderProgramCards();requestAnimationFrame(()=>programGrid.querySelector('.program-card.selected,.program-card')?.focus())}
  function openLiveMode(event){returnFocus=event?.currentTarget||document.activeElement;overlay.hidden=false;document.body.classList.add('live-open');showChooser()}
  function closeLiveMode(){if(currentProgram)setRunning(false);overlay.hidden=true;document.body.classList.remove('live-open');document.title='Blueberry Ride — Five indoor-cycling programs';if(returnFocus&&typeof returnFocus.focus==='function')returnFocus.focus()}

  volume.addEventListener('input',()=>{audio.volume=Number(volume.value)});audio.volume=Number(volume.value);
  open.addEventListener('click',openLiveMode);openQuick.addEventListener('click',openLiveMode);close.addEventListener('click',closeLiveMode);closeChooser.addEventListener('click',closeLiveMode);changeProgram.addEventListener('click',showChooser);
  document.querySelectorAll('[data-home-program]').forEach(card=>card.addEventListener('click',()=>{returnFocus=card;overlay.hidden=false;document.body.classList.add('live-open');selectProgram(card.dataset.homeProgram)}));
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){closeLiveMode();return}if(event.key!=='Tab')return;const focusable=[...overlay.querySelectorAll('button:not([disabled]),a[href],input:not([type="file"]),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}});
  toggle.addEventListener('click',()=>setRunning(!running));prev.addEventListener('click',()=>offset>8?setElapsed(before(index)):jump(index-1));next.addEventListener('click',()=>advance(false));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&running){reconcileClock(true);render();syncAudio(true);requestWakeLock()}});
  addEventListener('pageshow',()=>{if(running){reconcileClock(true);render();syncAudio(true)}});
  addEventListener('focus',()=>{if(running){reconcileClock(true);render();syncAudio(true)}});
  function resetLiveSession(){if(!currentProgram)return;setRunning(false);elapsed=0;runningBaseElapsed=0;runningStartedAt=0;index=0;offset=0;lastSecond=-1;save();render();syncAudio(false);queue.scrollTo({top:0,behavior:'smooth'})}
  liveReset.addEventListener('click',resetLiveSession);$('resetProgress').addEventListener('click',resetLiveSession);
  if('mediaSession'in navigator){try{navigator.mediaSession.setActionHandler('play',()=>setRunning(true));navigator.mediaSession.setActionHandler('pause',()=>setRunning(false));navigator.mediaSession.setActionHandler('previoustrack',()=>jump(index-1));navigator.mediaSession.setActionHandler('nexttrack',()=>advance(false))}catch(e){}}
  renderProgramCards();requestAnimationFrame(tick);
})();
