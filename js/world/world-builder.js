// Построение мира: земля, деревья, детали (цветы, грибы, светлячки)
function buildGround(){
  const geo=new THREE.PlaneGeometry(440,440,70,70);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,gH(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:W.ground,roughness:1}));
  ground.receiveShadow=true;scene.add(ground);
}

function buildTrees(){
  const trunkMat=new THREE.MeshStandardMaterial({color:W.trunk,roughness:.95});
  const leafMats=W.leaves.map(function(c){return new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true});});
  for(let i=0;i<80;i++){
    let x,z,r;
    do{x=rnd(-70,70);z=rnd(-70,70);r=Math.hypot(x,z);}while(r<9||r>72);
    const g=new THREE.Group(),h=rnd(3.5,6.5);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,h,7),trunkMat);
    trunk.position.y=h/2;trunk.castShadow=true;g.add(trunk);
    const nl=3+(Math.random()*3|0);
    for(let j=0;j<nl;j++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(rnd(.9,1.7),9,7),leafMats[(Math.random()*leafMats.length)|0]);
      s.position.set(rnd(-1,1),h+rnd(-.6,1.2),rnd(-1,1));
      s.scale.y=rnd(.7,.95);s.castShadow=true;g.add(s);}
    g.position.set(x,gH(x,z)-.1,z);g.rotation.y=rnd(6);scene.add(g);}
}

function buildDetails(){
  const rockMat=new THREE.MeshStandardMaterial({color:new THREE.Color(W.ground).multiplyScalar(.7),roughness:1,flatShading:true});
  for(let i=0;i<30;i++){
    const a=rnd(Math.PI*2),r=rnd(6,58),s=rnd(.2,.7);
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),rockMat);
    m.position.set(x,gH(x,z)+s*.3,z);
    m.rotation.set(rnd(3),rnd(3),rnd(3));m.castShadow=true;scene.add(m);}
  { const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.05,.45,4),new THREE.MeshStandardMaterial({color:W.grass,roughness:1}),320);
    const d=new THREE.Object3D();
    for(let i=0;i<320;i++){
      const a=rnd(Math.PI*2),r=rnd(3,58),x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,gH(x,z)+.2,z);
      d.rotation.set(rnd(-.25,.25),rnd(6),rnd(-.25,.25));
      d.scale.setScalar(rnd(.6,1.6));d.updateMatrix();
      grass.setMatrixAt(i,d.matrix);}
    scene.add(grass);}
  if(W.extra==='flowers'){
    const fl=new THREE.InstancedMesh(new THREE.SphereGeometry(.07,6,5),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7}),140);
    const d=new THREE.Object3D(),cols=[0xffffff,0xffd0e8,0xffe9a0,0xd8c0ff];
    for(let i=0;i<140;i++){
      const a=rnd(Math.PI*2),r=rnd(4,54),x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,gH(x,z)+.18,z);
      d.scale.setScalar(rnd(.6,1.3));d.updateMatrix();
      fl.setMatrixAt(i,d.matrix);
      fl.setColorAt(i,new THREE.Color(cols[(Math.random()*4)|0]));}
    if(fl.instanceColor)fl.instanceColor.needsUpdate=true;
    scene.add(fl);}
  if(W.extra==='shrooms'){
    const capMat=new THREE.MeshStandardMaterial({color:0x2a90b0,emissive:0x54f0ff,emissiveIntensity:1.8,roughness:.4});
    const stemMat=new THREE.MeshStandardMaterial({color:0xe8e0f0,roughness:.8});
    for(let i=0;i<16;i++){
      const a=rnd(Math.PI*2),r=rnd(6,52),x=Math.cos(a)*r,z=Math.sin(a)*r,y=gH(x,z);
      const n=1+(Math.random()*3|0);
      for(let j=0;j<n;j++){
        const g=new THREE.Group();
        g.position.set(x+rnd(-.5,.5),y,z+rnd(-.5,.5));
        g.scale.setScalar(rnd(.5,1.1));
        const st=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,.3,6),stemMat);st.position.y=.15;g.add(st);
        const cap=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),capMat);cap.scale.y=.6;cap.position.y=.32;g.add(cap);
        const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(90,240,255,.5),transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));
        halo.scale.set(.9,.9,1);halo.position.y=.35;g.add(halo);
        scene.add(g);mushrooms.push({halo:halo,cap:cap,ph:rnd(9)});}}
    const gl=new THREE.InstancedMesh(new THREE.ConeGeometry(.04,.4,4),
      new THREE.MeshStandardMaterial({color:0x224a66,emissive:0x54f0ff,emissiveIntensity:.7}),160);
    const d=new THREE.Object3D();
    for(let i=0;i<160;i++){
      const a=rnd(Math.PI*2),r=rnd(3,56),x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,gH(x,z)+.18,z);
      d.rotation.set(rnd(-.3,.3),rnd(6),rnd(-.3,.3));
      d.scale.setScalar(rnd(.5,1.4));d.updateMatrix();
      gl.setMatrixAt(i,d.matrix);}
    scene.add(gl);}
}
