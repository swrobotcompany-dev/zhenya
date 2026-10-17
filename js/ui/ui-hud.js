// HUD и обработка пользовательского ввода
/* ---------- UI ---------- */
const HEART_SVG='<svg viewBox="0 0 24 22"><path fill="#ff8fa3" d="M12 21C6 16.5 2 12.8 2 8.6 2 5.5 4.4 3.5 7 3.5c1.9 0 3.7 1 5 2.7 1.3-1.7 3.1-2.7 5-2.7 2.6 0 5 2 5 5.1 0 4.2-4 7.9-10 12.4z"/></svg>';
$('hearts').innerHTML=HEART_SVG.repeat(3);
function updateHearts(){[...$('hearts').children].forEach(function(h,i){h.classList.toggle('lost',i>=G.hearts);});}
let hintTO=null;
function setHint(txt,dur){dur=dur||4.5;const h=$('hint');h.textContent=txt;h.classList.add('show');
  clearTimeout(hintTO);hintTO=setTimeout(function(){h.classList.remove('show');},dur*1000);}
const AMB=['Ветер пахнет мёдом…','Где-то далеко звенит ручей.','Листья шепчутся о чём-то своём.','Сегодня хороший день для прогулки.'];
function ambLoop(){setTimeout(function(){if(G.state==='play')setHint(AMB[(Math.random()*AMB.length)|0]);ambLoop();},rnd(16000,26000));}
document.querySelectorAll('.card').forEach(function(c){
  c.addEventListener('click',function(){initGame(c.dataset.w);});});

addEventListener('keydown',function(e){
  keys[e.code]=true;
  if(e.code==='ArrowUp'||e.code==='ArrowDown'||e.code==='ArrowLeft'||e.code==='ArrowRight'||e.code==='Space')e.preventDefault();
  if(e.code==='KeyM'){G.muted=!G.muted;if(S)S.duck(G.state==='pause'?.12:.8);}
  if(e.code==='KeyP'||e.code==='Escape')togglePause();});
addEventListener('keyup',function(e){keys[e.code]=false;});
addEventListener('resize',function(){if(!renderer)return;
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
document.addEventListener('visibilitychange',function(){if(document.hidden&&G.state==='play')togglePause();});
