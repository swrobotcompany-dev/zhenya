// Сетевой режим: подключение к python-серверу, другие лисята, общая синхронизация
/* ============================ СЕТЕВАЯ ИГРА ============================== */
const NET={on:false,ws:null,id:0,name:'',team:0,host:'',
  remotes:{},fruitsInit:false,lastEvtTs:0,connected:false,worldKey:null,
  overShown:false,downTimer:0};
const TEAM_COLORS=[0xd8793c,0x5aa8e0,0xb46ad8,0x62c47a];

/* ---------- лобби ---------- */
(function initLobby(){
  const wrap=$('lbTeams');if(!wrap)return;
  for(let i=0;i<4;i++){const d=document.createElement('span');
    d.className='team-dot'+(i===0?' sel':'');d.dataset.t=i;
    d.style.background='#'+new THREE.Color(TEAM_COLORS[i]).getHexString();
    d.title='Цвет лисёнка '+(i+1);wrap.appendChild(d);}
  wrap.addEventListener('click',function(e){
    const t=e.target.closest('.team-dot');if(!t)return;
    NET.team=+t.dataset.t;
    [...wrap.children].forEach(function(c){c.classList.toggle('sel',c===t);});});
  try{const saved=JSON.parse(localStorage.getItem('ffnet')||'{}');
    if(saved.name)$('lbName').value=saved.name;
    if(saved.host)$('lbAddr').value=saved.host;}catch(err){}
})();
function lbStatus(txt,bad){const s=$('lbStatus');if(!s)return;s.textContent=txt;s.classList.toggle('bad',!!bad);}
function openLobby(){$('menu').classList.add('gone');$('lobby').classList.add('on');}
function closeLobby(){$('lobby').classList.remove('on');$('menu').classList.remove('gone');}
function refreshLbPlayers(list){
  const box=$('lbPlayers');if(!box)return;
  box.innerHTML=list.length?('В лесу ('+list.length+'):'+list.map(function(p){
    return '<span class="pl"><i style="background:#'+new THREE.Color(TEAM_COLORS[p.team%4]).getHexString()+'"></i>'+escHtml(p.name)+'</span>';}).join('')):'';}
function escHtml(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

$('netBtn').addEventListener('click',openLobby);
$('lbBack').addEventListener('click',closeLobby);
$('lbJoin').addEventListener('click',function(){
  const name=($('lbName').value||'').trim()||'Лисёнок';
  let host=($('lbAddr').value||'').trim();
  if(!host){
    host=(location.hostname==='localhost'||location.hostname==='127.0.0.1'||!location.hostname)
      ?'ws://localhost:8765':('ws://'+location.hostname+':8765');
    $('lbAddr').value=host;
  }
  if(/^wss?:\/\//i.test(host)){/* ok */}
  else if(/^https?:\/\//i.test(host))host=host.replace(/^http/,'ws');
  else host='ws://'+host.replace(/^\/\//,'');
  if(!/:\d+/.test(host.split('/').pop()))host+=':8765';
  try{localStorage.setItem('ffnet',JSON.stringify({name:name,host:host}));}catch(err){}
  NET.name=name;NET.host=host;
  lbStatus('Подключение к '+host+'…');$('lbJoin').disabled=true;
  netConnect(host,name);
});

/* ---------- соединение ---------- */
function netConnect(url,name){
  NET.connected=false;
  let ws;
  try{ws=new WebSocket(url);}catch(err){lbStatus('Неверный адрес: '+err.message,true);$('lbJoin').disabled=false;return;}
  NET.ws=ws;
  ws.onopen=function(){
    NET.connected=true;
    lbStatus('Соединение установлено, входим в лес…');
    ws.send(JSON.stringify({t:'join',name:name,team:NET.team}));
    setTimeout(function(){
      if(NET.connected&&!NET.fruitsInit)
        lbStatus('Мы на связи, но мир ещё не пришёл. Проверьте, что на сервере запущен python3 server.py');
    },2500);
  };
  ws.onmessage=function(ev){
    let m;try{m=JSON.parse(ev.data);}catch(err){return;}
    if(m.t==='hello'){NET.id=m.id;NET.world=m.world;
      NET.serverSnapshot=m.snapshot||null;   // мир целиком пришёл вместе с hello
      initGame(m.world||'classic',true);}
    else if(m.t==='state')applyState(m);
  };
  ws.onclose=function(){
    NET.connected=false;
    if(G.state==='play'&&!NET.overShown){
      setNetOverlay('Связь с сервером потеряна…');
      setTimeout(function(){location.reload();},2500);
    }else if(G.state==='menu'||G.state==='lobby'){
      lbStatus('Сервер не отвечает. Запущен ли там python3 server.py? Верны ли адрес и порт?',true);
      $('lbJoin').disabled=false;
    }};
  ws.onerror=function(){/* onclose обработает */};
}
function netSend(obj){
  if(NET.ws&&NET.ws.readyState===1){try{NET.ws.send(JSON.stringify(obj));}catch(err){}}
}

/* ---------- применение снимка сервера ---------- */
function applyState(m){
  if(!NET.fruitsInit)return; // до входа в мир снапшоты игнорируем (hello всё даст)
  // мир поменялся (перезапуск кем-то) — перечитываем страницу, чтобы перестроить лес
  if(NET.worldKey&&m.world&&NET.worldKey!==m.world){location.reload();return;}
  NET.worldKey=m.world||NET.worldKey;
  // плоды
  if(fruitsArr.length&&m.fruits){
    for(let i=0;i<Math.min(fruitsArr.length,m.fruits.length);i++){
      const alive=!!m.fruits[i][2];
      if(alive!==fruitsArr[i].alive){
        fruitsArr[i].alive=alive;
        if(alive)scene.add(fruitsArr[i].g);else scene.remove(fruitsArr[i].g);}
    }
    if(G.fruits!==m.collected){G.fruits=m.collected;$('fruitCt').textContent=G.fruits;}
  }
  // портал
  if(m.portal&&!portal.active){
    portal.active=true;portal.group.visible=true;portal.light.intensity=2.6;
    setGoal('Портал открыт! Бегите к свету в центре поляны ✦',true);
    setHint('Плоды собраны — портал домой открыт!',5);}
  // дух: состояние из единого источника
  if(m.spirit){
    const st=m.spirit.state;
    if(st==='off'&&spirit.state!=='off'){spirit.state='off';spirit.group.scale.setScalar(.001);}
    else if(st==='die'&&spirit.state!=='die'){spirit.state='die';spirit.dieT=0;}
    else if((st==='lurk'||st==='chase')&&(spirit.state==='off'||spirit.state==='wait'))spawnSpirit(true);
    if(st==='chase'&&spirit.state==='lurk')spirit.state='chase';
  }
  // события
  (m.evts||[]).forEach(function(pair){handleNetEvent(pair[1]);});
  if(m.evts&&m.evts.length)NET.lastEvtTs=Math.max(NET.lastEvtTs,m.evts[m.evts.length-1][0]);
  // дух: сервер разрешает столкновения — если он нас догнал, показываем последствия
  if(spirit.state==='die'&&spirit.dieT>0.5&&G.hearts<=0&&!NET.overShown){
    NET.overShown=true;showEndScreen(false);G.state='end';}
  // игроки
  refreshLbPlayers(m.players||[]);
  const seen={};
  (m.players||[]).forEach(function(p){
    if(p.id===NET.id)return;
    seen[p.id]=1;updateRemoteFox(p);});
  for(const id in NET.remotes){if(!seen[id])removeRemoteFox(+id);}
  // свои сердца — от сервера
  const me=(m.players||[]).find(function(p){return p.id===NET.id;});
  if(me){
    if(G.hearts!==me.hearts){G.hearts=me.hearts;updateHearts();}
    if(!me.alive&&!NET.overShown){NET.overShown=true;showEndScreen(false);G.state='end';}
  }
  if(m.state==='over'&&!NET.overShown){NET.overShown=true;showEndScreen(true);G.state='end';}
}
function handleNetEvent(e){
  const key=e.kind+':'+(e.seq!==undefined?e.seq:'')+':'+(e.i!==undefined?e.i:'')+':'+(e.id!==undefined?e.id:'');
  if(NET._evSeen===undefined)NET._evSeen={};
  if(NET._evSeen[key])return;NET._evSeen[key]=1;
  switch(e.kind){
    case 'collect':
      if(e.by!==NET.id){
        const fr=fruitsArr[e.i];
        if(fr)burst(fr.g.position.clone().add(new THREE.Vector3(0,1.3,0)),W.fruit,14,4,.6);
        setHint((playerNameById(e.by)||'Кто-то')+' сорвал плод! Осталось '+Math.max(0,CFG.goal-G.fruits),3);}
      break;
    case 'hit':if(e.id!==NET.id)setHint((playerNameById(e.id)||'Лисёнок')+' наступил в туман…',3);break;
    case 'down':setHint((playerNameById(e.id)||'Лисёнок')+' упал без сил…',4);break;
  }
}
function playerNameById(id){for(const k in NET.remotes){if(NET.remotes[k].data&&NET.remotes[k].data.id===id)return NET.remotes[k].data.name;}return null;}

/* ---------- чужие лисята ---------- */
function makeMiniFox(team){
  const g=new THREE.Group();
  const col=TEAM_COLORS[team%4];
  const fur=new THREE.MeshStandardMaterial({color:col,roughness:.8});
  const dark=new THREE.MeshStandardMaterial({color:new THREE.Color(col).multiplyScalar(.55),roughness:.8});
  const cream=new THREE.MeshStandardMaterial({color:0xf7ecd9,roughness:.8});
  const M=function(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  M(new THREE.SphereGeometry(1,14,10),fur,0,.42,0).scale.set(.23,.215,.38);
  M(new THREE.SphereGeometry(.175,14,10),fur,0,.64,.30).scale.set(1,.96,.95);
  M(new THREE.SphereGeometry(.075,10,8),cream,0,.585,.44).scale.set(1,.8,1.7);
  M(new THREE.ConeGeometry(.075,.24,5),fur,-.095,.82,.285);
  M(new THREE.ConeGeometry(.075,.24,5),fur,.095,.82,.285);
  M(new THREE.SphereGeometry(.045,8,6),dark,-.08,.66,.42);
  M(new THREE.SphereGeometry(.045,8,6),dark,.08,.66,.42);
  const legGeo=new THREE.CylinderGeometry(.033,.027,.24,6);
  [[-.1,.19],[.1,.19],[-.115,-.2],[.115,-.2]].forEach(function(p){M(legGeo,dark,p[0],.28,p[1]);});
  M(new THREE.SphereGeometry(.09,8,6),dark,0,.46,-.3).scale.set(1,1,1.6);
  g.scale.setScalar(2.3);
  return g;
}
function updateRemoteFox(p){
  let r=NET.remotes[p.id];
  if(!r){
    const g=makeMiniFox(p.team);
    g.position.set(p.x,gH(p.x,p.z),p.z);
    scene.add(g);
    g.add(makeNameLabel(p.name,TEAM_COLORS[p.team%4]));
    r=NET.remotes[p.id]={group:g,data:p,tgtX:p.x,tgtZ:p.z,tgtYaw:p.yaw,ph:rnd(9)};
  }
  r.data=p;r.tgtX=p.x;r.tgtZ=p.z;r.tgtYaw=p.yaw;
  r.group.visible=p.alive!==false;
}
function removeRemoteFox(id){
  const r=NET.remotes[id];if(!r)return;
  scene.remove(r.group);delete NET.remotes[id];
}
function makeNameLabel(text,colorNum){
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d');
  x.font='bold 28px Comfortaa, Nunito, sans-serif';
  const w=Math.min(244,x.measureText(text).width+40);
  x.fillStyle='rgba(30,24,50,.55)';roundRect(x,128-w/2,8,w,44,20);x.fill();
  x.fillStyle='#'+new THREE.Color(colorNum).getHexString();
  x.beginPath();x.arc(128-w/2+18,30,7,0,7);x.fill();
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
  x.fillText(text,128+8,31);
  const tex=new THREE.CanvasTexture(c);
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  spr.scale.set(1.9,.48,1);spr.position.set(0,2.15,0);
  return spr;
}
function roundRect(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);
  x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath();}
function updateRemoteFoxes(dt){
  for(const id in NET.remotes){
    const r=NET.remotes[id],g=r.group;
    g.position.x+=(r.tgtX-g.position.x)*Math.min(1,dt*9);
    g.position.z+=(r.tgtZ-g.position.z)*Math.min(1,dt*9);
    g.rotation.y=lerpAngle(g.rotation.y,r.tgtYaw,Math.min(1,dt*8));
    const moving=Math.hypot(r.tgtX-g.position.x,r.tgtZ-g.position.z)>0.3;
    g.position.y=gH(g.position.x,g.position.z)+(moving?Math.abs(Math.sin(G.t*9+r.ph))*.07:0);
  }
}

/* ---------- сетевые обёртки над локальными функциями ---------- */
const _collectFruit=collectFruit;
collectFruit=function(i){
  if(!NET.on){_collectFruit(i);return;}
  netSend({t:'collect',i:i});   // результат придёт от сервера в снапшоте
  spirit.enrage=6;              // локально чуть злим духа для отзывчивости
};
const _hitFox=hitFox;
hitFox=function(){
  if(!NET.on){_hitFox();return;}
  if(G.invuln>0)return;
  G.invuln=3;
  netSend({t:'hit'});           // сердца отнимет сервер
  const f=$('flash');f.style.transition='none';f.style.opacity=.7;
  requestAnimationFrame(function(){f.style.transition='opacity 1s';f.style.opacity=0;});
  const dir=fox.group.position.clone().sub(spirit.group.position).setY(0).normalize();
  fox.group.position.addScaledVector(dir,3);
  burst(spirit.group.position.clone().add(new THREE.Vector3(0,1,0)),W.spiritLight,12,2.5,1.2);
  spirit.state='die';spirit.dieT=0;
  setHint('Дух тумана коснулся вас…',4);
};
const _endGame=endGame;
endGame=function(win){
  if(!NET.on){_endGame(win);return;}
  if(NET.overShown)return;
  if(win){NET.overShown=true;netSend({t:'portal'});showEndScreen(true);}
  else{NET.overShown=true;showEndScreen(false);}
};
function showEndScreen(win){
  if(G.state==='end')return;
  G.state='end';spirit.state='off';spirit.group.scale.setScalar(.001);
  $('endTitle').textContent=win?'Лисята дома! ✦':'Дух догнал лисёнка…';
  $('endText').innerHTML=win
    ?'Семь плодов, храбрые сердца — и портал мягко закрылся за спинами. Дом пахнет чаем и одеялом.'
    :'Лисёнок присел отдохнуть в тумане. Друзья ещё в лесу — а вы можете начать новую прогулку.';
  $('end').classList.add('on');
  if(S){if(!win)S.lose();S.duck(.4);}
}
/* пауза в сети не замораживает общий мир — только ваш экран */
const _togglePause=togglePause;
togglePause=function(){
  if(!NET.on){_togglePause();return;}
  if(G.state!=='play'&&G.state!=='pause')return;
  G.state=(G.state==='play')?'pause':'play';
  $('pause').classList.toggle('on',G.state==='pause');
  if(S)S.duck(G.state==='pause'?.12:.8);
};

/* ---------- хук в initGame: сетевой запуск ---------- */
/* кнопка на экране финала: в сети — «новая прогулка» (перезапуск общего мира),
   в одиночной игре — обычная перезагрузка страницы */
$('endBtn').addEventListener('click',function(){
  if(NET.on){NET.overShown=false;netSend({t:'restart',world:W.key});}
  location.reload();
});

const _initGame=initGame;
initGame=function(key,network){
  if(!network){_initGame(key);return;}
  NET.on=true;
  try{
    W=WORLDS[key];W.key=key;NET.worldKey=key;
    BEAMTEX=beamTexture();
    document.documentElement.style.setProperty('--accent','#'+new THREE.Color(W.fruit).getHexString());

    renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    $('stage').appendChild(renderer.domElement);

    scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(W.fog,W.fogD);
    camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,900);
    scene.add(new THREE.AmbientLight(W.amb,W.ambI));
    scene.add(new THREE.HemisphereLight(W.hemiS,W.hemiG,W.hemiI));
    sunLight=new THREE.DirectionalLight(W.sun,W.sunI);
    sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);
    const sc=sunLight.shadow.camera;sc.left=-32;sc.right=32;sc.top=32;sc.bottom=-32;sc.near=5;sc.far=250;
    scene.add(sunLight);scene.add(sunLight.target);

    buildSky();buildGround();buildTrees();buildDetails();
    buildFox();buildArrow();buildFruits();buildSpirit();buildPortal();buildParticles();

    // окраска своего лисёнка в цвет команды
    fox.group.traverse(function(o){
      if(o.isMesh&&o.material&&o.material.color){
        const hsl={h:0,s:0,l:0};o.material.color.getHSL(hsl);
        if(hsl.s>.35&&hsl.l<.85){o.material=o.material.clone();
          o.material.color.setHex(TEAM_COLORS[NET.team%4]);}}});

    // стартовая позиция — со смещением, чтобы лисята не накладывались
    const ang=NET.team*Math.PI/2+.4;
    fox.group.position.set(Math.cos(ang)*2.5,0,Math.sin(ang)*2.5);

    // позиции плодов — как назначил сервер (уже пришли в hello)
    applyServerFruits(NET.serverSnapshot);

    G.state='play';G.introT=0;
    $('loc').textContent=W.name+' · сеть';
    $('menu').classList.add('gone');$('hud').style.display='block';
    $('lobby').classList.remove('on');
    addNetHud();
    setTimeout(function(){$('loc').style.opacity=1;},600);
    setTimeout(function(){$('loc').style.opacity=0;},4800);
    setTimeout(function(){setHint('Вы в сети! Плоды, портал и дух — общие ✦');},1500);
    ambLoop();
    try{initAudio();}catch(err){console.warn('звук недоступен:',err);}
    clock=new THREE.Clock();
    animate();
  }catch(err){showErr(err.message);console.error(err);}
};
function applyServerFruits(snap){
  if(!snap||!snap.fruits)return;
  for(let i=0;i<Math.min(fruitsArr.length,snap.fruits.length);i++){
    const f=snap.fruits[i];
    fruitsArr[i].g.position.set(f[0],gH(f[0],f[1]),f[1]);
    fruitsArr[i].alive=!!f[2];
    if(!fruitsArr[i].alive)scene.remove(fruitsArr[i].g);
  }
  G.fruits=snap.collected||0;$('fruitCt').textContent=G.fruits;
  NET.fruitsInit=true;
  if(snap.portal){portal.active=true;portal.group.visible=true;portal.light.intensity=2.6;
    setGoal('Портал открыт! Бегите к свету в центре поляны ✦',true);}
  if(snap.spirit&&snap.spirit.state!=='off'&&spirit.state==='off')spawnSpirit(true);
  (snap.players||[]).forEach(function(p){if(p.id!==NET.id)updateRemoteFox(p);});
  refreshLbPlayers(snap.players||[]);
}
function setNetOverlay(msg){
  let o=$('netOver');
  if(!o){o=document.createElement('div');o.id='netOver';document.body.appendChild(o);}
  o.textContent=msg;o.classList.add('on');
}
function addNetHud(){
  const pill=document.createElement('div');
  pill.className='pill';pill.id='netPill';
  pill.innerHTML='<div class="hud-label">Сеть</div><div id="netInfo">🟢 вы</div>';
  document.querySelector('.hud-top').appendChild(pill);
  setInterval(function(){
    const el=$('netInfo');if(!el)return;
    const n=Object.keys(NET.remotes).length+(NET.connected?1:0);
    el.innerHTML=(NET.connected?'🟢':'🔴')+' игроков: '+n;
  },1000);
}
/* рассылка своей позиции ~15 Гц + вход в портал */
(function netTicker(){
  setInterval(function(){
    if(!NET.on||!NET.ws||NET.ws.readyState!==1)return;
    const p=fox.group.position;
    netSend({t:'pos',x:+p.x.toFixed(2),z:+p.z.toFixed(2),yaw:+fox.group.rotation.y.toFixed(2),
      sprint:!!(keys.ShiftLeft||keys.ShiftRight||keys.Space)});
    if(portal.active&&G.state==='play'&&!NET.overShown&&Math.hypot(p.x,p.z)<2.7)endGame(true);
  },66);
})();
