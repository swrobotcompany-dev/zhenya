/* Последний поезд: детализированная и лёгкая Canvas-сцена без внешних библиотек. */
'use strict';
const TrainArt = {
  camera: 900, target: 900, drag: false, startX: 0, startCamera: 0,
  lastFrame: 0, startTime: performance.now(), prevPhase: null, prevCount: null
};
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
  for(let j=0;j<6;j++){const a=Math.PI*j/3;trainLine(g,x+Math.cos(a)*7,y+Math.sin(a)*7,x+Math.cos(a)*(r-6),y+Math.sin(a)*(r-6),'#7c827b',2)}
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
  }else if(is('Мастерская')){
    trainWindow(g,x+28,264,47,36,true);
    trainRound(g,x+92,261,71,75,4,'#424947','#9c9783');
    for(let k=0;k<5;k++)trainLine(g,x+101+k*12,266,x+101+k*12,331,'#2b3635',2);
    trainWindow(g,x+189,264,34,34,false);
    trainText(g,'WORKSHOP',x+28,329,13,'#e1c99e');
    trainRect(g,x+199,213,11,13,'#3c4543');
  }else{
    const isMed=is('Медпункт');
    const isKitchen=is('Кухня');
    const slots=isKitchen?3:4;
    for(let k=0;k<slots;k++){
      const wx=x+19+k*(isKitchen?67:54);
      trainWindow(g,wx,265,isKitchen?43:38,36,(k+index)%3===0||isKitchen);
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
  trainLine(g,x+198,242,x+198,283,'#1b2f33',4);
  trainLine(g,x+183,278,x+194,250,'#d8d6b9',1);
  trainDisc(g,x+233,304,7,'#d2bb80');
  const glow=g.createRadialGradient(x+248,304,2,x+248,304,64);glow.addColorStop(0,'rgba(255,229,164,.48)');glow.addColorStop(1,'rgba(255,229,164,0)');g.fillStyle=glow;g.fillRect(x+208,260,110,91);
  trainRect(g,x+243,321,12,21,'#263b3c');
  for(let i=0;i<4;i++)trainPoly(g,[[x+247,325+i*5],[x+255,325+i*5],[x+255,328+i*5],[x+247,329+i*5]],'#c19a57');
  trainRect(g,x+22,255,23,8,'#353f3e');trainRect(g,x+29,239,8,16,'#293536');
  for(let i=0;i<5;i++){const xx=x+34+Math.sin(t*.0004+i)*6+i*6;const yy=222-i*12-Math.sin(t*.001+i)*4;trainDisc(g,xx,yy,9+i*3,'rgba(161,164,155,'+(0.17-i*.02)+')')}
  trainRect(g,x+167,211,77,14,'#2c3435');
  trainRect(g,x+177,205,52,6,'#73807a');
  trainLine(g,x+165,312,x+247,312,'#a4a38c',2);
  trainLine(g,x+173,332,x+244,332,'#1e292a',4);
  trainText(g,'ТЭМ2 • 404',x+35,332,14,'#ddc89b');
  trainText(g,'ЖЕЛЕЗНАЯ ДОРОГА',x+168,297,9,'#d8d9c4',500);
  trainLine(g,x+6,344,x+254,344,'#e3b567',3);
  trainLine(g,x+250,342,x+250,358,'#a19b80',3);
}
function trainLandscape(g,t,cam,s){
  const sky=trainGradient(g,0,0,960,480,['#111e2b','#344754','#8e8275','#b09674','#494f47']);
  trainRect(g,0,0,960,480,sky);
  let glow=g.createRadialGradient(743,116,3,743,116,230);
  glow.addColorStop(0,'rgba(248,198,129,.4)');glow.addColorStop(.5,'rgba(221,169,109,.14)');glow.addColorStop(1,'rgba(192,153,111,0)');
  trainRect(g,0,0,960,400,glow);trainDisc(g,746,123,34,'#d9b78e');
  for(let i=0;i<7;i++){
    const xx=((i*238-cam*.018+t*.0015)%1480+1480)%1480-270;
    g.fillStyle='rgba(204,199,177,.075)';
    g.beginPath();g.ellipse(xx,78+(i%3)*34,92+(i%4)*19,14+(i%3)*5,0,0,Math.PI*2);g.fill();
  }
  trainPoly(g,[[0,282],[100,220],[195,261],[309,195],[437,266],[582,210],[715,260],[845,181],[960,268],[960,370],[0,370]],'#465d60');
  trainPoly(g,[[0,320],[170,274],[301,302],[460,250],[570,299],[721,261],[879,284],[960,255],[960,390],[0,390]],'#344b50');
  const par=(cam*.10+s.distance*7)%132;
  for(let i=-2;i<12;i++){
    const n=i+6;const bx=i*132-par;
    const height=54+Math.floor(trainSeed(n+13)*97),wide=51+Math.floor(trainSeed(n+88)*48);
    trainRect(g,bx,344-height,wide,height,'#2e4245');
    trainPoly(g,[[bx-6,344-height+4],[bx+13,344-height-12],[bx+wide-10,344-height-5],[bx+wide+4,344-height+7]],'#304346');
    for(let c=0;c<4;c++)for(let r=0;r<5;r++)if(trainSeed(n*100+c*8+r*7)>.42){
      trainRect(g,bx+8+c*16,357-height+r*17,6,9,trainSeed(n*13+c+r)>.79?'#aa8661':'#203338');
    }
  }
  let p=(cam*.22)%186;
  for(let i=-2;i<8;i++){
    const x=i*186-p;trainLine(g,x+55,292,x+55,363,'#273b3e',5);
    trainLine(g,x+28,301,x+81,301,'#2e4245',4);
    trainDisc(g,x+29,301,4,'#4b5959');trainDisc(g,x+80,301,4,'#4b5959');
    trainLine(g,x+28,302,x+80,302,'#626760',1);
  }
  trainRect(g,0,351,960,129,trainGradient(g,0,352,960,128,['#505a4f','#323b39','#242b2c']));
  for(let i=0;i<45;i++){const px=(i*59+trainSeed(i)*47-cam*.42)%1060;const x=(px+1060)%1060-30;const y=364+trainSeed(i*5)*95;
    trainLine(g,x,y,x+3+trainSeed(i*3)*11,y-2,'rgba(169,167,135,.22)',1);
  }
  for(let i=-1;i<35;i++){
    const x=i*35-(cam*.48%35);
    trainPoly(g,[[x,408],[x+19,408],[x+32,463],[x+6,463]],'#564f42');
    trainLine(g,x+4,411,x+25,454,'#7e7060',1);
  }
  trainRect(g,0,401,960,7,'#232d2e');
  trainLine(g,0,403,960,403,'#a4a099',2);
  trainRect(g,0,450,960,7,'#212929');
  trainLine(g,0,452,960,452,'#7c8884',2);
  trainLine(g,0,413,960,413,'rgba(13,22,25,.48)',3);
  if(s.phase==='station'){
    const platformX=125-((cam*.14)%650);
    trainRect(g,platformX,343,240,11,'#555c56');
    trainRect(g,platformX+12,291,8,50,'#3a4441');
    trainRect(g,platformX+3,282,101,21,'#3b4744');
    trainText(g,'СТАНЦИЯ 07',platformX+12,296,12,'#e0c99c');
    trainRect(g,platformX+110,324,33,22,'#514e44');
  }
  for(let i=0;i<55;i++){
    const x=(i*139+trainSeed(i*31)*690+Math.sin(t*.0002+i)*18)%1010;
    const y=(i*41+trainSeed(i*17)*390+t*(i%2+1)*.004)%480;
    trainDisc(g,x,y,i%5===0?1.7:.7,'rgba(226,200,156,.17)');
  }
}
function trainAttack(g,cam,s,t){
  if(s.phase!=='raid'||s.gameover)return;
  const n=Math.min(s.attack,10);
  for(let i=0;i<n;i++){
    const x=ENGINE_X+286+i*29-cam+Math.sin(t*.003+i)*3;
    if(x<-40||x>1000)continue;
    const y=360+(i%3)*8;
    trainDisc(g,x,y-29,10,'#66735b');
    trainRect(g,x-8,y-21,16,27,'#4a5b4b');
    trainLine(g,x-6,y+5,x-12,y+26,'#35483f',4);
    trainLine(g,x+5,y+5,x+11,y+26,'#35483f',4);
    trainLine(g,x-7,y-15,x-18,y+1,'#687b5a',4);
    trainDisc(g,x+4,y-32,2,'#ed9864');
  }
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
  trainText(g,'⇆ Тяни мышью или кнопками • осмотр состава',25,460,11,'#c5cabe',500);
  if(s.phase==='raid'&&!s.gameover){trainRound(g,360,94,260,36,8,'rgba(96,38,35,.92)','#d69b73');trainText(g,'⚠ НАПАДЕНИЕ МУТАНТОВ',379,117,17,'#ffe1c2')}
  if(s.gameover){trainRect(g,0,0,960,480,'rgba(8,15,17,.79)');trainText(g,'ПОЕЗД ПОТЕРЯН',312,226,36,'#f1b1a2');trainText(g,'Начните новую экспедицию',347,264,17,'#e1dfd2',500)}
}
function trainCameraBounds(state){
  return {min:ENGINE_X-Math.max(0,state.wagons.length-1)*TRAIN_GAP-60,
          max:ENGINE_X-540};
}
function trainClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function drawTrainScene(g,state,canvas,ms=performance.now()){
  const bounds=trainCameraBounds(state);
  TrainArt.target=trainClamp(TrainArt.target,bounds.min,bounds.max);
  TrainArt.camera+=(TrainArt.target-TrainArt.camera)*.15;
  g.clearRect(0,0,canvas.width,canvas.height);
  trainLandscape(g,ms,TrainArt.camera,state);
  for(let i=state.wagons.length-1;i>=0;i--){
    const x=ENGINE_X-i*TRAIN_GAP-TrainArt.camera;
    if(x<-280||x>980)continue;
    if(i===0)trainEngine(g,x,ms,state);
    else trainWagon(g,state.wagons[i],i,x,state,ms);
  }
  trainAttack(g,TrainArt.camera,state,ms);
  trainOverlay(g,state,TrainArt.camera);
}
function panTrain(dir,getState){
  const bounds=trainCameraBounds(getState());
  TrainArt.target=trainClamp(TrainArt.target+dir*500,bounds.min,bounds.max);
}
function startTrainView(canvas,getState){
  TrainArt.camera=trainCameraBounds(getState()).max;
  TrainArt.target=TrainArt.camera;
  const left=document.getElementById('trainTail');
  const right=document.getElementById('trainFront');
  if(left)left.onclick=()=>panTrain(-1,getState);
  if(right)right.onclick=()=>panTrain(1,getState);
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.pointerType==='mouse')return;
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
    if(event.code==='ArrowLeft'){event.preventDefault();panTrain(-1,getState)}
    if(event.code==='ArrowRight'){event.preventDefault();panTrain(1,getState)}
  });
  function frame(ms){
    if(ms-TrainArt.lastFrame>32){
      TrainArt.lastFrame=ms;
      const state=getState();
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
