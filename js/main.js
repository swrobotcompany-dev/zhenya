// Запуск: первичная отрисовка сердец и частицы меню
updateHearts();
{ const menu=$('menu');
  for(let i=0;i<14;i++){const m=document.createElement('div');m.className='mote';
    m.style.left=rnd(3,97)+'%';m.style.bottom='-5vh';
    m.style.animationDuration=rnd(9,18)+'s';m.style.animationDelay=(-rnd(18))+'s';
    m.style.opacity=rnd(.4,.9);menu.appendChild(m);}}
