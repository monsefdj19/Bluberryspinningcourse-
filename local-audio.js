(()=>{
  function createController(options={}){
    const audio=options.audio,onState=options.onState||(()=>{}),onCover=options.onCover||(()=>{}),onEnded=options.onEnded||(()=>{});
    const now=options.now||(()=>globalThis.performance?.now?.()||Date.now()),raf=options.requestAnimationFrame||globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,16)),fadeOutSeconds=Math.max(.1,Number(options.fadeOutSeconds)||3),fadeInMs=Math.max(100,Number(options.fadeInMs)||2000);
    let sources=new Map(),currentKey='',requestId=0,baseVolume=Math.max(0,Math.min(1,Number(audio.volume)||.9)),boundaryRatio=1,fadeToken=0,fadingIn=false;
    const state=status=>onState({status,currentKey,currentTime:Number(audio.currentTime)||0,duration:Number(audio.duration)||0,paused:audio.paused});
    const sourceFor=(programId,index)=>sources.get(`${programId}:${index}`)||null;
    const setSources=tracks=>{
      sources=new Map();
      for(const track of Array.from(tracks||[]))if(track?.programId&&Number.isInteger(track.index)&&track.audioSrc)sources.set(`${track.programId}:${track.index}`,track);
      return sources;
    };
    const metadata=()=>new Promise((resolve,reject)=>{
      if(Number.isFinite(Number(audio.duration))&&Number(audio.duration)>0&&audio.readyState>=1){resolve();return}
      const ready=()=>{cleanup();resolve()},failed=()=>{cleanup();reject(new Error('Audio metadata unavailable'))},cleanup=()=>{audio.removeEventListener?.('loadedmetadata',ready);audio.removeEventListener?.('error',failed)};
      audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',failed);
    });
    const seek=offset=>{
      const duration=Number(audio.duration),raw=Math.max(0,Number(offset)||0);
      audio.currentTime=Number.isFinite(duration)&&duration>0?Math.min(raw,duration):raw;
    };
    const cancelFade=()=>{fadeToken++;fadingIn=false};
    const restoreVolume=()=>{boundaryRatio=1;audio.volume=baseVolume};
    const setVolume=value=>{baseVolume=Math.max(0,Math.min(1,Number(value)||0));if(!fadingIn)audio.volume=baseVolume*boundaryRatio;return baseVolume};
    const prepareBoundary=remaining=>{
      if(fadingIn||audio.paused)return audio.volume;
      const seconds=Math.max(0,Number(remaining)||0);
      boundaryRatio=seconds>=fadeOutSeconds?1:seconds/fadeOutSeconds;
      audio.volume=baseVolume*boundaryRatio;
      return audio.volume;
    };
    const startFadeIn=()=>{
      const token=++fadeToken,started=now();fadingIn=true;boundaryRatio=1;audio.volume=0;
      const step=()=>{if(token!==fadeToken)return;const progress=Math.min(1,Math.max(0,(now()-started)/fadeInMs));audio.volume=baseVolume*progress;if(progress<1)raf(step);else fadingIn=false};
      raf(step);
    };
    async function load(programId,index,offset=0,shouldPlay=false,request=++requestId){
      const key=`${programId}:${index}`,source=sourceFor(programId,index);
      if(!source){cancelFade();audio.pause();restoreVolume();state('missing');return false}
      try{
        const switching=Boolean(currentKey)&&key!==currentKey&&shouldPlay;
        if(key!==currentKey){cancelFade();if(switching)audio.volume=0;audio.pause();currentKey=key;boundaryRatio=1;audio.volume=switching?0:baseVolume;audio.loop=false;audio.src=source.audioSrc;onCover(source.artworkSrc||null,source);audio.load();await metadata()}
        if(request!==requestId)return false;
        seek(offset);
        if(shouldPlay)await audio.play();else audio.pause();
        if(request!==requestId)return false;
        if(switching)startFadeIn();
        state(shouldPlay?'playing':'ready');
        return true;
      }catch(error){if(request===requestId){cancelFade();audio.pause();restoreVolume();currentKey='';audio.removeAttribute?.('src');state('error')}return false}
    }
    async function sync(programId,index,offset,shouldPlay){
      const request=++requestId;
      const key=`${programId}:${index}`;
      if(key!==currentKey)return load(programId,index,offset,shouldPlay,request);
      const duration=Number(audio.duration),target=Number.isFinite(duration)&&duration>0?Math.min(Math.max(0,Number(offset)||0),duration):Math.max(0,Number(offset)||0);
      if(Math.abs((Number(audio.currentTime)||0)-target)>1.5)audio.currentTime=target;
      try{if(shouldPlay&&audio.paused)await audio.play();else if(!shouldPlay&&!audio.paused)audio.pause();if(request!==requestId)return false;state(shouldPlay?'playing':'paused');return true}catch(error){if(request===requestId)state('error');return false}
    }
    const pause=()=>{requestId++;cancelFade();audio.pause();restoreVolume();state('paused')};
    audio.addEventListener('timeupdate',()=>state(audio.paused?'paused':'playing'));
    audio.addEventListener('ended',()=>{state('ended');onEnded()});
    audio.addEventListener('error',()=>{currentKey='';state('error')});
    return{setSources,sourceFor,load,sync,pause,setVolume,prepareBoundary,destroy(){requestId++;cancelFade();audio.pause();restoreVolume();currentKey='';audio.removeAttribute?.('src')},get currentKey(){return currentKey}};
  }
  globalThis.LocalAudio={createController};
})();
