// Инициализация игры: рендерер, сцена, камера, освещение, сборка мира
function initGame(key){
  try{
    W=WORLDS[key];W.key=key;
    BEAMTEX=beamTexture();
    document.documentElement.style.setProperty('--accent','#'+new THREE.Color(W.fruit).getHexString());

    renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    $('stage').appendChild(renderer.domElement);

    scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(W.fog,W.fogD);
    camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,900);

    scene.add(new THREE.AmbientLight(W.amb,W.ambI));
    scene.add(new THREE.HemisphereLight(W.hemiS,W.hemiG,W.hemiI));
    sunLight=new THREE.DirectionalLight(W.sun,W.sunI);
    sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);
    const sc=sunLight.shadow.camera;sc.left=-32;sc.right=32;sc.top=32;sc.bottom=-32;sc.near=5;sc.far=250;
    scene.add(sunLight);scene.add(sunLight.target);

    buildSky();buildGround();buildTrees();buildDetails();
    buildFox();buildArrow();buildFruits();buildSpirit();buildPortal();buildParticles();

    G.state='play';G.introT=0;
    $('loc').textContent=W.name;
    $('menu').classList.add('gone');$('hud').style.display='block';
    setTimeout(function(){$('loc').style.opacity=1;},600);
    setTimeout(function(){$('loc').style.opacity=0;},4800);
    setTimeout(function(){setHint('Идите на лучи света — там плоды ✦');},3200);
    ambLoop();
    try{initAudio();}catch(err){console.warn('звук недоступен:',err);}
    clock=new THREE.Clock();
    animate();
  }catch(err){showErr(err.message);console.error(err);}
}

function setGoal(txt,lit){const g=$('goalText');g.textContent=txt;g.classList.toggle('lit',!!lit);}
