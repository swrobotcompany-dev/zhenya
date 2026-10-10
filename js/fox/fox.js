// Лисёнок: построение модели и указывающей стрелки
/* ---------- ЛИСЁНОК ---------- */
const fox={group:new THREE.Group(),legs:[],tailSegs:[],arrow:null,arrowYaw:0,t:0,blinkT:3,glanceT:2,glanceYaw:0,headYaw:0,amp:0,twitchT:4,nose:null,body:null,head:null,tail:null,earL:null,earR:null,eyeL:null,eyeR:null};
function buildFox(){
  const fur=new THREE.MeshStandardMaterial({color:0xd8793c,roughness:.8});
  const furDark=new THREE.MeshStandardMaterial({color:0xb05a28,roughness:.8});
  const cream=new THREE.MeshStandardMaterial({color:0xf7ecd9,roughness:.8});
  const dark=new THREE.MeshStandardMaterial({color:0x3a2418,roughness:.7});
  const M=function(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;(parent||fox.group).add(m);return m;};

  fox.body=new THREE.Group();fox.body.position.set(0,.42,0);fox.group.add(fox.body);
  const torso=M(new THREE.SphereGeometry(1,22,16),fur,0,0,0,fox.body);torso.scale.set(.23,.215,.38);
  const chest=M(new THREE.SphereGeometry(1,16,12),fur,0,.03,.2,fox.body);chest.scale.set(.185,.165,.19);
  const bib=M(new THREE.SphereGeometry(1,14,10),cream,0,-.06,.265,fox.body);bib.scale.set(.12,.115,.13);
  const hL=M(new THREE.SphereGeometry(.105,12,10),furDark,-.145,-.03,-.2,fox.body);
  const hR=hL.clone();hR.position.x=.145;fox.body.add(hR);

  fox.head=new THREE.Group();fox.head.position.set(0,.64,.30);fox.group.add(fox.head);
  const skull=M(new THREE.SphereGeometry(.175,22,18),fur,0,0,0,fox.head);skull.scale.set(1,.96,.95);
  const chL=M(new THREE.SphereGeometry(.07,12,10),cream,-.115,-.045,.045,fox.head);chL.scale.set(.8,1,1.05);
  const chR=chL.clone();chR.position.x=.115;fox.head.add(chR);
  const snout=M(new THREE.SphereGeometry(.075,14,10),cream,0,-.055,.135,fox.head);snout.scale.set(1,.8,1.7);
  fox.nose=M(new THREE.SphereGeometry(.022,8,8),dark,0,-.04,.245,fox.head);
  const mkEar=function(sx){const e=new THREE.Group();e.position.set(sx*.095,.195,-.015);
    e.rotation.set(-.12,0,sx*-.28);fox.head.add(e);
    const o=M(new THREE.ConeGeometry(.075,.26,6),fur,0,.13,0,e);o.scale.set(1,1,.55);
    const inn=M(new THREE.ConeGeometry(.045,.17,6),dark,0,.115,.028,e);inn.scale.set(1,1,.5);return e;};
  fox.earL=mkEar(-1);fox.earR=mkEar(1);
  const eyeMat=new THREE.MeshStandardMaterial({color:0x241410,roughness:.12,metalness:.2});
  fox.eyeL=M(new THREE.SphereGeometry(.047,12,10),eyeMat,-.082,.03,.115,fox.head);
  fox.eyeR=M(new THREE.SphereGeometry(.047,12,10),eyeMat,.082,.03,.115,fox.head);
  const glint=new THREE.MeshBasicMaterial({color:0xffffff});
  M(new THREE.SphereGeometry(.015,6,6),glint,-.095,.055,.152,fox.head);
  M(new THREE.SphereGeometry(.015,6,6),glint,.068,.055,.152,fox.head);
  const amber=new THREE.MeshStandardMaterial({color:0xffa040,emissive:0x804810,emissiveIntensity:.9,roughness:.4});
  M(new THREE.SphereGeometry(.018,8,6),amber,-.082,.002,.15,fox.head);
  M(new THREE.SphereGeometry(.018,8,6),amber,.082,.002,.15,fox.head);

  const legGeo=new THREE.CylinderGeometry(.033,.027,.24,8);legGeo.translate(0,-.12,0);
  const pawGeo=new THREE.SphereGeometry(.05,10,8);pawGeo.scale(1,.65,1.25);pawGeo.translate(0,-.25,.02);
  const legDefs=[[-.10,.19,true],[.10,.19,true],[-.115,-.20,false],[.115,-.20,false]];
  for(let i=0;i<4;i++){
    const x=legDefs[i][0],z=legDefs[i][1],isF=legDefs[i][2];
    const p=new THREE.Group();p.position.set(x,.40,z);fox.group.add(p);
    if(!isF)M(new THREE.SphereGeometry(.075,10,8),furDark,0,-.02,0,p);
    M(legGeo,furDark,0,0,0,p);M(pawGeo,dark,0,0,0,p);
    fox.legs.push({p:p,off:i*Math.PI/2+(i>1?Math.PI:0)});}

  fox.tail=new THREE.Group();fox.tail.position.set(0,.46,-.24);fox.group.add(fox.tail);
  { let par=fox.tail;const radii=[.10,.125,.135,.125,.10,.07,.045];
    for(let i=0;i<7;i++){
      const g=new THREE.Group();
      g.position.set(0,(i===0?.02:.05),(i===0?-.04:-.062));
      g.rotation.x=.13;g.userData.base=.13;
      const s=new THREE.Mesh(new THREE.SphereGeometry(radii[i],14,12),(i>=5)?cream:fur);
      s.position.set(0,.015,-.028);s.scale.set(.92,1,1.05);s.castShadow=true;g.add(s);
      par.add(g);par=g;fox.tailSegs.push(g);}}

  fox.group.scale.setScalar(2.3);
  scene.add(fox.group);
  const foxLight=new THREE.PointLight(0xfff0d8,.5,8);foxLight.position.set(0,1.2,0);fox.group.add(foxLight);
}
/* стрелка-указатель над лисёнком */
function buildArrow(){
  fox.arrow=new THREE.Group();
  const cone=new THREE.Mesh(new THREE.ConeGeometry(.09,.3,6),new THREE.MeshBasicMaterial({color:W.fruit}));
  cone.rotation.x=Math.PI/2;
  fox.arrow.add(cone);
  const ring=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xffffff}));
  fox.arrow.add(ring);
  fox.arrow.position.set(0,1.1,0);
  fox.group.add(fox.arrow);
}
