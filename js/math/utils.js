// Математические утилиты: случайные числа, сглаживание углов, высота рельефа
const lerp=function(a,b,t){return a+(b-a)*t;};
const rnd=function(a,b){return b===undefined?Math.random()*a:a+Math.random()*(b-a);};
function lerpAngle(a,b,t){let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+d*Math.min(1,t);}
function gH(x,z){let y=Math.sin(x*.15)*Math.cos(z*.13)*.5+Math.sin(x*.4+z*.31)*.25;
  const r=Math.hypot(x,z);if(r<8)y*=r/8;return y*.9;}
