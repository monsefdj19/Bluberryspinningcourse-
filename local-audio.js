(()=>{
  function createController(options={}){
    const audio=options.audio,onState=options.onState||(()=>{}),onCover=options.onCover||(()=>{}),onEnded=options.onEnded||(()=>{});
    let sources=new Map(),currentKey='',requestId=0;
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
      audio.currentTime=Number.isFinite(duration)&&duration>0?raw%duration:raw;
    };
    async function load(programId,index,offset=0,shouldPlay=false,request=++requestId){
      const key=`${programId}:${index}`,source=sourceFor(programId,index);
      if(!source){audio.pause();state('missing');return false}
      try{
        if(key!==currentKey){audio.pause();currentKey=key;audio.loop=true;audio.src=source.audioSrc;onCover(source.artworkSrc||null,source);audio.load();await metadata()}
        if(request!==requestId)return false;
        seek(offset);
        if(shouldPlay)await audio.play();else audio.pause();
        if(request!==requestId)return false;
        state(shouldPlay?'playing':'ready');
        return true;
      }catch(error){if(request===requestId){audio.pause();currentKey='';audio.removeAttribute?.('src');state('error')}return false}
    }
    async function sync(programId,index,offset,shouldPlay){
      const request=++requestId;
      const key=`${programId}:${index}`;
      if(key!==currentKey)return load(programId,index,offset,shouldPlay,request);
      const duration=Number(audio.duration),target=Number.isFinite(duration)&&duration>0?Math.max(0,Number(offset)||0)%duration:Math.max(0,Number(offset)||0);
      if(Math.abs((Number(audio.currentTime)||0)-target)>1.5)audio.currentTime=target;
      try{if(shouldPlay&&audio.paused)await audio.play();else if(!shouldPlay&&!audio.paused)audio.pause();if(request!==requestId)return false;state(shouldPlay?'playing':'paused');return true}catch(error){if(request===requestId)state('error');return false}
    }
    const pause=()=>{requestId++;audio.pause();state('paused')};
    audio.addEventListener('timeupdate',()=>state(audio.paused?'paused':'playing'));
    audio.addEventListener('ended',()=>{state('ended');onEnded()});
    audio.addEventListener('error',()=>{currentKey='';state('error')});
    return{setSources,sourceFor,load,sync,pause,destroy(){requestId++;audio.pause();currentKey='';audio.removeAttribute?.('src')},get currentKey(){return currentKey}};
  }
  globalThis.LocalAudio={createController};
})();
