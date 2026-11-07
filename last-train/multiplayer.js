/* Browser client for the optional LAN cooperative game server. No npm/WebSockets needed. */
(function(){
  'use strict';
  const api={
    available:false,connected:false,room:'',player:'',name:'',
    version:-1,savedSolo:null,timer:null,polling:false,sending:false,lastError:'',
    seq:0,drawnVersion:-1,networkOk:true,
    init,send,shoot,leave,refresh,action
  };
  window.Multiplayer=api;
  const $=id=>document.getElementById(id);
  const storage={
    get(k){try{return sessionStorage.getItem(k)||''}catch{return ''}},
    set(k,v){try{sessionStorage.setItem(k,v)}catch{}},
    del(k){try{sessionStorage.removeItem(k)}catch{}}
  };
  function notify(message,error=false){
    const el=$('netHint');
    if(el){el.textContent=message;el.classList.toggle('bad',error);el.classList.toggle('good',!error)}
  }
  async function json(url,data){
    const config=data===undefined?
      {cache:'no-store'}:
      {method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),5000);
    try{
      const res=await fetch(url,{...config,signal:abort.signal});
      const answer=await res.json();
      if(!res.ok||answer.error)throw Error(answer.error||('HTTP '+res.status));
      return answer;
    }finally{clearTimeout(timer)}
  }
  async function init(){
    const panel=$('multiplayerPanel');
    if(!panel)return;
    panel.hidden=false;
    const nameField=$('netName'),codeField=$('netRoom');
    nameField.value=storage.get('lastTrainName')||'Выживший';
    codeField.value=storage.get('lastTrainRoom');
    $('netCreate').addEventListener('click',()=>join('create'));
    $('netJoin').addEventListener('click',()=>join('join'));
    $('netLeave').addEventListener('click',()=>leave());
    $('netChatForm').addEventListener('submit',event=>{
      event.preventDefault();
      const input=$('netChatText'),text=input.value.trim();
      if(!text)return;
      input.value='';
      send('chat',{text});
    });
    // The original single-player game must remain available via file://.
    if(!/^https?:$/.test(location.protocol)){
      notify('Сетевая игра: запусти python server.py и открой адрес http://IP:8000. Сейчас доступна одиночная игра.');
      $('netCreate').disabled=$('netJoin').disabled=true;
      return;
    }
    try{
      const status=await json('/api/status');
      if(!status.online)throw Error('No server');
      api.available=true;
      notify('Сервер обнаружен. Создай комнату или войди по коду с другого устройства.');
      const savedRoom=storage.get('lastTrainRoom');
      const savedPlayer=storage.get('lastTrainPlayer');
      if(savedRoom&&savedPlayer){
        try{await join('join',savedRoom,savedPlayer,true)}catch{notify('Предыдущая комната недоступна. Создай новую или введи код.')}
      }
    }catch{
      notify('Сетевой сервер не запущен. Одиночная игра работает; для кооператива запусти python server.py.');
      $('netCreate').disabled=$('netJoin').disabled=true;
    }
  }
  async function join(mode,restoreCode='',restorePlayer='',silent=false){
    if(!api.available)return;
    const name=($('netName').value.trim()||'Выживший').slice(0,24);
    const room=(restoreCode||$('netRoom').value.trim()).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(mode==='join'&&!room){notify('Введите шестизначный код комнаты.',true);return}
    $('netCreate').disabled=$('netJoin').disabled=true;
    try{
      const data=await json('/api/join',{mode,name,room,player:restorePlayer||undefined});
      api.connected=true;api.room=data.room;api.player=data.player;api.name=name;
      api.version=-1;api.drawnVersion=-1;api.savedSolo=structuredCloneSafe(s);
      api.networkOk=true;
      storage.set('lastTrainRoom',data.room);
      storage.set('lastTrainPlayer',data.player);
      storage.set('lastTrainName',name);
      $('netSetup').hidden=true;$('netSession').hidden=false;
      $('netRoomLabel').textContent='Комната: '+data.room+' • '+location.origin;
      $('netChatText').disabled=false;
      apply(data,true);
      if(api.timer)clearInterval(api.timer);
      api.timer=setInterval(refresh,350);
      notify('Подключено. Все игроки делят один поезд и один бой.');
    }catch(err){
      if(!silent)notify('Не удалось подключиться: '+err.message,true);
      throw err;
    }finally{
      $('netCreate').disabled=$('netJoin').disabled=false;
    }
  }
  function structuredCloneSafe(object){
    try{return JSON.parse(JSON.stringify(object))}catch{return null}
  }
  function apply(data,force=false){
    if(!api.connected||!data||!data.state)return;
    if(!force&&typeof data.version==='number'&&data.version<api.version)return;
    const newVersion=Number(data.version)||0;
    const beforePhase=s.phase,wasTrip=!!TrainArt.journey?.active;
    const srv=data.state,trip=data.trip;
    s={...initial(),...srv};
    if(trip){
      const elapsed=Math.max(0,Number(trip.elapsed)||0);
      const duration=Math.max(0.2,Number(trip.duration)||5.2);
      const startWorld=Number(trip.startWorld)||0;
      const same=wasTrip&&TrainArt.journey.from===trip.fromStation&&TrainArt.journey.to===trip.toStation&&
        Math.abs(TrainArt.worldDistance-startWorld)<1;
      if(!same){
        TrainArt.journey=null;
        TrainArt.worldDistance=startWorld;
        TrainArt.movingDistance=0;
        startTrainJourney(duration*1000,()=>{}, {from:trip.fromStation,to:trip.toStation});
      }
      if(TrainArt.journey){
        const expectedStart=performance.now()-elapsed*1000;
        if(!same||Math.abs(expectedStart-TrainArt.journey.started)>350)
          TrainArt.journey.started=expectedStart;
        updateTrainJourney(performance.now());
      }
    }else{
      if(TrainArt.journey?.active)TrainArt.journey=null;
      TrainArt.movingDistance=0;
      TrainArt.travelSpeed=0;
      TrainArt.worldDistance=Number(s.worldPosition)||0;
      TrainArt.wheelRotation=TrainArt.worldDistance/15;
    }
    if(s.phase==='raid'&&beforePhase!=='raid'){
      const camera=trainCameraBounds(s).max;
      TrainArt.target=camera;TrainArt.camera=camera;
      AttackFX.lastUpdate=0;
    }
    if(force||newVersion!==api.drawnVersion||wasTrip!==!!trip){
      render();
      api.drawnVersion=newVersion;
    }
    api.version=newVersion;
    $('netPlayers').innerHTML='';
    for(const p of data.players||[]){
      const node=document.createElement('span');
      node.className='net-player';
      node.textContent=(p.online?'🟢 ':'⚪ ')+p.name;
      $('netPlayers').appendChild(node);
    }
    const log=$('netMessages');
    const bottom=Math.abs(log.scrollHeight-log.scrollTop-log.clientHeight)<35;
    log.replaceChildren();
    for(const m of (data.messages||[])){
      const line=document.createElement('p');
      const who=document.createElement('strong');
      who.textContent=m.name+': ';
      line.appendChild(who);
      line.appendChild(document.createTextNode(m.text));
      log.appendChild(line);
    }
    if(bottom)log.scrollTop=log.scrollHeight;
  }
  async function refresh(){
    if(!api.connected||api.polling)return;
    api.polling=true;
    try{
      const data=await json('/api/state?room='+encodeURIComponent(api.room)+'&player='+encodeURIComponent(api.player));
      api.networkOk=true;
      apply(data);
    }catch(err){
      api.networkOk=false;
      notify('Связь с сервером потеряна. Переподключаемся: '+err.message,true);
    }finally{api.polling=false}
  }
  async function send(kind,extra={}){
    if(!api.connected||api.sending)return false;
    api.sending=true;
    try{
      const data=await json('/api/action',{room:api.room,player:api.player,action:kind,
        requestId:api.player.slice(0,6)+'-'+Date.now().toString(36)+'-'+(++api.seq),...extra});
      api.networkOk=true;
      apply(data,true);
      if(kind==='shoot'){
        AttackFX.feedback=data.message||'Выстрел';
        AttackFX.feedbackAt=performance.now();
      }
      return true;
    }catch(err){
      notify('Действие отклонено: '+err.message,true);
      return false;
    }finally{api.sending=false}
  }
  function action(kind,extra){if(api.connected){send(kind,extra);return true}return false}
  function shoot(x,y){
    if(!api.connected)return false;
    if(api.sending)return true;
    const now=performance.now();
    if(now-AttackFX.lastShot<170)return true;
    AttackFX.lastShot=now;
    AttackFX.shot={time:now,x,y,hit:false};
    send('shoot',{x:Math.max(0,Math.min(960,x)),y:Math.max(0,Math.min(480,y))});
    return true;
  }
  function leave(){
    if(api.timer){clearInterval(api.timer);api.timer=null}
    api.connected=false;api.player='';api.room='';api.version=-1;
    storage.del('lastTrainRoom');storage.del('lastTrainPlayer');
    $('netSetup').hidden=false;$('netSession').hidden=true;
    $('netRoom').value='';
    if(api.savedSolo)s=api.savedSolo;
    api.savedSolo=null;
    TrainArt.journey=null;TrainArt.worldDistance=Number(s.worldPosition)||0;
    TrainArt.movingDistance=0;TrainArt.travelSpeed=0;TrainArt.target=trainCameraBounds(s).max;
    TrainArt.camera=TrainArt.target;
    render();
    notify('Вышли из сетевой комнаты. Теперь работает одиночный режим.');
  }
})();
