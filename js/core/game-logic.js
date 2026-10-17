// Игровая логика: пауза, сбор плодов, урон, конец игры

function togglePause(){
  if(G.state!=='play'&&G.state!=='pause')return;
  G.state=(G.state==='play')?'pause':'play';
  $('pause').classList.toggle('on',G.state==='pause');
  if(S)S.duck(G.state==='pause'?.12:.8);
}
function collectFruit(i){
  const fr=fruitsArr[i];fr.alive=false;scene.remove(fr.g);
  burst(fr.g.position.clone().add(new THREE.Vector3(0,1.3,0)),W.fruit,20,4.5,.7);
  if(S)S.pick();
  G.fruits++;$('fruitCt').textContent=G.fruits;
  spirit.enrage=6;
  if(spirit.state==='lurk')spirit.state='chase';
  if(G.fruits===CFG.goal){openPortal();}
  else setHint(['Чудесно!','Какой красивый…','Лес доволен вами.','Половина пути!','Ещё чуть-чуть ✦','Почти всё!'][G.fruits-1]||'Продолжайте!');
}
function hitFox(){
  G.hearts--;updateHearts();G.invuln=3;
  if(S)S.puff();
  const f=$('flash');f.style.transition='none';f.style.opacity=.7;
  requestAnimationFrame(function(){f.style.transition='opacity 1s';f.style.opacity=0;});
  const dir=fox.group.position.clone().sub(spirit.group.position).setY(0).normalize();
  fox.group.position.addScaledVector(dir,3);
  burst(spirit.group.position.clone().add(new THREE.Vector3(0,1,0)),W.spiritLight,12,2.5,1.2);
  spirit.state='die';spirit.dieT=0;
  if(G.hearts<=0)setTimeout(function(){endGame(false);},900);
  else setHint('Дух тумана коснулся вас…',4);
}
function endGame(win){
  if(G.state==='end')return;
  G.state='end';spirit.state='off';spirit.group.scale.setScalar(.001);
  $('endTitle').textContent=win?'Лисёнок дома! ✦':'Дух догнал лисёнка…';
  $('endText').innerHTML=win
    ?'Семь плодов, одно храброе сердце — и портал мягко закрылся за спиной. Дом пахнет чаем и одеялом.'
    :'Лисёнок присел отдохнуть в тумане. Ничего страшного — попробуйте ещё раз, лес подождёт.';
  $('end').classList.add('on');
  if(S){if(win){/* уже звучало у портала */}else S.lose();S.duck(.4);}
}
