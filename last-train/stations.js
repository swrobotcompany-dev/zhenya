/* Station decisions: one major action per stop. */
'use strict';
const STATION_TYPES=[
{name:'Разбитое депо',symbol:'⛽',description:'Брошенные цистерны и разбитые вагоны.',actions:[
{label:'⛽ Слить дизель',hint:'+7–11 топлива, риск повреждения',play(s){const n=stationRoll(7,11);stationGain(s,'fuel',n);if(Math.random()<.22){stationGain(s,'hp',-6);return 'Добыто '+n+' топлива, −6 прочности из-за поломки.'}return 'Добыто '+n+' топлива.'}},
{label:'🔩 Разобрать обломки',hint:'+11–16 металла, риск нападения',play(s){const n=stationRoll(11,16);stationGain(s,'scrap',n);if(Math.random()<.30){stationStartRaid(s);return '+'+n+' металла. Шум привлёк зомби!'}return 'Собрано '+n+' металла.'}},
{label:'🔫 Вскрыть оружейный шкаф',hint:'+7–11 патронов, +1 аптечка',play(s){const n=stationRoll(7,11);stationGain(s,'ammo',n);stationGain(s,'medicine',1);return '+'+n+' патронов и 1 аптечка.'}}]},
{name:'Заражённая больница',symbol:'🏥',description:'Разбитые палаты, запертая аптека, темные коридоры.',actions:[
{label:'✚ Проверить аптеку',hint:'+3–5 медикаментов, риск травмы',play(s){const n=stationRoll(3,5);stationGain(s,'medicine',n);if(Math.random()<.26){stationGain(s,'hp',-7);return '+'+n+' аптечек, −7 прочности.'}return '+'+n+' аптечек.'}},
{label:'🔧 Починить состав',hint:'−5 металла, +26 прочности',can:s=>s.scrap>=5&&s.hp<100,play(s){stationGain(s,'scrap',-5);const n=Math.min(26,100-s.hp);stationGain(s,'hp',n);return 'Ремонт: +'+n+' прочности.'}},
{label:'🍲 Найти консервы',hint:'+8–12 еды, риск нападения',play(s){const n=stationRoll(8,12);stationGain(s,'food',n);if(Math.random()<.28){stationStartRaid(s);return '+'+n+' еды. Из подвала вышли зомби!'}return '+'+n+' еды.'}}]},
{name:'Опустевший посёлок',symbol:'🏚️',description:'Магазин, гаражи и сигнал от костра.',actions:[
{label:'🥫 Проверить магазин',hint:'+10–15 еды',play(s){const n=stationRoll(10,15);stationGain(s,'food',n);return 'Найдено '+n+' еды.'}},
{label:'👥 Пригласить беженца',hint:'−4 еды, −4 металла, +1 человек',can:s=>s.food>=4&&s.scrap>=4,play(s){stationGain(s,'food',-4);stationGain(s,'scrap',-4);stationGain(s,'crew',1);return 'Новый выживший присоединился к экипажу.'}},
{label:'🔩 Обыскать гаражи',hint:'+7–11 металла, +2–4 топлива',play(s){const n=stationRoll(7,11),f=stationRoll(2,4);stationGain(s,'scrap',n);stationGain(s,'fuel',f);return '+'+n+' металла и +'+f+' топлива.'}}]},
{name:'Заброшенный завод',symbol:'🏭',description:'Разрушенный литейный цех и склады охраны.',actions:[
{label:'⚙ Демонтировать станки',hint:'+13–19 металла, риск повреждения',play(s){const n=stationRoll(13,19);stationGain(s,'scrap',n);if(Math.random()<.30){stationGain(s,'hp',-8);return '+'+n+' металла, −8 прочности.'}return '+'+n+' металла.'}},
{label:'🔫 Обыскать арсенал',hint:'+10–15 патронов, высокий риск нападения',play(s){const n=stationRoll(10,15);stationGain(s,'ammo',n);if(Math.random()<.46){stationStartRaid(s);return '+'+n+' патронов. Сработала тревога — зомби!'}return '+'+n+' патронов.'}},
{label:'⛽ Запустить насос',hint:'+6 топлива, +4 металла',play(s){stationGain(s,'fuel',6);stationGain(s,'scrap',4);return '+6 топлива и +4 металла.'}}]},
{name:'Военный блокпост',symbol:'🛡',description:'Мешки с песком, пустая вышка и карта безопасных путей.',actions:[
{label:'🔫 Собрать патроны',hint:'+9–13 патронов, риск нападения',play(s){const n=stationRoll(9,13);stationGain(s,'ammo',n);if(Math.random()<.24){stationStartRaid(s);return '+'+n+' патронов, возле бункера появились зомби!'}return '+'+n+' патронов.'}},
{label:'🗺 Выбрать безопасный маршрут',hint:'Следующий переезд без случайного нападения',play(s){s.safePassage=true;return 'Маршрут разведан — следующее случайное нападение отменено.'}},
{label:'🔧 Починить броню',hint:'−6 металла, +18 прочности',can:s=>s.scrap>=6&&s.hp<100,play(s){stationGain(s,'scrap',-6);const n=Math.min(18,100-s.hp);stationGain(s,'hp',n);return '+'+n+' прочности.'}}]},
{name:'Радиостанция',symbol:'📡',description:'Антенны всё ещё работают, по проводам идёт ток.',actions:[
{label:'📻 Настроить радиосвязь',hint:'Безопасный переезд, +2 топлива',play(s){s.safePassage=true;stationGain(s,'fuel',2);return 'Передан маршрут без патрулей. +2 топлива.'}},
{label:'🔋 Проверить электрощит',hint:'+5 топлива, +5 патронов',play(s){stationGain(s,'fuel',5);stationGain(s,'ammo',5);return '+5 топлива и +5 патронов.'}},
{label:'👥 Ответить на сигнал',hint:'Возможен выживший или нападение',play(s){if(Math.random()<.65){stationGain(s,'crew',1);stationGain(s,'food',3);return 'Спасён связист: +1 человек и +3 еды.'}stationStartRaid(s);return 'На сигнал откликнулись заражённые — нападение!'}}]}
];
function stationRoll(a,b){return a+Math.floor(Math.random()*(b-a+1))}
function stationGain(s,key,n){const lim=key==='hp'?100:Infinity;s[key]=Math.max(0,Math.min(lim,(s[key]||0)+n))}
function stationStartRaid(s){s.phase='raid';s.attack=stationRoll(5,8)+Math.floor(s.day/4);s.wave=null}
function chooseStation(prev){
 const p=Number.isInteger(prev)?prev:0;
 return (p+1+Math.floor(Math.random()*(STATION_TYPES.length-1)))%STATION_TYPES.length
}
function executeStationChoice(s,index){
 if(window.Multiplayer?.connected){window.Multiplayer.action('station',{choice:index});return true}
 if(!s||s.phase!=='station'||s.gameover||s.scavenged||TrainArt.journey?.active)return false;
 const place=STATION_TYPES[s.stationType]||STATION_TYPES[0];
 const action=place.actions[index];
 if(!action||(action.can&&!action.can(s)))return false;
 s.scavenged=true;
 const message=action.play(s);
 if(typeof write==='function')write(place.name+': '+message);
 if(typeof checkEnd==='function')checkEnd();
 if(s.phase==='raid')ensureZombieWave(s);
 if(typeof render==='function')render();
 return true;
}
