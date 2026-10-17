// Текстуры свечения и лучей, генерируемые на canvas
function glowTexture(r,g,b,a){a=a===undefined?.6:a;
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba('+(r|0)+','+(g|0)+','+(b|0)+','+a+')');
  gr.addColorStop(1,'rgba('+(r|0)+','+(g|0)+','+(b|0)+',0)');
  x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function beamTexture(){
  const c=document.createElement('canvas');c.width=32;c.height=128;const x=c.getContext('2d');
  const gr=x.createLinearGradient(0,128,0,0);
  gr.addColorStop(0,'rgba(255,255,255,.85)');
  gr.addColorStop(.5,'rgba(255,255,255,.35)');
  gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=gr;x.fillRect(0,0,32,128);
  return new THREE.CanvasTexture(c);}
let BEAMTEX=null;
// Глобальное состояние игры, клавиши и ссылки на объекты Three.js
const G={state:'menu',t:0,hearts:3,fruits:0,stam:CFG.stam,fear:0,invuln:0,hbT:0,stepAcc:0,introT:-1,beastAt:10,muted:false,won:false};
const keys={};

let renderer,scene,camera,clock,sunLight,stars=null,fireflies=null,mushrooms=[];
let floaters=null,floatBase=[];
