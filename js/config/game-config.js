// Конфигурация игры: базовые параметры и утилиты
const CFG={worldR:56,goal:7,walk:4.3,sprint:7.6,stam:100};
const $=function(id){return document.getElementById(id);};
const clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
