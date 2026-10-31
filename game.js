(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const W = canvas.width, H = canvas.height;
  const MAP_W = 2200, MAP_H = 1500;
  const WORLD_DATA = [
    { name:'Зелёный мир', icon:'🌿', fruit:'🍎', fruitName:'яблока', bg:'#438060', tile:'#458363', tile2:'#4b8a68', detail:'#2c6b48', accent:'#a2e5a2', danger:'#e36b69', fruitColor:'#f04f52', hazard:'колючки', drain:1.0 },
    { name:'Песчаный мир', icon:'☀️', fruit:'🌵', fruitName:'плода кактуса', bg:'#caa563', tile:'#d9b577', tile2:'#cfab69', detail:'#ad894c', accent:'#ffe8ad', danger:'#e67a55', fruitColor:'#f17e83', hazard:'кактусы', drain:1.55 },
    { name:'Ледяной мир', icon:'❄️', fruit:'🫐', fruitName:'ягоды', bg:'#a7ced7', tile:'#b8dee3', tile2:'#a7d0db', detail:'#7bb8c6', accent:'#e9fbff', danger:'#6a97ce', fruitColor:'#4a5fa9', hazard:'льдины', drain:1.8 },
  ];
  const rng = (seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })(87119);
  const rand=(a,b)=>a+(b-a)*rng();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let mode='title', last=0, tick=0, toastTime=0, shake=0;
  const keys=new Set();
  const worlds=WORLD_DATA.map((info,i)=>{
    const fruit=[]; const decor=[]; const hazards=[];
    const portal={x:MAP_W-255,y:MAP_H/2};
    const reserved=(x,y) => Math.hypot(x-250,y-MAP_H/2)<165 || Math.hypot(x-portal.x,y-portal.y)<145;
    for(let j=0;j<45;j++){
      const x=rand(105,MAP_W-105), y=rand(110,MAP_H-110);
      if(!reserved(x,y)) fruit.push({x,y,usedUntil:0,wiggle:rand(0,6.28)});
    }
    for(let j=0;j<132;j++){
      const x=rand(50,MAP_W-50), y=rand(50,MAP_H-50);
      if(!reserved(x,y)) decor.push({x,y,r:rand(9,24),kind:rng()});
    }
    for(let j=0;j<42;j++){
      const x=rand(65,MAP_W-65),y=rand(65,MAP_H-65);
      if(!reserved(x,y))hazards.push({x,y,r:rand(15,22)});
    }
    return { info, fruit, decor, hazards, portal, index:i };
  });
  let state;
  function init(){
    state={worldIndex:0,x:250,y:MAP_H/2,hp:100,hunger:80,time:0,score:0,inventory:[0,0,0],collectedThisWorld:0,damageCd:0,portalVisited:0};
    for(const world of worlds)for(const fruit of world.fruit)fruit.usedUntil=0;
    keys.clear(); updateUI();
  }
  function current(){return worlds[state.worldIndex]}
  function notify(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('visible');toastTime=2.8; }
  function overlay(title,body,button,icon){$('modalTitle').textContent=title;$('modalBody').textContent=body;$('startButton').textContent=button;$('modalIcon').textContent=icon;$('overlay').classList.remove('hidden');}
  function hideOverlay(){$('overlay').classList.add('hidden')}
  function start(){init();mode='playing';hideOverlay();notify('Собери 3 яблока, чтобы активировать портал!')}
  function pause(){if(mode==='playing'){mode='paused';overlay('Пауза','Вернись в мир, когда будешь готов.','Продолжить','⏸')}else if(mode==='paused'){mode='playing';hideOverlay()}}
  function gameOver(){mode='dead';keys.clear();overlay('Путешествие окончено',`Ты выжил ${formatTime(state.time)} и собрал ${state.score} очков. Попробуешь ещё раз?`,'Играть снова','💔')}
  const formatTime=v=>{const s=Math.floor(v);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
  function updateUI(){
    $('worldLabel').textContent=current().info.icon+' '+current().info.name;
    $('healthText').textContent=Math.ceil(state.hp);
    $('hungerText').textContent=Math.ceil(state.hunger);
    $('healthBar').style.width=clamp(state.hp,0,100)+'%';
    $('hungerBar').style.width=clamp(state.hunger,0,100)+'%';
    $('timeText').textContent=formatTime(state.time);
    $('scoreText').textContent=state.score;
    $('inventory').textContent=state.inventory.map((n,i)=>WORLD_DATA[i].fruit+' '+n).join('  ·  ');
    const need=Math.max(0,3-state.collectedThisWorld);
    $('objective').textContent=need?`Цель: собери ещё ${need} ${current().info.fruitName}`:'Цель: найди светящийся портал и нажми E';
  }
  function hurt(n){if(state.damageCd>0)return;state.hp=clamp(state.hp-n,0,100);state.damageCd=.8;shake=.18;notify(`Урон −${n}! Берегись опасностей.`);if(state.hp<=0)gameOver()}
  function interact(){
    if(mode!=='playing')return;
    const w=current(),p=state;
    let closest=null,min=64;
    for(const item of w.fruit){const d=distance(item,p);if(item.usedUntil<=p.time&&d<min){closest=item;min=d}}
    const portalDistance=distance(w.portal,p);
    if(portalDistance<95){
      if(p.collectedThisWorld<3){notify('Порталу нужны 3 плода текущего мира!');return}
      p.worldIndex=(p.worldIndex+1)%worlds.length;
      p.portalVisited++;p.collectedThisWorld=0;
      p.x=250;p.y=MAP_H/2;p.hunger=clamp(p.hunger+10,0,100);p.score+=50;
      notify('Открыт новый мир! +50 очков. Сытость +10.');updateUI();return;
    }
    if(closest){closest.usedUntil=p.time+22;p.inventory[p.worldIndex]++;p.collectedThisWorld++;p.score+=10;p.hunger=clamp(p.hunger+14,0,100);notify(`${w.info.fruit} Собрано! +10 очков, +14 сытости`);updateUI();return}
    notify('Подойди ближе к плоду или порталу.');
  }
  function update(dt){
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible')}
    shake=Math.max(0,shake-dt);
    if(mode!=='playing')return;
    state.time+=dt;
    state.damageCd=Math.max(0,state.damageCd-dt);
    const w=current(),speed=228;
    const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    const len=Math.hypot(dx,dy)||1;
    state.x=clamp(state.x+dx/len*speed*dt,30,MAP_W-30);
    state.y=clamp(state.y+dy/len*speed*dt,30,MAP_H-30);
    state.hunger=clamp(state.hunger-w.info.drain*dt,0,100);
    if(state.hunger<=0)state.hp=clamp(state.hp-6*dt,0,100);
    for(const h of w.hazards){if(distance(h,state)<h.r+13){hurt(w.index===0?9:w.index===1?13:11);break}}
    if(state.hp<=0){gameOver();return}
    tick+=dt; if(tick>.08){tick=0;updateUI()}
  }
  function roundedRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
  function circle(x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
  function ellipse(x,y,rx,ry,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
  function drawFruit(f,w){
    const phase=Math.sin(state.time*2.8+f.wiggle)*3;
    ellipse(f.x,f.y+15,16,6,'#00000025');
    if(w.index===0){circle(f.x,f.y+phase,13,'#e95352');circle(f.x-4,f.y-4+phase,4,'#ffb0a0');roundedRect(f.x-1,f.y-19+phase,3,8,1,'#5a583b');ellipse(f.x+7,f.y-14+phase,8,4,'#369a55')}
    if(w.index===1){ellipse(f.x,f.y+phase,12,17,'#3f985c');for(let i=0;i<5;i++)circle(f.x-7+i*3.5,f.y-7+phase,1.2,'#f4f1b8');circle(f.x,f.y-14+phase,7,'#ee7b87')}
    if(w.index===2){for(let i=0;i<3;i++)circle(f.x+Math.cos(i*2.09)*8,f.y+Math.sin(i*2.09)*8+phase,9,'#5769b6');circle(f.x-2,f.y-5+phase,3,'#b9b9ff');ellipse(f.x+5,f.y-16+phase,8,4,'#4e9a91')}
  }
  function drawDecor(o,w){const{x,y,r}=o;ellipse(x+3,y+r*.5,r*.85,r*.36,'#00000022');
    if(w.index===0){
      if(o.kind<.70){roundedRect(x-4,y-8,8,29,3,'#79583e');circle(x,y-15,r,'#265e45');circle(x-r*.4,y-20,r*.65,'#318059');circle(x+r*.45,y-20,r*.65,'#3c9363')}
      else{circle(x,y,5,'#f6d67b');for(let a=0;a<7;a++)circle(x+Math.sin(a)*10,y+Math.cos(a)*10,4,'#f4eabb')}
    } else if(w.index===1){
      if(o.kind<.65){roundedRect(x-6,y-r,12,r*2,6,'#4f9760');roundedRect(x-17,y-7,13,8,4,'#4f9760');roundedRect(x+5,y-16,14,8,4,'#4f9760');roundedRect(x+13,y-20,7,14,3,'#4f9760')}
      else{ellipse(x,y,15,7,'#a98154');ellipse(x-7,y-3,9,5,'#c0a073')}
    }else{if(o.kind<.7){ctx.fillStyle='#e4f9ff';ctx.beginPath();ctx.moveTo(x,y-r*1.6);ctx.lineTo(x-r,y+r*.6);ctx.lineTo(x+r,y+r*.6);ctx.fill();roundedRect(x-3,y+8,6,12,2,'#8eaeba')}
      else{circle(x,y,7,'#ebffff');circle(x+9,y+6,5,'#e7fbff')}}
  }
  function drawHazard(h,w){ellipse(h.x,h.y+h.r*.5,h.r,h.r*.35,'#00000026');
    if(w.index===0){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.strokeStyle='#743d4a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+Math.cos(a)*h.r,h.y+Math.sin(a)*h.r);ctx.stroke()}circle(h.x,h.y,7,'#cf6965')}
    if(w.index===1){circle(h.x,h.y,h.r,'#b87d4c');for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.strokeStyle='#f8e0b1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(h.x+Math.cos(a)*h.r*.5,h.y+Math.sin(a)*h.r*.5);ctx.lineTo(h.x+Math.cos(a)*h.r*1.15,h.y+Math.sin(a)*h.r*1.15);ctx.stroke()}}
    if(w.index===2){ctx.fillStyle='#4e9fc2';ctx.beginPath();ctx.moveTo(h.x,h.y-h.r);ctx.lineTo(h.x+h.r,h.y+h.r*.8);ctx.lineTo(h.x-h.r,h.y+h.r*.8);ctx.closePath();ctx.fill();ctx.fillStyle='#d7fbff';ctx.beginPath();ctx.moveTo(h.x,h.y-h.r);ctx.lineTo(h.x+h.r*.4,h.y+h.r*.8);ctx.lineTo(h.x-h.r*.2,h.y+h.r*.45);ctx.fill()}
  }
  function drawPortal(w){const p=w.portal,ready=state.collectedThisWorld>=3,bob=Math.sin(state.time*3)*3;
    ellipse(p.x,p.y+22,66,26,'#00000040');
    ctx.save();ctx.translate(p.x,p.y+bob);ctx.shadowBlur=ready?45:22;ctx.shadowColor=ready?'#a5fcff':'#628b94';ctx.strokeStyle=ready?'#baffff':'#597f82';ctx.lineWidth=13;ctx.beginPath();ctx.ellipse(0,-10,39,65,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ready?'#7bdac055':'#101b2077';ctx.beginPath();ctx.ellipse(0,-10,31,56,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.font='34px system-ui';ctx.textAlign='center';ctx.fillText(ready?'✦':'🔒',0,1);ctx.restore();ctx.fillStyle=w.info.accent;ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText('ПОРТАЛ',p.x,p.y-92)
  }
  function drawPlayer(){const{x,y}=state;ellipse(x,y+19,18,8,'#00000055');ctx.save();ctx.translate(x,y);const walk=Math.sin(state.time*10)*3;roundedRect(-13,-8,10,25+Math.max(0,walk),4,'#283b54');roundedRect(3,-8,10,25+Math.max(0,-walk),4,'#283b54');roundedRect(-16,-23,32,33,9,'#e2ae67');roundedRect(-13,-21,26,19,7,'#4c718e');circle(0,-32,13,'#f9c594');ctx.fillStyle='#343d45';ctx.fillRect(-6,-35,3,3);ctx.fillRect(5,-35,3,3);ctx.beginPath();ctx.arc(0,-26,4,0,Math.PI);ctx.strokeStyle='#915939';ctx.lineWidth=1.7;ctx.stroke();ctx.fillStyle='#573e35';ctx.beginPath();ctx.arc(0,-36,14,Math.PI,Math.PI*2);ctx.fill();ctx.restore()}
  function draw(){if(!state)return;const w=current();ctx.clearRect(0,0,W,H);ctx.fillStyle=w.info.bg;ctx.fillRect(0,0,W,H);
    const camX=clamp(state.x-W/2,0,MAP_W-W),camY=clamp(state.y-H/2,0,MAP_H-H);
    ctx.save();if(shake>0)ctx.translate((rng()-.5)*6,(rng()-.5)*6);ctx.translate(-camX,-camY);
    const startX=Math.floor(camX/90)*90,startY=Math.floor(camY/90)*90;
    for(let x=startX;x<camX+W+90;x+=90)for(let y=startY;y<camY+H+90;y+=90){const alt=(Math.floor(x/90)*17+Math.floor(y/90)*31)%3===0;ctx.fillStyle=alt?w.info.tile:w.info.tile2;ctx.fillRect(x,y,90,90)}
    ctx.strokeStyle=w.index===2?'#e8f7f52a':'#142c1c19';ctx.lineWidth=3;ctx.strokeRect(4,4,MAP_W-8,MAP_H-8);
    for(const d of w.decor){if(Math.abs(d.x-state.x)<850&&Math.abs(d.y-state.y)<600)drawDecor(d,w)}
    for(const h of w.hazards){if(Math.abs(h.x-state.x)<850&&Math.abs(h.y-state.y)<600)drawHazard(h,w)}
    for(const f of w.fruit){if(f.usedUntil>state.time)continue;if(Math.abs(f.x-state.x)<850&&Math.abs(f.y-state.y)<600)drawFruit(f,w)}
    drawPortal(w);drawPlayer();
    let target=null,dist=65;for(const f of w.fruit){const d=distance(f,state);if(f.usedUntil<=state.time&&d<dist){dist=d;target=f}}
    if(distance(w.portal,state)<95){target=w.portal;dist=0}
    if(target){ctx.strokeStyle='#ffffffb5';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(target.x,target.y,dist===0?78:25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
    ctx.restore();
    roundedRect(12,12,163,49,9,'#092322ac');ctx.fillStyle='#f2fffa';ctx.font='bold 15px system-ui';ctx.fillText(w.info.icon+' '+w.info.name,24,34);ctx.fillStyle='#c6f7db';ctx.font='12px system-ui';ctx.fillText('Портал → восток карты',24,52);
    if(state.damageCd>0){ctx.fillStyle=`rgba(230,50,70,${Math.min(.18,state.damageCd*.24)})`;ctx.fillRect(0,0,W,H)}
  }
  function frame(t){const dt=last?Math.min((t-last)/1000,.05):0;last=t;update(dt);draw();requestAnimationFrame(frame)}
  $('startButton').addEventListener('click',()=>{if(mode==='paused'){pause()}else start()});
  $('pauseButton').addEventListener('click',()=>{if(mode==='playing'||mode==='paused')pause()});
  $('interactButton').addEventListener('click',interact);
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','e','escape'].includes(k))e.preventDefault();if(k==='escape'){if(!e.repeat)pause();return}if(k==='e'&&!e.repeat)interact();keys.add(k)});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  for(const btn of document.querySelectorAll('[data-direction]')){
    const k={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'}[btn.dataset.direction];
    btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);keys.add(k)});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>keys.delete(k));
  }
  init();requestAnimationFrame(frame);
})();
