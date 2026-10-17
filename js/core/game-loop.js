// Главный игровой цикл: анимация лисёнка, духа, портала, камеры
/* ---------- цикл ---------- */
function foxDir(){
  let x=0,z=0;
  if(keys.KeyW||keys.KeyZ||keys.ArrowUp)z-=1;
  if(keys.KeyS||keys.ArrowDown)z+=1;
  if(keys.KeyA||keys.KeyQ||keys.ArrowLeft)x-=1;
  if(keys.KeyD||keys.ArrowRight)x+=1;
  return[x,z];}
function updateArrow(){
  // цель стрелки: ближайший плод или портал
  let tx=null,tz=null,best=1e12;
  for(let i=0;i<fruitsArr.length;i++){const fr=fruitsArr[i];if(!fr.alive)continue;
    const dx=fr.g.position.x-fox.group.position.x,dz=fr.g.position.z-fox.group.position.z,d2=dx*dx+dz*dz;
    if(d2<best){best=d2;tx=fr.g.position.x;tz=fr.g.position.z;}}
  if(portal.active){tx=0;tz=0;}
  if(tx===null){fox.arrow.visible=false;return;}
  fox.arrow.visible=true;
  const worldAng=Math.atan2(tx-fox.group.position.x,tz-fox.group.position.z);
  fox.arrowYaw=lerpAngle(fox.arrowYaw,worldAng-fox.group.rotation.y,.12);
  fox.arrow.rotation.y=fox.arrowYaw;
  fox.arrow.position.y=1.1+Math.sin(G.t*3)*.06;
}
function updateFox(dt){
  const d=foxDir(),ix=d[0],iz=d[1];
  const moving=(ix||iz)&&G.state==='play';
  const wantSprint=(keys.ShiftLeft||keys.ShiftRight||keys.Space)&&moving&&G.stam>4;
  let speed=moving?(wantSprint?CFG.sprint:CFG.walk):0;
  if(G.stam<=4&&moving)speed=3.2;
  if(wantSprint)G.stam=Math.max(0,G.stam-24*dt);else G.stam=Math.min(CFG.stam,G.stam+14*dt);
  $('stam').style.width=G.stam+'%';
  $('stam').classList.toggle('tired',G.stam<30);
  if(moving){
    const l=Math.hypot(ix,iz),dx=ix/l,dz=iz/l;
    fox.group.position.x+=dx*speed*dt;fox.group.position.z+=dz*speed*dt;
    const r=Math.hypot(fox.group.position.x,fox.group.position.z);
    if(r>CFG.worldR){fox.group.position.x*=CFG.worldR/r;fox.group.position.z*=CFG.worldR/r;}
    fox.group.rotation.y=lerpAngle(fox.group.rotation.y,Math.atan2(dx,dz),10*dt);
    fox.amp+=(1-fox.amp)*Math.min(1,dt*8);
    G.stepAcc+=speed*dt;
    if(G.stepAcc>1.7){G.stepAcc=0;if(S)S.step(wantSprint);}}
  else fox.amp+=(0-fox.amp)*Math.min(1,dt*6);
  fox.group.position.y=gH(fox.group.position.x,fox.group.position.z);
  fox.t+=dt*(moving?speed*2.2:1);
  const a=fox.amp,fr=G.fear;
  for(let i=0;i<fox.legs.length;i++){const L=fox.legs[i];L.p.rotation.x=Math.sin(fox.t+L.off)*.65*a;}
  fox.body.position.y=.42+Math.abs(Math.sin(fox.t))*.035*a+Math.sin(G.t*2.3)*.014*(1-a);
  fox.body.rotation.z=Math.sin(fox.t)*.04*a;
  fox.tail.rotation.x=lerp(.28,-.8,fr)+Math.sin(G.t*2.8)*.1*(1-fr);
  fox.tail.rotation.y=Math.sin(G.t*2.2)*.3*(1-fr*.6)+(moving?Math.sin(fox.t)*.15*a:0);
  for(let i=0;i<fox.tailSegs.length;i++){const s=fox.tailSegs[i];
    s.rotation.x=s.userData.base+Math.sin(G.t*4.5-i*.8)*.09*(1-fr*.7);}
  fox.twitchT-=dt;
  const tw=(fox.twitchT<0&&fox.twitchT>-.25)?Math.sin(G.t*40)*.2:0;
  if(fox.twitchT<-.25)fox.twitchT=rnd(3,8);
  fox.earL.rotation.z=.28+tw+lerp(0,.4,fr);
  fox.earR.rotation.z=-.28-tw*.7-lerp(0,.4,fr);
  fox.earL.rotation.x=fox.earR.rotation.x=-.12+lerp(0,.5,fr);
  fox.glanceT-=dt;
  if(fox.glanceT<=0){fox.glanceT=rnd(1.8,4.5);fox.glanceYaw=rnd(-.7,.7);}
  let want=fox.glanceYaw*(1-fr);
  if(fr>.35&&spirit.group.scale.x>.5){
    const dd=Math.atan2(spirit.group.position.x-fox.group.position.x,spirit.group.position.z-fox.group.position.z)-fox.group.rotation.y;
    want=clamp(((dd+Math.PI*3)%(Math.PI*2))-Math.PI,-.85,.85);}
  fox.headYaw+=(want-fox.headYaw)*Math.min(1,dt*5);
  fox.head.rotation.y=fox.headYaw;
  fox.head.rotation.z=Math.sin(G.t*.9)*.04*(1-a);
  fox.head.rotation.x=Math.sin(G.t*2.3)*.03+fr*.08;
  fox.blinkT-=dt;
  const blink=(fox.blinkT<0&&fox.blinkT>-.12)?.1:1;
  fox.eyeL.scale.y=fox.eyeR.scale.y=blink;
  if(fox.blinkT<-.12)fox.blinkT=rnd(2,5.5);
  fox.nose.scale.setScalar(1+Math.sin(G.t*4)*.08);
  if(fr>.2){fox.group.position.x+=rnd(-1,1)*.01*fr;fox.group.position.z+=rnd(-1,1)*.01*fr;}
  fox.group.visible=(G.invuln>0)?(Math.sin(G.t*20)>-.3):true;
  if(G.invuln>0)G.invuln-=dt;
  updateArrow();
}
function spawnSpirit(near){
  const a=rnd(Math.PI*2),r=near?rnd(26,33):rnd(38,48);
  spirit.group.position.set(
    clamp(fox.group.position.x+Math.cos(a)*r,-CFG.worldR,CFG.worldR),0,
    clamp(fox.group.position.z+Math.sin(a)*r,-CFG.worldR,CFG.worldR));
  spirit.group.position.y=gH(spirit.group.position.x,spirit.group.position.z);
  spirit.state='lurk';spirit.target.set(rnd(-40,40),0,rnd(-40,40));spirit.reposT=0;
}
function updateSpirit(dt){
  const b=spirit;
  if(G.state==='play'){
    G.beastAt-=dt;
    if(b.state==='off'&&G.beastAt<=0){spawnSpirit(false);
      setHint('Где-то рядом проснулся дух тумана…',5);
      if(S)S.whoosh(.1,rnd(-.8,.8));}}
  if(b.state==='die'){b.dieT+=dt;
    b.group.scale.setScalar(Math.max(.001,1.3-b.dieT*2));
    if(b.dieT>.8){b.state='wait';b.waitT=5;}return;}
  if(b.state==='wait'){b.waitT-=dt;if(b.waitT<=0)spawnSpirit(true);return;}
  if(b.state==='off')return;
  const bp=b.group.position,fp=fox.group.position;
  const dist=bp.distanceTo(fp);
  const anger=2.6+G.fruits*.18+(portal.active?.5:0);
  if(b.enrage>0)b.enrage-=dt;
  if((b.state==='lurk'&&dist<19)||(b.enrage>0&&dist<40))b.state='chase';
  if(b.state==='chase'&&dist>32&&b.enrage<=0){b.lurkT+=dt;if(b.lurkT>3)b.state='lurk';}else b.lurkT=0;
  let sp=0,dir=null;
  if(b.state==='chase'){sp=anger+1.2;dir=fp.clone().sub(bp).setY(0);}
  else{sp=1.5;b.reposT=dist>34?b.reposT+dt:0;
    if(b.reposT>9){burst(bp.clone().add(new THREE.Vector3(0,1,0)),W.spiritLight,10,2,1.3);spawnSpirit(true);return;}
    dir=b.target.clone().sub(bp).setY(0);
    if(dir.length()<2)b.target.set(rnd(-45,45),0,rnd(-45,45));}
  if(dir&&dir.lengthSq()>0.01){dir.normalize();
    bp.x+=dir.x*sp*dt;bp.z+=dir.z*sp*dt;
    b.group.rotation.y=lerpAngle(b.group.rotation.y,Math.atan2(dir.x,dir.z),6*dt);}
  bp.y=gH(bp.x,bp.z)+.45+Math.sin(G.t*2)*.12;
  b.group.scale.setScalar(lerp(b.group.scale.x,1.3,Math.min(1,dt*3)));
  b.eyeLight.intensity=.9+Math.sin(G.t*3)*.3;
  b.growlCd-=dt;
  if(dist<24&&b.growlCd<=0){b.growlCd=rnd(4,7);
    if(S){const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),fp.clone().sub(camera.position)).normalize();
      const pan=clamp(fp.clone().sub(bp).normalize().dot(right),-1,1);
      S.whoosh(clamp(.22-dist*.007,.04,.22),pan*.8);}}
  if(Math.random()<dt*5)burst(bp.clone().add(new THREE.Vector3(rnd(-.4,.4),rnd(.2,1),rnd(-.5,.5)),0),W.spiritLight,1,.5,.9);
  if(dist<2.3&&G.invuln<=0&&G.state==='play')hitFox();
}
function updatePortal(dt){
  if(!portal.active)return;
  portal.ring.rotation.z+=dt*1.1;
  portal.ring2.rotation.z-=dt*1.7;
  const k=1+Math.sin(G.t*2.4)*.06;
  portal.ring.scale.setScalar(k);
  portal.glow.material.opacity=.7+Math.sin(G.t*2.4)*.25;
  portal.light.intensity=2.4+Math.sin(G.t*2.4)*.6;
  if(Math.random()<dt*3)burst(new THREE.Vector3(rnd(-1.4,1.4),rnd(1,3),rnd(-1.4,1.4)),W.fruit,2,1.6,.5);
  if(G.state==='play'&&Math.hypot(fox.group.position.x,fox.group.position.z)<2.7)endGame(true);
}
const camTarget=new THREE.Vector3();
function updateCamera(dt){
  const fp=fox.group.position;
  let desired=new THREE.Vector3(fp.x+Math.sin(G.t*.1)*.6,fp.y+6.2,fp.z+11.5);
  if(G.introT>=0&&G.introT<3){G.introT+=dt;const k=G.introT/3,e=1-Math.pow(1-k,3);
    desired.lerp(new THREE.Vector3(fp.x+12,fp.y+22,fp.z+30),1-e);}
  camera.position.lerp(desired,Math.min(1,dt*4));
  camTarget.set(fp.x,fp.y+1.4,fp.z);
  camera.lookAt(camTarget);
  camera.fov=lerp(camera.fov,55+G.fear*4,Math.min(1,dt*3));
  camera.updateProjectionMatrix();
}
function updateAmbient(dt){
  const p=floaters.geometry.attributes.position;
  for(let i=0;i<floatBase.length;i++){const f=floatBase[i];
    if(W.float==='seed')p.setXYZ(i,f.x+Math.sin(G.t*.4+f.ph)*1.2,f.y+Math.sin(G.t*.6+f.ph)*.5,f.z+Math.cos(G.t*.3+f.ph)*1.2);
    else if(W.float==='spore'){f.y+=dt*.25;if(f.y>4)f.y=.3;
      p.setXYZ(i,f.x+Math.sin(G.t*.5+f.ph)*.6,f.y,f.z+Math.cos(G.t*.4+f.ph)*.6);}
    else{f.y-=dt*.7;if(f.y<0)f.y=9;
      p.setXYZ(i,f.x+Math.sin(G.t*.8+f.ph)*1.4,f.y,f.z+Math.cos(G.t*.6+f.ph)*1.4);}}
  p.needsUpdate=true;
  if(fireflies){const p2=fireflies.geometry.attributes.position,b=fireflies.userData.base;
    for(let i=0;i<b.length;i++){p2.setXYZ(i,b[i].x+Math.sin(G.t*.6+b[i].ph)*1.5,b[i].y+Math.sin(G.t*.8+b[i].ph)*.5,b[i].z+Math.cos(G.t*.5+b[i].ph)*1.5);}
    p2.needsUpdate=true;
    fireflies.material.opacity=.5+Math.sin(G.t*2.2)*.4;}
  if(stars)stars.material.opacity=.6+Math.sin(G.t*.8)*.25;
  for(let i=0;i<mushrooms.length;i++){const m=mushrooms[i];
    m.halo.material.opacity=.5+Math.sin(G.t*1.8+m.ph)*.3;
    m.cap.material.emissiveIntensity=1.2+Math.sin(G.t*1.8+m.ph)*.8;}
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  if(G.state!=='pause'){
    G.t+=dt;
    updateAmbient(dt);
    if(G.state==='play'){
      updateFox(dt);updateSpirit(dt);updatePortal(dt);
      if(typeof NET!=='undefined'&&NET.on)updateRemoteFoxes(dt);
      for(let i=0;i<fruitsArr.length;i++){const fr=fruitsArr[i];if(!fr.alive)continue;
        fr.hang.rotation.z=Math.sin(G.t*1.1+fr.ph)*.14;
        fr.f.rotation.y+=dt*1.5;
        const pl=1+Math.sin(G.t*3+fr.ph)*.12;
        fr.f.scale.setScalar(pl);
        fr.f.material.emissiveIntensity=2.4+Math.sin(G.t*3+fr.ph)*1.1;
        fr.light.intensity=2.0+Math.sin(G.t*5+fr.ph)*.7;
        fr.halo.material.opacity=.6+Math.sin(G.t*3+fr.ph)*.25;
        fr.beam.material.opacity=.32+Math.sin(G.t*1.5+fr.ph)*.12;
        if(Math.hypot(fox.group.position.x-fr.g.position.x,fox.group.position.z-fr.g.position.z)<2.3)collectFruit(i);}
      let fTarget=0;
      if(spirit.state==='lurk'||spirit.state==='chase'){
        const d=spirit.group.position.distanceTo(fox.group.position);
        fTarget=clamp((20-d)/15,0,1);
        if(spirit.state==='chase')fTarget=Math.max(fTarget,.7);}
      G.fear+=(fTarget-G.fear)*Math.min(1,dt*2.5);
      $('near').style.opacity=G.fear*.8;
      G.hbT-=dt;
      if(G.fear>.1&&G.hbT<=0){if(S)S.heart(G.fear);G.hbT=1.2-G.fear*.6;}
      const sd=new THREE.Vector3(W.glowDir[0],W.glowDir[1],W.glowDir[2]).normalize();
      sunLight.position.copy(fox.group.position).addScaledVector(sd,70);
      sunLight.target.position.copy(fox.group.position);
      sunLight.target.updateMatrixWorld();}
    else if(G.state==='end'){updatePortal(dt);}
    updateParts(dt);
    updateCamera(dt);}
  renderer.render(scene,camera);
}
