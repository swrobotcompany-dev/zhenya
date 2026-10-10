// Построение неба: градиентный шейдер, солнце, звёзды и облака
function buildSky(){
  const u={uZen:{value:new THREE.Color(W.zen)},uMid:{value:new THREE.Color(W.mid)},uHor:{value:new THREE.Color(W.hor)},
    uGlow:{value:new THREE.Color(W.glow)},uDir:{value:new THREE.Vector3(W.glowDir[0],W.glowDir[1],W.glowDir[2]).normalize()}};
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(380,32,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,uniforms:u,
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:[
      'uniform vec3 uZen,uMid,uHor,uGlow;uniform vec3 uDir;varying vec3 vP;',
      'void main(){vec3 d=normalize(vP);float h=d.y;',
      'vec3 c=mix(uHor,uMid,smoothstep(-.02,.18,h));',
      'c=mix(c,uZen,smoothstep(.16,.7,h));',
      'float g=max(0.,dot(d,uDir));',
      'c+=uGlow*pow(g,7.)*.9*smoothstep(.5,.0,h)+uGlow*pow(g,40.)*.6;',
      'gl_FragColor=vec4(c,1.);}'].join('\n')})));
  const gc=new THREE.Color(W.glow);
  const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(gc.r*255,gc.g*255,gc.b*255,.9),fog:false,depthWrite:false,transparent:true}));
  const gd=new THREE.Vector3(W.glowDir[0],W.glowDir[1],W.glowDir[2]).normalize().multiplyScalar(330);
  const sunSize=(W.key==='autumn')?190:140;
  sunSprite.scale.set(sunSize,sunSize,1);
  sunSprite.position.copy(gd);scene.add(sunSprite);
  const coreCol=new THREE.Color(W.glow).lerp(new THREE.Color(0xffffff),.5);
  const core=new THREE.Mesh(new THREE.CircleGeometry((W.key==='classic')?14:17,32),new THREE.MeshBasicMaterial({color:coreCol,fog:false}));
  core.position.copy(gd);core.lookAt(0,0,0);scene.add(core);
  if(W.starCount>0){
    const n=W.starCount,p=new Float32Array(n*3);
    for(let i=0;i<n;i++){const a=rnd(Math.PI*2),e=rnd(.12,1.4),r=350;
      p[i*3]=Math.cos(a)*Math.cos(e)*r;p[i*3+1]=Math.sin(e)*r;p[i*3+2]=Math.sin(a)*Math.cos(e)*r;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
    stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,transparent:true,opacity:.85,fog:false}));
    scene.add(stars);}
  for(let i=0;i<4;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(255,255,255,.35),color:W.clouds,fog:false,depthWrite:false,transparent:true,opacity:.5}));
    s.position.set(rnd(-80,60),rnd(50,90),rnd(-160,-80));
    s.scale.set(rnd(60,110),rnd(14,26),1);
    s.userData.v=rnd(.5,1.4);scene.add(s);}
}
