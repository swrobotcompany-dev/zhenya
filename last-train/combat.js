/* Animated zombie combat. World coordinates are shared with visuals.js. */
'use strict';
const ZOMBIE_STATS=[
  {name:'Шатун',hp:2,speed:28,damage:3,reach:42},
  {name:'Ползун',hp:1,speed:42,damage:2,reach:56},
  {name:'Громила',hp:5,speed:13,damage:9,reach:55},
  {name:'Прыгун',hp:2,speed:48,damage:4,reach:38},
  {name:'Спороносец',hp:3,speed:19,damage:5,reach:45},
  {name:'Двуглавый',hp:4,speed:22,damage:6,reach:48}
];
const WAVE_FRONT=ENGINE_X+262;
const AttackFX={shot:null,feedback:'',feedbackAt:0,lastShot:0,lastUpdate:0,hitFlash:0};
function ensureZombieWave(state){
  if(state.gameover||state.phase!=='raid')return;
  if(state.wave&&Array.isArray(state.wave.enemies)&&state.wave.enemies.length)return;
  const n=Math.min(9,4+Math.floor(Math.max(0,state.distance)/65));
  const enemies=[];
  for(let i=0;i<n;i++){
    const kind=(i+state.day)%6,stats=ZOMBIE_STATS[kind];
    const hp=stats.hp+Math.floor(state.day/14);
    enemies.push({id:state.day*100+i,kind,hp,maxHp:hp,x:WAVE_FRONT+170+i*72,
      ground:424+(i%3)*8,seed:state.day*17+i*31,cooldown:i*.15,dead:false});
  }
  state.wave={enemies,kills:0,damage:0};
  AttackFX.lastUpdate=0;
}
function zombieAlive(state){
  return state.wave?.enemies?.filter(e=>e.hp>0).length||0;
}
function finishZombieWave(state){
  const k=state.wave?.kills||0;
  state.attack=0;state.wave=null;state.phase='station';
  // Preserve whether this stop was already searched before the raid.
  if(typeof write==='function')write('Атака отбита! Уничтожено зомби: '+k+'. Теперь можно исследовать станцию.');
  AttackFX.feedback='УГРОЗА УСТРАНЕНА';AttackFX.feedbackAt=performance.now();
  if(typeof render==='function')render();
}
function updateZombieWave(state,ms){
  if(state.gameover||state.phase!=='raid'||document.hidden||TrainArt.journey?.active)return;
  ensureZombieWave(state);
  if(!AttackFX.lastUpdate){AttackFX.lastUpdate=ms;return}
  const dt=Math.max(0,Math.min(.08,(ms-AttackFX.lastUpdate)/1000));
  AttackFX.lastUpdate=ms;
  if(dt===0)return;
  let changed=false,totalDamage=0;
  for(const e of state.wave.enemies){
    if(e.hp<=0)continue;
    const stats=ZOMBIE_STATS[e.kind];
    if(e.x>WAVE_FRONT+stats.reach*.3)e.x=Math.max(WAVE_FRONT+stats.reach*.3,e.x-stats.speed*dt);
    else{
      e.cooldown+=dt;
      if(e.cooldown>=2.4){
        e.cooldown=0;
        totalDamage+=Math.max(1,stats.damage-(state.armor||0)-(state.wagons.includes('Охранный')?2:0));
      }
    }
  }
  if(totalDamage>0){
    state.hp=Math.max(0,state.hp-totalDamage);
    state.wave.damage+=totalDamage;
    AttackFX.hitFlash=ms;changed=true;
    if(typeof checkEnd==='function')checkEnd();
    if(typeof write==='function')write('Зомби добрались до локомотива: −'+totalDamage+' прочности.');
  }
  if(changed&&typeof render==='function')render();
}
function aimZombieOnCanvas(state,x,y){
  if(state.gameover||state.phase!=='raid'||TrainArt.journey?.active)return false;
  ensureZombieWave(state);
  const ms=performance.now();
  if(ms-AttackFX.lastShot<180)return true;
  AttackFX.lastShot=ms;
  if(!state.ammo){
    AttackFX.feedback='НЕТ ПАТРОНОВ — НАЖМИ «АВТООБОРОНА»';
    AttackFX.feedbackAt=ms;return true;
  }
  // A shot costs one cartridge even on a miss.
  state.ammo=Math.max(0,state.ammo-1);
  let hit=null,rank=Infinity;
  for(const e of state.wave.enemies){
    if(e.hp<=0)continue;
    const sx=e.x-TrainArt.camera,sy=e.ground;
    const p=ZOMBIE_STATS[e.kind];
    const xRadius=(e.kind===2||e.kind===1)?53:36;
    const top=sy-(e.kind===2?112:e.kind===4?108:e.kind===3?100:91);
    if(Math.abs(x-sx)<xRadius&&y>top-18&&y<sy+20){
      const d=Math.abs(x-sx)+Math.abs(y-(sy-55))*.17;
      if(d<rank){rank=d;hit=e}
    }
  }
  AttackFX.shot={time:ms,x,y,hit:!!hit};
  if(hit){
    const damage=Math.max(1,state.gun||1);
    hit.hp=Math.max(0,hit.hp-damage);
    AttackFX.feedback=hit.hp>0?'ПОПАДАНИЕ  −'+damage:'ЗОМБИ УНИЧТОЖЕН';
    if(hit.hp===0){
      state.wave.kills++;state.kills=(state.kills||0)+1;
      state.scrap=(state.scrap||0)+1+(hit.kind===2?2:0);
      if(typeof write==='function')write('Убит '+ZOMBIE_STATS[hit.kind].name+'. Добыт металлолом.');
    }
  }else AttackFX.feedback='ПРОМАХ';
  AttackFX.feedbackAt=ms;
  if(zombieAlive(state)===0)finishZombieWave(state);
  else if(typeof render==='function')render();
  return true;
}
function autoDefendZombieWave(state){
  if(!state.wave)return false;
  const foes=zombieAlive(state),shots=Math.min(state.ammo,Math.max(1,Math.ceil(foes*.8)));
  state.ammo-=shots;
  const guards=state.wagons.includes('Охранный')?4:0;
  const power=(state.crew||0)+(state.gun||1)*3+(state.armor||0)*2+guards+shots*2;
  const residual=Math.max(1,foes*5-power+Math.floor(Math.random()*9));
  state.hp=Math.max(0,state.hp-residual);
  state.kills=(state.kills||0)+foes;
  if(typeof write==='function')write('Автооборона: ликвидировано '+foes+' зомби, потрачено '+shots+' патронов, урон '+residual+'.');
  if(typeof checkEnd==='function')checkEnd();
  if(!state.gameover)finishZombieWave(state);
  else if(typeof render==='function')render();
  return true;
}
function drawZombieWave(g,cam,state,ms){
  if(state.phase!=='raid'||state.gameover)return;
  ensureZombieWave(state);
  for(let i=state.wave.enemies.length-1;i>=0;i--){
    const e=state.wave.enemies[i];if(e.hp<=0)continue;
    const x=e.x-cam;if(x<-110||x>1090)continue;
    // Every variant has distinct hand-drawn anatomy and a moving silhouette.
    const scale=e.kind===2?.84:e.kind===1?.90:e.kind===4?.82:.88;
    drawVariantMutant(g,e.kind,x,e.ground,scale,ms,e.seed);
    const barw=e.kind===2?61:46;
    const top=e.ground-(e.kind===2?121:e.kind===4?120:108);
    trainRect(g,x-barw/2-2,top-2,barw+4,9,'#172225');
    trainRect(g,x-barw/2,top,barw,5,'#4a3430');
    trainRect(g,x-barw/2,top,barw*e.hp/e.maxHp,5,'#be8667');
    trainText(g,ZOMBIE_STATS[e.kind].name,x-barw/2,top-8,10,'#f4dfcb');
  }
  const alive=zombieAlive(state);
  trainRound(g,343,90,285,50,7,'rgba(54,29,26,.92)','#b17c67');
  trainText(g,'ЗОМБИ У ПОЕЗДА: '+alive,358,110,16,'#f0c4a2');
  trainText(g,'НАЖМИ НА ЗОМБИ, ЧТОБЫ СТРЕЛЯТЬ',356,129,11,'#fff0dc',600);
  if(AttackFX.shot&&ms-AttackFX.shot.time<200){
    const f=AttackFX.shot,alpha=1-(ms-f.time)/200;
    g.save();g.globalAlpha=alpha;
    trainLine(g,555,308,f.x,f.y,f.hit?'#f8dc9b':'#ddbb86',2.7);
    trainDisc(g,f.x,f.y,9,'rgba(255,225,165,.7)');
    g.restore();
  }
  if(ms-AttackFX.feedbackAt<1100){
    trainText(g,AttackFX.feedback,365,164,14,'#ffe0a4');
  }
  if(ms-AttackFX.hitFlash<260){
    trainRect(g,0,0,960,480,'rgba(217,55,37,.12)');
  }
}
