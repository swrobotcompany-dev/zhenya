/* Continuous railroad world. Geometry is generated from persistent WORLD positions, not tiled screens. */
'use strict';
const WORLD_VIEW_WIDTH=960;
const WORLD_BASE_CAMERA=960;
const WORLD_STATION_ANCHOR=744;
function worldRand(index,salt=0){
  let n=(Math.imul(index|0,374761393)+Math.imul((salt+47)|0,668265263))|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function worldOffset(factor,cam){
  return (TrainArt.worldDistance+TrainArt.movingDistance)*factor+(cam-WORLD_BASE_CAMERA)*factor;
}
function worldVisibleIndices(offset,step,padding=2){
  const first=Math.floor(offset/step)-padding;
  const count=Math.ceil(WORLD_VIEW_WIDTH/step)+padding*2+2;
  return [first,count];
}
function worldClouds(g,offset,time){
  const shift=offset*.018+time*.003;
  const [first,count]=worldVisibleIndices(shift,270,2);
  for(let k=0;k<count;k++){
    const i=first+k,seed=worldRand(i,30);
    const x=i*270-shift+65*seed,y=74+worldRand(i,31)*100;
    const w=83+seed*78;
    g.fillStyle='rgba(222,207,188,.08)';
    g.beginPath();g.ellipse(x,y,w,13+seed*10,0,0,Math.PI*2);g.fill();
    g.beginPath();g.ellipse(x+20,y-7,w*.56,12+seed*9,0,0,Math.PI*2);g.fill();
  }
}
function worldMountains(g,offset,base,step,size,color,seedOffset){
  const [first,count]=worldVisibleIndices(offset,step,3);
  g.beginPath();g.moveTo(-150,base+80);
  for(let k=0;k<=count;k++){
    const i=first+k;
    const x=i*step-offset;
    const h=(.5+worldRand(i,seedOffset)*.9)*size;
    // Midpoint between neighboring samples connects smooth hills without tile seams.
    const nextH=(.5+worldRand(i+1,seedOffset)*.9)*size;
    g.lineTo(x,base-h);
    g.quadraticCurveTo(x+step*.4,base-h,x+step*.5,base-(h+nextH)*.5);
  }
  g.lineTo(1110,base+100);g.closePath();
  g.fillStyle=color;g.fill();
}
function worldRuin(g,index,x,y){
  const kind=Math.floor(worldRand(index,10)*5);
  const height=58+worldRand(index,11)*94, width=48+worldRand(index,12)*76;
  const ground=y;
  const base='#2b4044',shade='#3b4c4d',detail='#6d726a';
  if(kind===0||kind===3){
    // Irregular apartments and collapsed blocks.
    trainPoly(g,[[x,ground],[x,ground-height+13],[x+width*.23,ground-height-8],
      [x+width*.52,ground-height+11],[x+width*.7,ground-height-17],[x+width,ground-height+6],[x+width,ground]],base);
    trainLine(g,x+width*.2,ground-height+9,x+width*.2,ground-6,detail,1);
    for(let row=0;row<5;row++)for(let col=0;col<3;col++){
      const wx=x+10+col*(width-14)/3,wy=ground-height+25+row*18;
      if(wy<ground-10&&worldRand(index*19+row*11+col,3)>.32){
        trainRect(g,wx,wy,7,9,worldRand(index*17+row*7+col,8)>.86?'#a48a6b':'#1c3539');
      }
    }
  }else if(kind===1){
    // Factory halls / chimney stacks.
    trainRect(g,x,ground-height*.57,width, height*.57,shade);
    trainPoly(g,[[x,ground-height*.57],[x+width*.18,ground-height*.75],
      [x+width*.42,ground-height*.57],[x+width*.66,ground-height*.7],
      [x+width*.88,ground-height*.57],[x+width,ground-height*.57]],base);
    trainRect(g,x+width*.14,ground-height,12,height*.46,'#53605d');
    trainRect(g,x+width*.14,ground-height+8,12,3,'#867c69');
    for(let n=0;n<4;n++)trainRect(g,x+9+n*17,ground-28,10,17,'#24373a');
  }else if(kind===2){
    // Water tower, railway crane, or broken silo.
    trainLine(g,x+width*.26,ground,x+width*.38,ground-height*.75,shade,5);
    trainLine(g,x+width*.76,ground,x+width*.65,ground-height*.75,shade,5);
    trainLine(g,x+width*.26,ground-18,x+width*.75,ground-height*.5,detail,2);
    trainRound(g,x+width*.20,ground-height,width*.61,height*.26,9,'#435658','#747b71');
    trainRect(g,x+width*.3,ground-height-5,width*.4,5,'#4c5d5a');
  }else{
    // Roofless ruin with collapsed side and fragments.
    trainPoly(g,[[x,ground],[x,ground-height*.72],[x+width*.24,ground-height*.72],
      [x+width*.37,ground-height*.51],[x+width*.62,ground-height*.65],
      [x+width*.73,ground-height*.31],[x+width,ground-height*.29],[x+width,ground]],'#33474a');
    for(let i=0;i<3;i++)trainRect(g,x+9+i*23,ground-42,12,20,'#253539');
    trainPoly(g,[[x+width*.76,ground-6],[x+width+12,ground],[x+width-4,ground-23]],'#4b5751');
  }
}
function worldCity(g,offset){
  const width=198;
  const [first,count]=worldVisibleIndices(offset,width,2);
  for(let k=0;k<count;k++){
    const i=first+k,seed=worldRand(i,20);
    if(seed<.12)continue;
    const x=i*width-offset+seed*52;
    worldRuin(g,i,x,343);
  }
}
function worldTree(g,index,x,base,large=false){
  const h=(large?83:54)+worldRand(index,4)*(large?62:47);
  const lean=worldRand(index,5)*18-9,thick=large?6:4;
  const color=large?'#283b3b':'#364a49';
  trainLine(g,x,base,x+lean,base-h,color,thick);
  const limbCount=large?5:3;
  for(let j=0;j<limbCount;j++){
    const fraction=.38+j*(.53/limbCount);
    const by=base-h*fraction;
    const bx=x+lean*fraction;
    const direction=(j%2===0?-1:1);
    const span=16+worldRand(index*7+j,9)*27;
    trainLine(g,bx,by,bx+direction*span,by-15-j*2,color,Math.max(1,thick-j*.8));
    trainLine(g,bx+direction*span,by-15-j*2,bx+direction*(span+8),by-27-j*2,color,1.6);
  }
  if(worldRand(index,13)>.8&&large){
    // A few still have dead, brown clusters, never bright green umbrellas.
    trainDisc(g,x+lean*.85,base-h*.84,14,'rgba(59,71,63,.55)');
  }
}
function worldForest(g,offset,large=false){
  const step=large?154:89,salt=large?19:21;
  const [first,count]=worldVisibleIndices(offset,step,2);
  for(let k=0;k<count;k++){
    const i=first+k,random=worldRand(i,salt);
    if(random<(large?.25:.35))continue;
    const x=i*step-offset+random*38,base=large?353:360;
    worldTree(g,i,x,base,large);
  }
}
function worldPower(g,offset){
  const step=310;
  const [first,count]=worldVisibleIndices(offset,step,2);
  for(let k=0;k<count;k++){
    const i=first+k;
    if(worldRand(i,35)<.15)continue;
    const x=i*step-offset;
    // Wire spans are absolute world positions; no sudden cable reset on wraps.
    trainLine(g,x+25,348,x+25,236,'#344748',5);
    trainLine(g,x+3,255,x+52,255,'#455552',4);
    trainLine(g,x+12,249,x+12,269,'#56645d',2);
    trainLine(g,x+40,249,x+40,269,'#56645d',2);
    trainDisc(g,x+12,255,3,'#858b7e');trainDisc(g,x+40,255,3,'#858b7e');
    g.beginPath();g.moveTo(x+40,255);
    g.quadraticCurveTo(x+step*.5,276,x+step+12,255);
    g.strokeStyle='rgba(77,87,84,.64)';g.lineWidth=1.8;g.stroke();
    g.beginPath();g.moveTo(x+12,262);
    g.quadraticCurveTo(x+step*.5,285,x+step-16,262);
    g.strokeStyle='rgba(77,87,84,.37)';g.lineWidth=1;g.stroke();
  }
}
function worldGround(g,offset){
  trainRect(g,0,351,960,129,trainGradient(g,0,352,960,128,['#4b544e','#303a37','#222a2c']));
  const [first,count]=worldVisibleIndices(offset,31,3);
  for(let k=0;k<count;k++){
    const i=first+k,x=i*31-offset,y=360+worldRand(i,55)*110;
    const variety=worldRand(i,56);
    if(variety>.48){
      trainLine(g,x,y,x+4+variety*9,y-2,'rgba(170,159,127,.23)',1);
      trainLine(g,x+4,y,x+3,y-3,'rgba(124,145,113,.22)',1);
    }else{
      trainDisc(g,x,y,1.1+variety*3,'rgba(143,135,113,.2)');
    }
  }
  // Same world coordinate system controls ties, ballast and passing stones.
  const tiesOffset=offset*1.0;
  const [firstTie,tieCount]=worldVisibleIndices(tiesOffset,34,2);
  for(let k=0;k<tieCount;k++){
    const i=firstTie+k,x=i*34-tiesOffset;
    trainPoly(g,[[x,403],[x+18,403],[x+31,463],[x+5,463]],'#514b3f');
    trainLine(g,x+4,406,x+24,456,'#827364',1);
    trainDisc(g,x+8,408,1.5,'#a79a7f');
    trainDisc(g,x+25,454,1.5,'#a79a7f');
  }
  trainRect(g,0,401,960,8,'#212a2b');
  trainLine(g,0,403,960,403,'#a0a5a0',2.5);
  trainLine(g,0,407,960,407,'rgba(201,191,170,.23)',1);
  trainRect(g,0,450,960,8,'#1d2629');
  trainLine(g,0,451,960,451,'#959d99',2.5);
  trainLine(g,0,455,960,455,'rgba(204,199,182,.2)',1);
}
function worldWeather(g,offset,time){
  // Dust particles have stable world anchors; they do not teleport back at x=960.
  const shift=offset*.78;
  const [first,count]=worldVisibleIndices(shift,43,2);
  for(let k=0;k<count;k++){
    const i=first+k,random=worldRand(i,60);
    const x=i*43-shift+random*20;
    const y=348+worldRand(i,61)*55;
    trainDisc(g,x+Math.sin(time*.0008+i)*2,y,random>.85?1.6:.8,'rgba(198,187,155,.17)');
  }
}
function worldStop(g,type,x,t,caption){
  if(x<-270||x>1020)return;
  g.save();
  g.translate(x-WORLD_STATION_ANCHOR,0);
  // Re-use each station's detailed building drawing, but keep it attached to a world coordinate.
  // No frame-dependent switch or station sprites appearing instantaneously.
  drawStationBackdropAt(g,type,t);
  g.restore();
}
function drawStationBackdropAt(g,type,t){
 const fake={stationType:type};
 // drawStationBackdrop previously lived at a screen position. It is now pure geometry:
 const old=TrainArt.journey;
 try{TrainArt.journey=null;drawStationBackdrop(g,fake,t)}
 finally{TrainArt.journey=old}
 // Visible platform belongs to the same station transform.
 trainRect(g,706,344,236,10,'#555d56');
 trainRect(g,710,292,8,52,'#44514b');
 trainRound(g,698,279,115,23,2,'#4a554e');
 const types=typeof STATION_TYPES==='undefined'?null:STATION_TYPES;
 const station=types?types[type]||types[0]:null;
 trainText(g,(station?station.name:'СТАНЦИЯ').slice(0,16).toUpperCase(),704,294,11,'#e6d2a8');
 trainRect(g,919,331,36,14,'#6d6957');
}
function worldStops(g,cam,state,time){
 const cameraPan=cam-WORLD_BASE_CAMERA;
 const journey=TrainArt.journey;
 if(!journey||!journey.active){
   const type=Number.isInteger(state.stationType)?state.stationType:0;
   worldStop(g,type,WORLD_STATION_ANCHOR-cameraPan,time,'stop');
   return;
 }
 // Departing and arriving stops are physically distinct places on the same continuous track.
 const moved=TrainArt.movingDistance;
 const from=Number.isInteger(journey.from)?journey.from:state.stationType;
 const to=Number.isInteger(journey.to)?journey.to:(from+1)%6;
 worldStop(g,from,WORLD_STATION_ANCHOR-moved-cameraPan,time,'departure');
 worldStop(g,to,WORLD_STATION_ANCHOR+journey.distance-moved-cameraPan,time,'arrival');
}
function drawContinuousWorld(g,t,cam,s){
 const travelled=TrainArt.worldDistance+TrainArt.movingDistance;
 const sky=trainGradient(g,0,0,960,480,['#141f2d','#344550','#777a78','#aa947b','#495751']);
 trainRect(g,0,0,960,480,sky);
 const halo=g.createRadialGradient(755,113,4,755,113,240);
 halo.addColorStop(0,'rgba(239,197,130,.35)');halo.addColorStop(.6,'rgba(215,163,116,.10)');halo.addColorStop(1,'rgba(190,145,112,0)');
 trainRect(g,0,0,960,350,halo);
 trainDisc(g,751,115,32,'#dcc29d');
 worldClouds(g,worldOffset(.014,cam),t);
 worldMountains(g,worldOffset(.05,cam),291,178,81,'#506367',5);
 worldMountains(g,worldOffset(.12,cam),321,129,64,'#3b5256',6);
 worldCity(g,worldOffset(.39,cam));
 worldForest(g,worldOffset(.60,cam),false);
 worldPower(g,worldOffset(.88,cam));
 worldForest(g,worldOffset(.91,cam),true);
 worldStops(g,cam,s,t);
 worldGround(g,worldOffset(1,cam));
 worldWeather(g,worldOffset(1,cam),t);
}
function drawContinuousForeground(g,t,cam){
 const offset=worldOffset(1.16,cam);
 const [first,count]=worldVisibleIndices(offset,73,2);
 for(let k=0;k<count;k++){
   const i=first+k,random=worldRand(i,91);
   if(random<.34)continue;
   const x=i*73-offset+random*16;
   const y=462+worldRand(i,92)*13;
   if(random>.84){
     trainDisc(g,x,y,4,'#4d5549');
     trainDisc(g,x+5,y+1,2,'#626959');
   }else{
     trainLine(g,x,y,x-3,y-9,'rgba(96,108,84,.47)',1.5);
     trainLine(g,x,y,x+3,y-6,'rgba(142,135,101,.4)',1.3);
   }
 }
}
