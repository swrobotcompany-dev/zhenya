// Частицы: плавающие крупинки, залпы (burst) и обновление
/* ---------- частицы ---------- */
const parts=[];
function buildParticles(){
  const n=70,p=new Float32Array(n*3);
  const col=(W.float==='seed')?0xffffff:((W.float==='spore')?0x8fe8ff:0xf0a848);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  floaters=new THREE.Points(g,new THREE.PointsMaterial({color:col,size:(W.float==='leaf')?.22:.16,transparent:true,opacity:.85,depthWrite:false}));
  scene.add(floaters);
  for(let i=0;i<n;i++){const a=rnd(Math.PI*2),r=rnd(4,52);
    floatBase.push({x:Math.cos(a)*r,y:rnd(.4,(W.float==='leaf')?9:3.5),z:Math.sin(a)*r,ph:rnd(9)});}
  if(W.extra==='fireflies'){
    const p2=new Float32Array(34*3);const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.BufferAttribute(p2,3));
    fireflies=new THREE.Points(g2,new THREE.PointsMaterial({color:0xffe08a,size:.28,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    scene.add(fireflies);
    fireflies.userData.base=[];
    for(let i=0;i<34;i++){const a=rnd(Math.PI*2),r=rnd(5,50);
      fireflies.userData.base.push({x:Math.cos(a)*r,y:rnd(.5,2.5),z:Math.sin(a)*r,ph:rnd(9)});}}
  for(let i=0;i<80;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(255,255,255,.7),transparent:true,opacity:0,depthWrite:false}));
    s.visible=false;scene.add(s);
    parts.push({s:s,vel:new THREE.Vector3(),life:0,max:1,size:1});}
}
function burst(pos,color,n,spd,size){let c=0;
  for(let k=0;k<parts.length;k++){const p=parts[k];
    if(p.life>0)continue;if(c>=n)break;c++;
    p.s.visible=true;p.s.material.color.set(color);p.s.material.blending=THREE.AdditiveBlending;
    p.s.position.copy(pos);
    p.vel.set(rnd(-1,1),rnd(-.2,1),rnd(-1,1)).normalize().multiplyScalar(rnd(.3,1)*spd);
    p.max=p.life=rnd(.5,1);p.size=size;}}
function updateParts(dt){for(let k=0;k<parts.length;k++){const p=parts[k];
  if(p.life<=0)continue;
  p.life-=dt;if(p.life<=0){p.s.visible=false;continue;}
  p.s.position.addScaledVector(p.vel,dt);p.vel.multiplyScalar(.93);
  const q=p.life/p.max;p.s.material.opacity=q*.85;p.s.scale.setScalar(p.size*(0.4+0.6*q));}}

