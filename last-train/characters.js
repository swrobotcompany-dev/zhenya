/* Survivors and six visibly distinct hand-drawn mutant anatomies. No sprite assets or dependencies. */
'use strict';
const MUTANT_KIND = ['Шатун','Ползун','Громила','Прыгун','Спороносец','Двуглавый'];
function castPalette(seed){
 const skin=['#d0a17e','#b58b71','#bd9f83','#9b7d67','#cba88c'];
 const cloth=['#778681','#a48a6d','#657b85','#898170','#677d6c'];
 return {skin:skin[seed%skin.length],cloth:cloth[seed%cloth.length],dark:'#273535'};
}
function assignTrainCrew(state){
 const byWagon={};let left=Math.max(0,Math.floor(state.crew||0));
 const candidates=[];
 const ranks=[['Локомотив',['driver']],['Жилой',['resident','resident','resident']],['Пассажирский',['scout','resident','resident']],
 ['Кухня',['cook','resident']],['Платформа',['worker','guard']],['Ферма',['farmer','worker']],
 ['Медпункт',['medic','resident']],['Мастерская',['mechanic','worker']],['Охранный',['guard','guard']],
 ['Склад',['worker']],['Тендер',[]]];
 // Round-robin by role instead of duplicating the population in every window.
 for(let pass=0;pass<3;pass++){
   for(const [name,roles] of ranks){
     if(pass>=roles.length)continue;
     const index=state.wagons.indexOf(name);
     if(index<0)continue;
     // The driver's first slot is always reserved at the front.
     candidates.push({index,role:roles[pass],seed:index*11+pass*7,slot:pass});
   }
 }
 for(const person of candidates){
   if(left<=0)break;
   if(!byWagon[person.index])byWagon[person.index]=[];
   byWagon[person.index].push(person);left--;
 }
 return byWagon;
}
function handPath(g,points,color,width){
 g.beginPath();g.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);
 g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.stroke();
}
function crewBody(g,role,seed,t){
 const c=castPalette(seed),phase=Math.sin(t*.002+seed*2.3);
 const isDriver=role==='driver',isGuard=role==='guard',isMedic=role==='medic';
 const isCook=role==='cook',isMechanic=role==='mechanic'||role==='worker';
 const shirt=isMedic?'#d6d5c6':isGuard?'#515b50':isDriver?'#505e69':isCook?'#b6aa88':c.cloth;
 const skin=c.skin;
 // Person is 22px wide and 46px tall with boots at y=0.
 trainPoly(g,[[-7,-19],[7,-19],[8,-2],[2,-1],[-7,-2]],'#3b4341');
 handPath(g,[[-4,-3],[-4,-1]],'#242b2b',5);handPath(g,[[5,-3],[5,-1]],'#242b2b',5);
 trainPoly(g,[[-9,-34],[4,-35],[10,-26],[8,-18],[-8,-18],[-10,-27]],shirt,'#2b3937');
 trainLine(g,-8,-21,8,-21,'#d1ba8d',1);
 trainLine(g,0,-34,0,-20,'rgba(23,31,30,.4)',1.4);
 handPath(g,[[-8,-31],[-14-phase*1.7,-20],[-12-phase,-11]],shirt,5);
 handPath(g,[[6,-30],[13+phase*2,-22],[12+phase*2,-11]],shirt,5);
 trainDisc(g,-12-phase,-10,2.7,skin);trainDisc(g,12+phase*2,-10,2.7,skin);
 trainRect(g,-3,-37,5,5,skin);
 trainDisc(g,0,-43,8,skin);
 trainPoly(g,[[-8,-46],[-6,-52],[4,-52],[8,-47],[4,-48],[1,-46],[-6,-46]],'#3c3831');
 if(isDriver||isGuard||isMechanic){
   trainPoly(g,[[-9,-50],[-3,-55],[5,-55],[9,-51],[9,-47],[-9,-47]],isGuard?'#415146':'#43494b');
   trainRect(g,-10,-49,18,3,'#2c3838');
 }else if(isCook){
   trainRect(g,-6,-57,13,9,'#ddd6c2');
   trainRound(g,-8,-53,17,4,2,'#e3dbc5');
 }else if(isMedic){
   trainRect(g,-1,-34,3,11,'#aa584b');trainRect(g,-5,-31,12,3,'#aa584b');
 }
 trainDisc(g,-3,-43,1,'#242b2b');trainDisc(g,4,-43,1,'#242b2b');
 trainLine(g,-3,-38,3,-38,'#745f53',1);
 if(isMechanic){trainLine(g,10,-14,14,-6,'#7e9494',2);trainDisc(g,14,-5,3,'#adb7ab')}
 if(isGuard){trainLine(g,10,-19,22,-27,'#242f2e',4);trainLine(g,12,-26,26,-26,'#8d8570',2)}
 if(role==='farmer'){trainLine(g,10,-18,17,-29,'#857653',2);trainDisc(g,18,-30,4,'#6d9666')}
 if(role==='scout'){trainLine(g,-8,-30,-3,-20,'#4c473d',3)}
}
function drawTrainPerson(g,x,feetY,scale,role,seed,t){
 g.save();g.translate(x,feetY+Math.sin(t*.0016+seed)*.75);g.scale(scale,scale);
 crewBody(g,role,seed,t);g.restore();
}
function drawCrewInWindow(g,x,y,w,h,role,seed,t){
 g.save();g.beginPath();g.rect(x+1,y+1,w-2,h-2);g.clip();
 // Lit interior and a non-static person visible behind slightly reflective glass.
 trainRect(g,x,y,w,h,'rgba(24,28,30,.19)');
 const px=x+w*.49,feet=y+h+11;
 drawTrainPerson(g,px,feet,.78,role,seed,t);
 trainRect(g,x,y,w,h,'rgba(97,149,145,.12)');
 trainLine(g,x+w*.65,y,x+w*.25,y+h,'rgba(245,247,219,.16)',2);
 g.restore();
}
function drawPlatformCrew(g,x,state,index,t){
 const people=(TrainArt.crewAssignments||{})[index]||[];
 for(let i=0;i<people.length;i++){
   const p=people[i];drawTrainPerson(g,x+101+i*67,320,.91,p.role,p.seed,t);
 }
}
function drawFarmCrew(g,x,state,index,t){
 const people=(TrainArt.crewAssignments||{})[index]||[];
 for(let i=0;i<people.length;i++){
   g.save();g.beginPath();g.rect(x+16,242,220,78);g.clip();
   drawTrainPerson(g,x+116+i*47,323,1.08,people[i].role,people[i].seed,t);
   g.restore();
 }
}
function drawDoorCrew(g,x,state,index,t){
 const people=(TrainArt.crewAssignments||{})[index]||[];
 for(let i=0;i<people.length;i++){
   drawCrewInWindow(g,x+74+i*42,268,39,51,people[i].role,people[i].seed,t);
 }
}
function mutantShape(g,points,fill,outline='#202c2d',width=2){trainPoly(g,points,fill,outline,width)}
function mutantBone(g,points,width=7){handPath(g,points,'#3b4841',width+3);handPath(g,points,'#788474',width)}
function mutantClaws(g,x,y,dir=1,len=8){
 for(let j=-1;j<=1;j++)trainLine(g,x,y,x+dir*(len+(j===0?4:0)),y+j*4,'#b0a58b',1.7);
}
function mutantScars(g,x,y,w,h,seed){
 for(let j=0;j<5;j++){
   const sx=x+trainSeed(seed+j*17)*w,sy=y+trainSeed(seed*2+j*29)*h;
   trainLine(g,sx,sy,sx+6+trainSeed(seed+j)*4,sy-2,'rgba(197,178,139,.45)',1);
 }
}
function mutantShambler(g,phase,seed){
 // Asymmetric, emaciated, hunched infected human: dangling arm, torn jacket, protruding ribs.
 mutantBone(g,[[-6,-44],[-12+phase*5,-18],[-16+phase*7,-2]],9);
 mutantBone(g,[[6,-43],[13-phase*5,-23],[11-phase*6,-1]],8);
 mutantShape(g,[[-19,-70],[-11,-84],[0,-79],[10,-67],[11,-45],[-9,-44]],'#677466');
 mutantShape(g,[[-11,-61],[1,-57],[3,-43],[-9,-43]],'#444f48');
 for(let j=0;j<4;j++)trainLine(g,-6,-67+j*5,5,-62+j*5,'#a3a692',2);
 mutantBone(g,[[-13,-72],[-24,-54],[-21+phase*6,-31]],6);
 mutantBone(g,[[9,-69],[22,-48],[25-phase*7,-20]],6);
 mutantClaws(g,-21+phase*6,-31,-1,11);mutantClaws(g,25-phase*7,-20,1,10);
 mutantShape(g,[[-6,-88],[4,-94],[15,-88],[9,-75],[-1,-73]],'#879386');
 trainPoly(g,[[0,-93],[10,-94],[15,-88],[4,-89]],'#4b5650');
 trainDisc(g,7,-84,2.6,'#d5b276');
 mutantScars(g,-15,-80,25,29,seed);
}
function mutantCrawler(g,phase,seed){
 // A four-legged, ribbed creature that moves close to the ground.
 const crouch=Math.sin(phase)*3;
 mutantBone(g,[[-25,-29],[-52,-15+crouch],[-57,-2]],7);
 mutantBone(g,[[-8,-29],[-32,-10-crouch],[-37,-2]],6);
 mutantBone(g,[[26,-30],[46,-12+crouch],[55,-1]],7);
 mutantBone(g,[[36,-22],[60,-18-crouch],[71,-3]],5);
 mutantClaws(g,71,-3,1,7);mutantClaws(g,-57,-2,-1,7);
 mutantShape(g,[[-34,-29],[-23,-45],[7,-48],[26,-36],[39,-25],[18,-17],[-16,-19]],'#5c6b5f');
 for(let i=0;i<5;i++)trainLine(g,-17+i*9,-42,-22+i*9,-24,'#b1a994',2);
 mutantShape(g,[[31,-41],[46,-46],[57,-33],[53,-22],[39,-20],[31,-30]],'#788474');
 mutantShape(g,[[47,-28],[60,-23],[53,-16],[38,-20]],'#b6afa0');
 trainDisc(g,49,-35,3,'#c7b179');
 for(let i=0;i<4;i++)trainDisc(g,-20+i*12,-46-i%2*4,2,'#af9f81');
 mutantScars(g,-30,-35,50,17,seed);
}
function mutantBrute(g,phase,seed){
 // Hunched, broad hulking giant with armor-like bone plates and thick swinging fists.
 mutantBone(g,[[-13,-50],[-24+phase*3,-20],[-22+phase*6,-1]],15);
 mutantBone(g,[[18,-54],[21-phase*3,-20],[28-phase*4,-2]],16);
 mutantShape(g,[[-40,-99],[-19,-118],[1,-115],[30,-104],[43,-72],[34,-50],[-31,-48],[-45,-69]],'#586658');
 mutantShape(g,[[-36,-97],[-18,-105],[-17,-90],[-28,-80]],'#a7a18a');
 mutantShape(g,[[16,-107],[28,-102],[39,-86],[21,-89]],'#a39e88');
 mutantBone(g,[[-34,-95],[-49,-66],[-52+phase*5,-35]],16);
 mutantBone(g,[[29,-93],[48,-68],[52-phase*5,-39]],20);
 mutantShape(g,[[-62+phase*5,-45],[-40+phase*5,-45],[-35+phase*5,-20],[-60+phase*5,-25]],'#48574c');
 mutantShape(g,[[41-phase*5,-45],[63-phase*5,-46],[66-phase*5,-20],[42-phase*5,-23]],'#4b594f');
 mutantClaws(g,-52+phase*5,-23,-1,7);mutantClaws(g,50-phase*5,-22,1,8);
 mutantShape(g,[[-11,-109],[2,-117],[15,-109],[10,-94],[-6,-92]],'#859181');
 trainDisc(g,0,-106,3,'#d2b177');trainDisc(g,8,-106,2,'#d2b177');
 for(let i=0;i<5;i++)trainLine(g,-21+i*10,-87,-18+i*10,-61,'#a1a993',2);
 mutantScars(g,-38,-105,75,48,seed);
}
function mutantLeaper(g,phase,seed){
 // Reverse-jointed hopping predator, elongated legs, tiny pointed skull.
 const rise=Math.abs(Math.sin(phase))*11;
 mutantBone(g,[[-5,-47-rise],[-23,-29-rise],[-10+phase*2,-11],[0,-1]],6);
 mutantBone(g,[[12,-50-rise],[28,-23-rise],[11-phase*2,-9],[23,-1]],7);
 mutantClaws(g,0,-1,1,10);mutantClaws(g,23,-1,1,12);
 mutantShape(g,[[-10,-81-rise],[-4,-99-rise],[14,-96-rise],[22,-66-rise],[9,-45-rise],[-2,-47-rise]],'#65766a');
 for(let i=0;i<4;i++)trainLine(g,1,-87-rise+i*7,10,-83-rise+i*7,'#a4ab99',1.6);
 mutantBone(g,[[-6,-86-rise],[-22,-69-rise],[-37,-47-rise]],5);
 mutantBone(g,[[20,-85-rise],[32,-61-rise],[42,-47-rise]],5);
 mutantClaws(g,-37,-47-rise,-1,13);mutantClaws(g,42,-47-rise,1,12);
 mutantShape(g,[[1,-101-rise],[13,-110-rise],[24,-105-rise],[31,-96-rise],[16,-94-rise]],'#7d8c7b');
 trainPoly(g,[[21,-99-rise],[41,-96-rise],[30,-89-rise]],'#b9aa8a');
 trainDisc(g,22,-104-rise,2.6,'#d7ab74');
 mutantScars(g,-4,-94-rise,22,42,seed);
}
function mutantSpore(g,phase,seed){
 // Top-heavy fungal host with lumpy translucent caps, growths, filaments and asymmetry.
 mutantBone(g,[[-15,-33],[-15-phase*3,-12],[-24,-2]],9);
 mutantBone(g,[[13,-34],[16+phase*3,-15],[26,-2]],8);
 mutantShape(g,[[-18,-50],[-36,-71],[-21,-91],[8,-91],[29,-72],[27,-39],[6,-32]],'#576657');
 mutantShape(g,[[-26,-95],[-33,-115],[-16,-132],[4,-127],[13,-104]],'#8e9277');
 mutantShape(g,[[3,-104],[9,-121],[28,-127],[39,-112],[32,-92],[17,-88]],'#6e816d');
 for(let j=0;j<5;j++){
  const xx=-22+j*12;trainDisc(g,xx,-107+Math.sin(j)*8,6+(j%3)*2,j%2?'#acaa7f':'#819274');
  trainDisc(g,xx-2,-110+Math.sin(j)*8,2,'#d8c28d');
 }
 mutantShape(g,[[0,-94],[11,-98],[17,-86],[11,-77],[-2,-79]],'#798372');
 trainDisc(g,8,-88,2.5,'#e2c48e');
 mutantBone(g,[[-20,-64],[-30,-42],[-34-phase*3,-22]],5);
 mutantBone(g,[[27,-58],[37,-36],[36+phase*4,-20]],6);
 for(let i=0;i<5;i++)handPath(g,[[-24+i*14,-82],[ -29+i*14+Math.sin(phase+i)*4,-60]],'#a9a684',2);
 for(let i=0;i<6;i++){const xx=-30+i*14,yy=-123+(i%3)*13;trainDisc(g,xx+Math.sin(phase+i)*5,yy+Math.cos(phase+i)*7,1.5,'rgba(222,205,144,.65)')}
}
function mutantTwin(g,phase,seed){
 // Twisted fused host: two separate heads, split shoulders, three arms.
 mutantBone(g,[[-16,-39],[-26-phase*3,-17],[-17,-2]],10);
 mutantBone(g,[[19,-41],[28+phase*3,-18],[20,-2]],10);
 mutantShape(g,[[-20,-76],[-38,-89],[-27,-102],[-4,-99],[17,-109],[38,-96],[26,-70],[23,-44],[-15,-44]],'#657164');
 mutantShape(g,[[-26,-95],[-13,-111],[1,-108],[8,-93],[0,-83]],'#858c77');
 mutantShape(g,[[7,-102],[20,-119],[36,-108],[33,-92],[17,-87]],'#7b8b7a');
 mutantDiscEye(g,-12,-100);mutantDiscEye(g,23,-108);
 mutantBone(g,[[-34,-88],[-50,-62],[-47+phase*5,-38]],8);
 mutantBone(g,[[30,-91],[48,-64],[50-phase*5,-37]],7);
 mutantBone(g,[[4,-80],[10,-62],[6+phase*4,-36]],6);
 mutantClaws(g,-47+phase*5,-38,-1,11);mutantClaws(g,50-phase*5,-37,1,11);
 mutantClaws(g,6+phase*4,-36,1,6);
 for(let k=0;k<4;k++)trainLine(g,-8+k*7,-70,-4+k*7,-53,'#b1ad93',2);
 mutantScars(g,-28,-95,61,40,seed);
}
function mutantDiscEye(g,x,y){trainDisc(g,x,y,3,'#cfb782');trainDisc(g,x,y,.8,'#1e2421')}
function drawVariantMutant(g,type,x,ground,scale,t,seed){
 const phase=Math.sin(t*.003+seed*1.72);
 g.save();g.translate(x,ground);
 trainDisc(g,0,1,1,'rgba(0,0,0,0)');
 g.scale(scale,scale);
 // Contact shadow and fine airborne dust around moving feet.
 g.fillStyle='rgba(12,19,18,.43)';g.beginPath();g.ellipse(0,0,type===1?57:34,6,0,0,Math.PI*2);g.fill();
 if(type===0)mutantShambler(g,phase,seed);
 else if(type===1)mutantCrawler(g,phase,seed);
 else if(type===2)mutantBrute(g,phase,seed);
 else if(type===3)mutantLeaper(g,phase,seed);
 else if(type===4)mutantSpore(g,phase,seed);
 else mutantTwin(g,phase,seed);
 g.restore();
}
function drawMutantHorde(g,cam,state,t){
 if(state.phase!=='raid'||state.gameover)return;
 const count=Math.min(state.attack,8);
 // Their own profile, anatomy, scale, stride and silhouette differ across six variants.
 for(let i=count-1;i>=0;i--){
   const kind=(i+state.day)%MUTANT_KIND.length;
   const scale=kind===2?.78:kind===1?.9:kind===4?.74:kind===3?.83:.8;
   const seed=i*7+state.day*3;
   const x=ENGINE_X+260+i*70-cam+Math.sin(t*.0018+seed)*4;
   if(x<-130||x>1100)continue;
   const ground=424+(i%3)*7;
   drawVariantMutant(g,kind,x,ground,scale,t,seed);
 }
}
