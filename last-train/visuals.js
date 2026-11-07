/* Последний поезд: детализированная и лёгкая Canvas-сцена без внешних библиотек. */
'use strict';
const TrainArt = {
  camera: 900, target: 900, drag: false, startX: 0, startCamera: 0,
  lastFrame: 0, startTime: performance.now(), prevPhase: null, prevCount: null,
  journey: null, worldDistance: 0, movingDistance: 0, wheelRotation: 0, travelSpeed: 0
};
// World scroll is continuous: scenery does not snap back at the next stop.
// Velocity follows a smooth acceleration / braking curve, zero at both ends.
function travelEase(p){return p - Math.sin(2*Math.PI*p)/(2*Math.PI)}
function startTrainJourney(duration,finish,route){
  if(TrainArt.journey?.active)return false;
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const distance=2300;
  const now=performance.now();
  TrainArt.journey={active:true,started:now,duration:reduced?300:duration,distance,progress:0,finish,
    from:route?.from, to:route?.to, startWorld:TrainArt.worldDistance};
  // Ease towards the engine instead of teleporting the camera when departure begins.
  TrainArt.target=trainCameraBounds({wagons:[],phase:'station'}).max;
  return true;
}
function updateTrainJourney(now){
  const j=TrainArt.journey;
  if(!j||!j.active)return;
  const p=Math.max(0,Math.min(1,(now-j.started)/j.duration));
  const d=j.distance*travelEase(p);
  TrainArt.movingDistance=d;
  TrainArt.travelSpeed=(1-Math.cos(2*Math.PI*p))*.5;
  TrainArt.wheelRotation=(TrainArt.worldDistance+d)/15;
  j.progress=p;
  if(p>=1){
    j.active=false;
    TrainArt.worldDistance+=j.distance;
    TrainArt.movingDistance=0;
    TrainArt.travelSpeed=0;
    const callback=j.finish;
    TrainArt.journey=null;
    if(typeof callback==='function')callback();
  }
}

const TRAIN_GAP = 274, ENGINE_X = 1500, TRAIN_Y = 348;
function trainRect(g,x,y,w,h,fill){g.fillStyle=fill;g.fillRect(x,y,w,h)}
function trainLine(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.lineWidth=width;g.strokeStyle=color;g.stroke()}
function trainPoly(g,points,fill,stroke=null,width=1){g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
function trainRound(g,x,y,w,h,r,color,stroke=null){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke()}}
function trainDisc(g,x,y,r,color){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=color;g.fill()}
function trainText(g,text,x,y,size=13,color='#eee7d3',weight=700){g.font=weight+' '+size+'px system-ui, sans-serif';g.fillStyle=color;g.fillText(text,x,y)}
function trainGradient(g,x,y,w,h,colors){const a=g.createLinearGradient(x,y,x,y+h);for(let i=0;i<colors.length;i++)a.addColorStop(i/(colors.length-1),colors[i]);return a}
function trainSeed(n){const z=Math.sin(n*127.1+91.7)*43758.5453;return z-Math.floor(z)}
function trainWindow(g,x,y,w,h,lit=false){
  trainRound(g,x-3,y-3,w+6,h+6,3,'#202c30','#67767a');
  trainRect(g,x,y,w,h,trainGradient(g,x,y,w,h,lit?['#d7af68','#9a784d','#3c4642']:['#75949c','#3b6067','#243b43']));
  trainLine(g,x+w*.45,y,x+w*.45,y+h,'#2a3638',2);
  trainLine(g,x+3,y+h-4,x+w-3,y+3,'#b7d2c9',1);
  trainRect(g,x,y+h-2,w,2,'#263234');
}
function trainWheel(g,x,y,r){
  trainDisc(g,x,y+2,r+3,'#161c1f');
  trainDisc(g,x,y,r,'#2c3132');
  trainDisc(g,x,y,r-4,'#68716c');
  trainDisc(g,x,y,r-7,'#22292b');
  trainDisc(g,x,y,5,'#b0a18c');
  for(let j=0;j<6;j++){const a=Math.PI*j/3+TrainArt.wheelRotation;trainLine(g,x+Math.cos(a)*7,y+Math.sin(a)*7,x+Math.cos(a)*(r-6),y+Math.sin(a)*(r-6),'#7c827b',2)}
}
function trainBogie(g,x){
  trainRound(g,x+17,366,85,13,4,'#222b2c','#53605c');
  trainLine(g,x+28,371,x+90,371,'#87837a',2);
  trainWheel(g,x+31,392,15);trainWheel(g,x+86,392,15);
  trainLine(g,x+50,380,x+69,380,'#7a7971',3);
}
function trainUnderframe(g,x){
  trainRect(g,x-1,349,257,12,'#232c2e');
  trainLine(g,x+4,355,x+250,355,'#a59578',2);
  trainRect(g,x+14,360,24,8,'#394142');
  trainRect(g,x+211,360,27,8,'#394142');
  trainBogie(g,x+2);trainBogie(g,x+146);
  trainRect(g,x+251,356,17,7,'#252c2c');trainDisc(g,x+268,359,5,'#96918a');
}
function trainScratches(g,x,y,w,h,seed){
  for(let i=0;i<9;i++){
    const a=trainSeed(seed*31+i*23);const b=trainSeed(seed*67+i*13);
    const px=x+12+a*(w-24),py=y+12+b*(h-24);
    trainLine(g,px,py,px+2+a*11,py-1,'#c1b69a',.55);
  }
  trainRect(g,x+8,y+h-9,w-16,2,'#151e22');
}
function trainWagon(g,name,index,x,state,t){
  const y=236,w=254,h=112;
  const is = v=>name===v;
  const color=is('Тендер')?['#695944','#4c4d44','#353b3b']:
              is('Пассажирский')?['#7a7659','#5b654e','#343f3b']:
              is('Жилой')?['#6b7770','#465954','#293d3e']:
              is('Склад')?['#7b614e','#64513f','#3c3b34']:
              is('Кухня')?['#7d725c','#60584a','#3c423d']:
              is('Платформа')?['#525854','#383e3c','#283332']:
              is('Ферма')?['#6a8069','#466b61','#294e48']:
              is('Медпункт')?['#7d8580','#63716a','#394b4b']:
              is('Мастерская')?['#7d6756','#625144','#353c3a']:
              ['#6b7061','#4a5c50','#2e3b3c'];
  trainUnderframe(g,x);
  if(is('Платформа')){
    trainRect(g,x+2,320,249,28,'#636651');
    trainRect(g,x+7,319,238,8,'#9c8e6f');
    for(let i=0;i<4;i++){const bx=x+17+i*52;trainRect(g,bx,287+(i%2)*10,44,32,'#7b6549');trainLine(g,bx+4,294,bx+36,313,'#b69b71',2);trainLine(g,bx+36,294,bx+4,313,'#b69b71',2)}
    trainLine(g,x+5,281,x+5,319,'#a0a39a',3);trainLine(g,x+249,281,x+249,319,'#a0a39a',3);
    trainText(g,'ГРУЗОВАЯ ПЛАТФОРМА',x+34,346,10,'#e5cda4');
    drawPlatformCrew(g,x,state,index,t);
    return;
  }
  if(is('Тендер')){
    trainRound(g,x+6,267,243,77,17,'#3e4642','#a28b6c');
    const tanker=trainGradient(g,x+10,269,232,73,['#9f8769','#756951','#514c44','#393d3e']);
    trainRound(g,x+12,271,230,66,29,tanker,'#383d3a');
    for(let k=0;k<5;k++)trainRect(g,x+23+k*44,267,5,72,'#4d514c');
    trainRect(g,x+101,257,48,12,'#343c3c');
    trainDisc(g,x+125,262,5,'#aa946d');
    trainText(g,'DIESEL  •  16 000 L',x+49,311,12,'#cfc4a2');
    trainRect(g,x+17,311,17,5,'#ccab58');
    trainRect(g,x+221,311,17,5,'#ccab58');
    return;
  }
  if(is('Ферма')){
    trainRect(g,x+8,296,239,48,color[1]);
    trainPoly(g,[[x+10,288],[x+39,239],[x+215,239],[x+244,288]],'#3d6256','#91aaa0',3);
    trainRect(g,x+13,288,230,31,'#425e59');
    for(let i=0;i<8;i++){trainLine(g,x+24+i*29,247,x+24+i*29,319,'#9ab2a4',2);const xx=x+20+i*28;trainLine(g,xx,304,xx,279,'#6c9d55',2);trainDisc(g,xx-4,289,5,'#73ab65');trainDisc(g,xx+5,283,5,'#91b47a')}
    trainRect(g,x+12,317,232,25,'#3e5550');trainText(g,'GREENHOUSE / ТЕПЛИЦА',x+30,335,11,'#d9e9c8');
    drawFarmCrew(g,x,state,index,t);
    return;
  }
  trainRound(g,x+4,y,w-8,h,6,trainGradient(g,x,y,w,h,color),'#1d2928');
  trainRect(g,x+9,226,w-18,10,'#272f30');
  trainRect(g,x+15,223,w-30,3,'#9d9686');
  trainLine(g,x+10,254,x+w-11,254,'#b0a48a',1);
  for(let j=0;j<9;j++){const px=x+14+j*27;trainLine(g,px,337,px,342,'#222b2c',1)}
  if(is('Склад')){
    for(let j=0;j<13;j++)trainLine(g,x+17+j*17,260,x+17+j*17,331,'#292f2d',2);
    trainRound(g,x+67,269,111,61,2,'#51534c','#a19984');
    trainLine(g,x+122,269,x+122,330,'#a39a83',3);
    trainText(g,'МАТЕРИАЛЫ',x+69,291,12,'#e2d5b3');
    trainText(g,'CARGO 07',x+69,308,10,'#a9b8a9');
    drawDoorCrew(g,x,state,index,t);
  }else if(is('Мастерская')){
    trainWindow(g,x+28,264,47,36,true);
    const workshopCrew=(TrainArt.crewAssignments||{})[index]||[];
    if(workshopCrew[0])drawCrewInWindow(g,x+28,264,47,36,workshopCrew[0].role,workshopCrew[0].seed,t);
    trainRound(g,x+92,261,71,75,4,'#424947','#9c9783');
    for(let k=0;k<5;k++)trainLine(g,x+101+k*12,266,x+101+k*12,331,'#2b3635',2);
    trainWindow(g,x+189,264,34,34,false);
    if(workshopCrew[1])drawCrewInWindow(g,x+189,264,34,34,workshopCrew[1].role,workshopCrew[1].seed,t);
    trainText(g,'WORKSHOP',x+28,329,13,'#e1c99e');
    trainRect(g,x+199,213,11,13,'#3c4543');
  }else{
    const isMed=is('Медпункт');
    const isKitchen=is('Кухня');
    const slots=isKitchen?3:4;
    const interiorCrew=(TrainArt.crewAssignments||{})[index]||[];
    for(let k=0;k<slots;k++){
      const wx=x+19+k*(isKitchen?67:54);
      trainWindow(g,wx,265,isKitchen?43:38,36,(k+index)%3===0||isKitchen);
      if(interiorCrew[k] && !(is('Охранный') && k===0))drawCrewInWindow(g,wx,265,isKitchen?43:38,36,interiorCrew[k].role,interiorCrew[k].seed,t);
      if(!isMed&&k===1)trainLine(g,wx+10,284,wx+28,274,'#afc5bb',1);
    }
    if(isMed){trainRound(g,x+197,265,36,40,3,'#e5dfc6');trainRect(g,x+210,270,10,31,'#a74d48');trainRect(g,x+200,280,30,10,'#a74d48')}
    else{trainRect(g,x+219,266,22,79,'#303f40');trainRect(g,x+222,278,15,17,'#688787');trainDisc(g,x+234,307,2,'#e1dbb8')}
    if(isKitchen){trainRect(g,x+196,205,14,23,'#343e3f');for(let i=0;i<3;i++){const a=i*11+t*.015;trainDisc(g,x+203+Math.sin(a)*7,200-i*11,6+i*2,'rgba(205,207,184,.13)')}}
    if(is('Охранный')){
      trainRect(g,x+90,211,78,18,'#353b3a');
      trainPoly(g,[[x+109,199],[x+146,199],[x+164,212],[x+94,212]],'#59665e');
      trainRect(g,x+139,204,77,5,'#272e2e');
      trainText(g,'СТРАЖА',x+22,332,11,'#e1c49b');
      if(interiorCrew[0])drawTrainPerson(g,x+127,210,.84,interiorCrew[0].role,interiorCrew[0].seed,t);
    }else trainText(g,is('Медпункт')?'МЕДИЦИНСКИЙ':isKitchen?'ВАГОН-КУХНЯ':is('Жилой')?'ЖИЛОЙ ВАГОН':is('Пассажирский')?'ПАССАЖИРСКИЙ':name.toUpperCase(),x+18,331,11,'#e7dec0');
  }
  trainScratches(g,x+5,y,w-10,h,index+5);
  trainText(g,'№ '+String(index+1).padStart(2,'0'),x+17,245,9,'#ecdfc6',500);
  trainLine(g,x+18,345,x+235,345,'#b6a27e',2);
}
function trainEngine(g,x,t,state){
  trainUnderframe(g,x);
  trainRect(g,x+7,329,240,20,'#354748');
  const hood=trainGradient(g,x,269,172,75,['#718078','#52675f','#384e50','#273d40']);
  trainPoly(g,[[x+7,278],[x+20,264],[x+172,264],[x+178,339],[x+7,339]],hood,'#253433',2);
  trainLine(g,x+20,280,x+167,280,'#a0a58a',2);
  for(let k=0;k<15;k++){const xx=x+28+k*9;trainLine(g,xx,289,xx,315,'#26383a',2)}
  trainRect(g,x+18,319,155,8,'#29393b');
  for(let k=0;k<3;k++){trainRect(g,x+32+k*18,321,11,3,'#e7a65a')}
  trainPoly(g,[[x+165,229],[x+226,229],[x+247,259],[x+247,337],[x+170,337]],trainGradient(g,x+170,230,75,106,['#778984','#506c6c','#334b4d']),'#1b2e32',2);
  trainPoly(g,[[x+175,241],[x+221,241],[x+235,257],[x+235,283],[x+175,283]],'#263b41','#9daaa2',2);
  trainPoly(g,[[x+180,245],[x+196,245],[x+196,278],[x+180,278]],'#68949b');
  trainPoly(g,[[x+200,245],[x+217,245],[x+230,259],[x+230,278],[x+200,278]],'#7da4a6');
  const engineer=(TrainArt.crewAssignments||{})[0]||[];
  if(engineer[0])drawCrewInWindow(g,x+201,246,28,31,engineer[0].role,engineer[0].seed,t);
  trainLine(g,x+198,242,x+198,283,'#1b2f33',4);
  trainLine(g,x+183,278,x+194,250,'#d8d6b9',1);
  trainDisc(g,x+233,304,7,'#d2bb80');
  const glow=g.createRadialGradient(x+248,304,2,x+248,304,64);glow.addColorStop(0,'rgba(255,229,164,.48)');glow.addColorStop(1,'rgba(255,229,164,0)');g.fillStyle=glow;g.fillRect(x+208,260,110,91);
  trainRect(g,x+243,321,12,21,'#263b3c');
  for(let i=0;i<4;i++)trainPoly(g,[[x+247,325+i*5],[x+255,325+i*5],[x+255,328+i*5],[x+247,329+i*5]],'#c19a57');
  trainRect(g,x+22,255,23,8,'#353f3e');trainRect(g,x+29,239,8,16,'#293536');
  for(let i=0;i<(TrainArt.journey?.active?9:5);i++){
    const speed=TrainArt.travelSpeed;
    const drift=(t*.025*(.2+speed)+i*19)%140;
    const xx=x+35-drift;
    const yy=225-i*9-((t*.009+i*13)%26);
    trainDisc(g,xx,yy,8+i*.75,'rgba(183,185,174,'+(0.10+speed*.11)+')');
  }
  trainRect(g,x+167,211,77,14,'#2c3435');
  trainRect(g,x+177,205,52,6,'#73807a');
  trainLine(g,x+165,312,x+247,312,'#a4a38c',2);
  trainLine(g,x+173,332,x+244,332,'#1e292a',4);
  trainText(g,'ТЭМ2 • 404',x+35,332,14,'#ddc89b');
  trainText(g,'ЖЕЛЕЗНАЯ ДОРОГА',x+168,297,9,'#d8d9c4',500);
  trainLine(g,x+6,344,x+254,344,'#e3b567',3);
  trainLine(g,x+250,342,x+250,358,'#a19b80',3);
}
function drawStationBackdrop(g,s,t,screenX=744,type=s.stationType){
 // Every location has a fixed world coordinate. Only the camera moves.
 if(screenX < -260 || screenX > 1100)return;
 g.save();g.translate(screenX-744,0);
 const k=(Number.isInteger(type)?type:0)%6;
 const x=744,y=339;
 // Distinct world geometry for every type of stopping place.
 if(k===0){
   for(let i=0;i<3;i++){
     const xx=x-15+i*65;
     trainRect(g,xx,278-(i%2)*15,45,60+(i%2)*15,'#59605a');
     trainDisc(g,xx+22,278-(i%2)*15,22,'#64695e');
     trainRect(g,xx+3,308,39,22,'#46534c');
     trainLine(g,xx+45,315,xx+63,315,'#948977',4);
     trainRect(g,xx+8,295,6,5,'#a58d6c');
   }
   trainRect(g,773,321,119,9,'#876f53');
   trainText(g,'ТОПЛИВНОЕ ДЕПО',778,315,10,'#eee0bf');
 }else if(k===1){
   trainRect(g,x+5,225,158,116,'#7a7d72');
   trainRect(g,x+60,208,49,17,'#666e68');
   for(let a=0;a<4;a++)for(let b=0;b<3;b++){
     trainRect(g,x+18+a*34,239+b*25,20,15,(a+b)%2?'#2d484a':'#3e5859');
     trainLine(g,x+18+a*34,246+b*25,x+37+a*34,246+b*25,'#afb5a5',1);
   }
   trainRect(g,x+70,231,30,28,'#e4dcc4');
   trainRect(g,x+83,234,6,23,'#a9504c');
   trainRect(g,x+73,242,24,6,'#a9504c');
   trainText(g,'ГОСПИТАЛЬ',x+26,332,11,'#f1ead5');
 }else if(k===2){
   for(let i=0;i<3;i++){
     const xx=x-10+i*72,hh=49+i%2*16;
     trainRect(g,xx,339-hh,61,hh,'#77765f');
     trainPoly(g,[[xx-7,339-hh],[xx+29,315-hh],[xx+69,339-hh]],'#51544a');
     trainRect(g,xx+25,339-hh+15,17,19,'#333e3d');
     trainRect(g,xx+5,339-hh+14,13,12,'#c0a174');
     trainRect(g,xx+49,315-hh,6,18,'#484d47');
   }
 }else if(k===3){
   trainRect(g,x-6,255,189,83,'#505c59');
   trainPoly(g,[[x-12,255],[x+24,243],[x+53,255],[x+90,240],[x+123,255],[x+183,246],[x+186,255]],'#68736e');
   trainRect(g,x+13,198,26,58,'#665f51');
   trainRect(g,x+124,181,32,74,'#686255');
   trainRect(g,x+12,215,27,8,'#9e8d73');
   trainRect(g,x+123,213,34,8,'#b19c78');
   for(let j=0;j<3;j++){
     const dx=Math.sin(t*.0006+j)*8;
     trainDisc(g,x+27+dx+j*13,174-j*23,9+j*4,'rgba(185,179,158,.13)');
     trainDisc(g,x+137-dx+j*12,158-j*25,11+j*5,'rgba(185,179,158,.11)');
   }
   for(let j=0;j<8;j++)trainRect(g,x+7+j*22,280,11,14,'#283c3f');
 }else if(k===4){
   trainRect(g,x+6,315,196,22,'#596054');
   for(let j=0;j<13;j++)trainRound(g,x+5+j*15,322-(j%2)*10,24,13,5,'#8b8065');
   trainRect(g,x+128,230,8,89,'#555f53');
   trainRect(g,x+178,230,8,89,'#555f53');
   trainRect(g,x+120,220,74,16,'#55594a');
   trainPoly(g,[[x+116,220],[x+150,203],[x+196,220]],'#39423b');
   trainRect(g,x+138,240,29,23,'#273b3f');
   trainLine(g,x+134,260,x+176,260,'#b6a67f',2);
   trainRect(g,x+30,302,70,8,'#333e3b');
 }else{
   trainRect(g,x-9,296,152,43,'#596761');
   trainRect(g,x+2,287,131,10,'#7f8372');
   for(let j=0;j<5;j++)trainRect(g,x+11+j*25,310,15,13,'#2b4549');
   trainLine(g,x+150,171,x+150,335,'#8e9287',4);
   trainLine(g,x+108,316,x+150,171,'#77867c',2);
   trainLine(g,x+193,316,x+150,171,'#77867c',2);
   trainLine(g,x+120,258,x+181,258,'#889487',2);
   trainLine(g,x+130,225,x+172,225,'#889487',2);
   trainLine(g,x+150,192,x+175,192,'#b2aa8f',2);
   for(let i=1;i<=2;i++){
     g.beginPath();g.arc(x+150,214,15*i,-.8,.8);
     g.strokeStyle='rgba(199,200,175,.5)';g.lineWidth=2;g.stroke();
   }
 }
 g.restore();
}

// Continuous 1D value noise is sampled in world coordinates. No random screen tiles.
function worldNoise(x,seed){
 const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);
 return trainSeed(i+seed)*(1-u)+trainSeed(i+1+seed)*u;
}
function terrainHeight(x,seed){
 return worldNoise(x*.0023,seed)*.6+
        worldNoise(x*.006,seed+140)*.3+
        worldNoise(x*.016,seed+310)*.1;
}
function terrainBand(g,world,baseline,amp,seed,color){
 g.beginPath();g.moveTo(-20,baseline+110);
 for(let x=-20;x<=1000;x+=16){
   const worldX=(x+world);
   g.lineTo(x,baseline-amp*(.3+terrainHeight(worldX,seed)));
 }
 g.lineTo(1000,baseline+110);g.closePath();
 g.fillStyle=color;g.fill();
}
function worldItems(g,world,spacing,leftCount,seed,draw){
 const first=Math.floor(world/spacing)-2;
 const end=first+Math.ceil(960/spacing)+leftCount;
 for(let i=first;i<=end;i++){
  const jitter=trainSeed(i*13+seed)*spacing*.58;
  const x=i*spacing+jitter-world;
  if(x < -180 || x > 1100)continue;
  draw(x,i,trainSeed(i*7+seed+17));
 }
}
function renderWorldStation(g,s,t,world,destination){
 // The start location exits left while the destination approaches from the right.
 // World positions are spaced by exactly 1100 logical pixels per journey.
 const leg=1100;
 const departAnchor=Math.floor((world+.001)/leg)*leg;
 const currentType=Number.isInteger(s.stationType)?s.stationType:0;
 const approaching=TrainArt.journey?.active;
 const nearX=744+(departAnchor-world)*1.14;
 drawStationBackdrop(g,s,t,nearX,currentType);
 if(approaching){
   const nextX=744+(departAnchor+leg-world)*1.14;
   const nextType=Number.isInteger(TrainArt.journey.destinationType)?TrainArt.journey.destinationType:(currentType+1)%6;
   drawStationBackdrop(g,s,t,nextX,nextType);
 }
 if(!approaching){
  const platformX=nearX-612;
  trainRect(g,platformX,341,254,11,'#64675b');
  trainRect(g,platformX+24,290,9,52,'#464a44');
  trainRound(g,platformX+8,280,142,22,3,'#4c5550');
  const station=typeof STATION_TYPES!=='undefined'?(STATION_TYPES[currentType]||STATION_TYPES[0]).name:'СТАНЦИЯ';
  trainText(g,station.slice(0,18).toUpperCase(),platformX+14,295,11,'#ead7b3');
 }
}
function trainLandscape(g,t,cam,s){drawContinuousWorld(g,t,cam,s)}

function trainAttack(g,cam,s,t){
  drawZombieWave(g,cam,s,t);
}

function trainOverlay(g,s,cam){
  trainRound(g,16,14,265,67,8,'rgba(17,28,31,.86)','#728078');
  trainText(g,'ПОСЛЕДНИЙ ПОЕЗД',29,42,19,'#e6c89b');
  trainText(g,'День '+s.day+'    •    '+s.distance+' км',29,65,13,'#b9c3b6',500);
  trainRound(g,694,14,250,60,8,'rgba(18,29,32,.82)','#526c68');
  trainText(g,'СОСТАВ: '+s.wagons.length+' ВАГОНОВ',707,35,12,'#d6c79d');
  const dots=Math.min(s.wagons.length,18),width=Math.min(214,dots*13);
  for(let i=0;i<dots;i++){
    const x=705+i*(width/dots);
    trainRect(g,x,45,Math.max(6,width/dots-3),15,i===0?'#b79363':'#708d86');
    trainRect(g,x+1,57,5,2,'#283735');
  }
  trainRound(g,14,442,325,26,5,'rgba(15,26,27,.78)');
  trainText(g,s.phase==='raid'?'🎯 Целься по зомби и стреляй нажатием':'⇆ Тяни мышью или кнопками • осмотр состава',25,460,11,'#c5cabe',500);
  const journey=TrainArt.journey;
  if(journey?.active){
    trainRound(g,344,83,273,64,9,'rgba(23,37,39,.9)','#8b9a81');
    trainText(g,'ПОЕЗД В ПУТИ',383,108,17,'#efcf9c');
    trainText(g,'Скорость  '+Math.round(76*TrainArt.travelSpeed)+' км/ч',384,128,12,'#b3cec0',500);
    trainRect(g,360,136,242,5,'#293e3f');
    trainRect(g,360,136,242*journey.progress,5,'#d4a56d');
  }
  // Combat HUD is rendered by drawZombieWave; do not cover its aim instruction.
  if(s.gameover){trainRect(g,0,0,960,480,'rgba(8,15,17,.79)');trainText(g,'ПОЕЗД ПОТЕРЯН',312,226,36,'#f1b1a2');trainText(g,'Начните новую экспедицию',347,264,17,'#e1dfd2',500)}
}
function trainCameraBounds(state){
  const max=ENGINE_X-(state.phase==='raid'?300:540);
  return {min:Math.min(max,ENGINE_X-Math.max(0,state.wagons.length-1)*TRAIN_GAP-60),max};
}
function trainClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function drawTrainScene(g,state,canvas,ms=performance.now()){
  const bounds=trainCameraBounds(state);
  TrainArt.target=trainClamp(TrainArt.target,bounds.min,bounds.max);
  TrainArt.camera+=(TrainArt.target-TrainArt.camera)*.15;
  g.clearRect(0,0,canvas.width,canvas.height);
  trainLandscape(g,ms,TrainArt.camera,state);
  // Even between combat encounters, infected silhouettes are visible beyond the rails.
  if(state.phase==='station'&&!TrainArt.journey?.active&&!state.gameover){
    drawVariantMutant(g,(state.day+2)%6,852+Math.sin(ms*.0009)*15,344,.39,ms,13+state.day);
    drawVariantMutant(g,(state.day+4)%6,925+Math.sin(ms*.0011)*11,347,.31,ms,29+state.day);
    trainText(g,'ЗАРАЖЁННЫЕ ВДАЛИ',755,260,12,'#ded6bf');
  }
  TrainArt.crewAssignments=assignTrainCrew(state);
  const speed=TrainArt.travelSpeed;
  const bump=TrainArt.journey?.active?Math.sin(ms*.07)*speed*1.65:0;
  // Engine briefly pulls ahead while the camera follows, without sliding backward in world space.
  const cameraLag=TrainArt.journey?.active?Math.sin(Math.PI*TrainArt.journey.progress)*65:0;
  g.save();
  g.translate(cameraLag,bump);
  for(let i=state.wagons.length-1;i>=0;i--){
    const x=ENGINE_X-i*TRAIN_GAP-TrainArt.camera;
    if(x<-280||x>980)continue;
    if(i===0)trainEngine(g,x,ms,state);
    else trainWagon(g,state.wagons[i],i,x,state,ms);
  }
  g.restore();
  if(TrainArt.journey?.active){
    // Dust streaks follow the track backwards; the train is moving right.
    const travel=TrainArt.worldDistance+TrainArt.movingDistance;
    for(let i=0;i<18;i++){
      const phase=(i*83-travel*1.6)%1100;
      const x=(phase+1100)%1100-80;
      const y=401+(i%4)*11;
      trainLine(g,x,y,x-10-speed*22,y,'rgba(213,201,163,'+(speed*.17)+')',1+(i%2));
    }
  }
  drawContinuousForeground(g,ms,TrainArt.camera);
  trainAttack(g,TrainArt.camera,state,ms);
  trainOverlay(g,state,TrainArt.camera);
}
function panTrain(dir,getState){
  if(getState().phase==='raid')return;
  const bounds=trainCameraBounds(getState());
  TrainArt.target=trainClamp(TrainArt.target+dir*500,bounds.min,bounds.max);
}
function startTrainView(canvas,getState){
  const restored=getState();
  const pos=Number(restored.worldPosition);
  TrainArt.worldDistance=Number.isFinite(pos)&&pos>=0?pos:Math.max(0,Number(restored.distance)||0)*130;
  TrainArt.movingDistance=0;
  TrainArt.wheelRotation=TrainArt.worldDistance/15;

  TrainArt.camera=trainCameraBounds(getState()).max;
  TrainArt.target=TrainArt.camera;
  const left=document.getElementById('trainTail');
  const right=document.getElementById('trainFront');
  if(left)left.onclick=()=>panTrain(-1,getState);
  if(right)right.onclick=()=>panTrain(1,getState);
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.pointerType==='mouse')return;
    const state=getState();
    if(state.phase==='raid'&&!state.gameover){
      const bounds=canvas.getBoundingClientRect();
      const px=(event.clientX-bounds.left)*canvas.width/bounds.width;
      const py=(event.clientY-bounds.top)*canvas.height/bounds.height;
      aimZombieOnCanvas(state,px,py);
      return;
    }
    TrainArt.drag=true;TrainArt.startX=event.clientX;TrainArt.startCamera=TrainArt.target;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!TrainArt.drag)return;
    const scale=canvas.width/canvas.getBoundingClientRect().width;
    const bounds=trainCameraBounds(getState());
    TrainArt.target=trainClamp(TrainArt.startCamera+(TrainArt.startX-event.clientX)*scale,bounds.min,bounds.max);
  });
  canvas.addEventListener('pointerup',()=>TrainArt.drag=false);
  canvas.addEventListener('pointercancel',()=>TrainArt.drag=false);
  window.addEventListener('keydown',event=>{
    if(event.target.matches('input,textarea,[contenteditable]'))return;
    if(getState().phase==='raid')return;
    if(event.code==='ArrowLeft'){event.preventDefault();panTrain(-1,getState)}
    if(event.code==='ArrowRight'){event.preventDefault();panTrain(1,getState)}
  });
  function frame(ms){
    if(ms-TrainArt.lastFrame>32){
      TrainArt.lastFrame=ms;
      updateTrainJourney(ms);
      const state=getState();
      if(!document.hidden)updateZombieWave(state,ms);
      if(state.phase==='raid'&&TrainArt.prevPhase!=='raid')TrainArt.target=trainCameraBounds(state).max;
      if(state.wagons.length!==TrainArt.prevCount){
        const bounds=trainCameraBounds(state);
        TrainArt.target=trainClamp(TrainArt.target,bounds.min,bounds.max);
      }
      TrainArt.prevPhase=state.phase;TrainArt.prevCount=state.wagons.length;
      if(!document.hidden)drawTrainScene(canvas.getContext('2d'),state,canvas,ms);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
