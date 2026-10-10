// Сущности: плоды с лучами, портал домой, дух тумана
/* ---------- ЯРКИЕ ПЛОДЫ с лучами света ---------- */
const fruitsArr=[];
function buildFruits(){
  const used=[];
  for(let i=0;i<CFG.goal;i++){
    let x,z,ok=false;
    while(!ok){const a=rnd(Math.PI*2),r=rnd(13,48);x=Math.cos(a)*r;z=Math.sin(a)*r;
      ok=used.every(function(u){return Math.hypot(u[0]-x,u[1]-z)>10;});}
    used.push([x,z]);
    const g=new THREE.Group();g.position.set(x,gH(x,z),z);g.rotation.y=rnd(6);
    const wmat=new THREE.MeshStandardMaterial({color:W.trunk,roughness:.9});
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,1.15,5),wmat);
    stem.position.y=.57;stem.rotation.z=rnd(-.2,.2);stem.castShadow=true;g.add(stem);
    const hang=new THREE.Group();hang.position.set(0,1.14,0);g.add(hang);
    const thread=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.22,4),wmat);thread.position.y=-.1;hang.add(thread);
    const f=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),
      new THREE.MeshStandardMaterial({color:W.fruit,emissive:W.fruitEm,emissiveIntensity:2.4,roughness:.25}));
    f.position.y=-.36;hang.add(f);
    const light=new THREE.PointLight(W.fruit,2.1,15);light.position.y=-.3;hang.add(light);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(W.halo[0],W.halo[1],W.halo[2],.7),transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.set(3.2,3.2,1);halo.position.y=-.36;hang.add(halo);
    // луч света в небо
    const beam=new THREE.Sprite(new THREE.SpriteMaterial({map:BEAMTEX,color:W.fruit,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    beam.center.set(.5,0);beam.position.set(0,1.2,0);beam.scale.set(1.6,13,1);g.add(beam);
    scene.add(g);
    fruitsArr.push({g:g,hang:hang,f:f,light:light,halo:halo,beam:beam,ph:rnd(9),alive:true});}
}

/* ---------- ПОРТАЛ ДОМОЙ ---------- */
const portal={group:null,ring:null,light:null,glow:null,beam:null,active:false};
function buildPortal(){
  const g=new THREE.Group();g.position.set(0,gH(0,0),0);
  const ringCol=new THREE.Color(W.fruit).lerp(new THREE.Color(0xffffff),.4);
  portal.ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.11,10,40),new THREE.MeshBasicMaterial({color:ringCol}));
  portal.ring.position.y=2;g.add(portal.ring);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.15,.05,8,36),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8}));
  ring2.position.y=2;g.add(ring2);portal.ring2=ring2;
  portal.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(W.halo[0],W.halo[1],W.halo[2],.8),transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
  portal.glow.scale.set(7,7,1);portal.glow.position.y=2;g.add(portal.glow);
  portal.beam=new THREE.Sprite(new THREE.SpriteMaterial({map:BEAMTEX,color:W.fruit,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  portal.beam.center.set(.5,0);portal.beam.position.y=.5;portal.beam.scale.set(3.4,30,1);g.add(portal.beam);
  portal.light=new THREE.PointLight(W.fruit,0,24);portal.light.position.y=2;g.add(portal.light);
  g.visible=false;scene.add(g);portal.group=g;
}
function openPortal(){
  portal.active=true;portal.group.visible=true;portal.light.intensity=2.6;
  burst(new THREE.Vector3(0,2.2,0),W.fruit,26,5,1);
  if(S)S.win();
  setGoal('Портал открыт! Бегите к свету в центре поляны ✦',true);
  setHint('Портал домой открыт — стрелка укажет путь!',6);
  spirit.enrage=12;
  if(spirit.state==='lurk'||spirit.state==='wait'||spirit.state==='off')spawnSpirit(true);
}

/* ---------- дух ---------- */
const spirit={group:new THREE.Group(),state:'off',target:new THREE.Vector3(),growlCd:2,reposT:0,enrage:0,lurkT:0,dieT:0,waitT:0,eyeLight:null};
function buildSpirit(){
  const bm=new THREE.MeshBasicMaterial({color:W.spirit,transparent:true,opacity:.92});
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,14,12),bm);body.scale.set(.6,.5,1.05);body.position.y=.6;spirit.group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),bm);head.position.set(0,.85,1.0);spirit.group.add(head);
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(.7,1.1,8),bm);skirt.position.y=.28;skirt.rotation.x=Math.PI;spirit.group.add(skirt);
  for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(rnd(.12,.2),8,6),bm);
    s.position.set(rnd(-.3,.3),rnd(.8,1.1),rnd(-.6,.3));spirit.group.add(s);}
  const eyeM=new THREE.MeshBasicMaterial({color:W.spiritEye});
  const eL=new THREE.Mesh(new THREE.SphereGeometry(.06,8,8),eyeM);eL.position.set(-.12,.9,1.3);spirit.group.add(eL);
  const eR=eL.clone();eR.position.x=.12;spirit.group.add(eR);
  spirit.eyeLight=new THREE.PointLight(W.spiritLight,.9,8);spirit.eyeLight.position.set(0,.9,1.1);spirit.group.add(spirit.eyeLight);
  spirit.group.scale.setScalar(.001);scene.add(spirit.group);
}
