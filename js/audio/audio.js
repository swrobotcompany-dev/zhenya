// Звук: Web Audio API — эмбиент, шаги, сердцебиение, сбор плодов
/* ---------- звук ---------- */
let S=null;
function initAudio(){
  if(S)return;
  const AC=new (window.AudioContext||window.webkitAudioContext)();S={AC:AC};
  const master=AC.createGain();master.gain.value=.8;
  const comp=AC.createDynamicsCompressor();master.connect(comp);comp.connect(AC.destination);
  const revIn=AC.createGain(),conv=AC.createConvolver(),revOut=AC.createGain();revOut.gain.value=.7;
  {const len=AC.sampleRate*2.4,buf=AC.createBuffer(2,len,AC.sampleRate);
    for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);
      for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);}
    conv.buffer=buf;}
  revIn.connect(conv);conv.connect(revOut);revOut.connect(master);
  S.master=master;
  S.out=function(node,wet){wet=wet||0;node.connect(master);
    if(wet>0){const g=AC.createGain();g.gain.value=wet;node.connect(g);g.connect(revIn);}};
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  S.pan=function(node,p){if(AC.createStereoPanner){const pn=AC.createStereoPanner();pn.pan.value=p;node.connect(pn);S.out(pn,0);return pn;}S.out(node,0);return node;};
  {const src=AC.createBufferSource();src.buffer=nb;src.loop=true;
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=420;f.Q.value=.6;
    const g=AC.createGain();g.gain.value=W.wind;src.connect(f);f.connect(g);S.out(g,.1);
    const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=.07;lg.gain.value=200;
    lfo.connect(lg);lg.connect(f.frequency);lfo.start();src.start();}
  {const g=AC.createGain();g.gain.value=W.drone;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=240;
    [55,55.6].forEach(function(fr){const o=AC.createOscillator();o.frequency.value=fr;const og=AC.createGain();og.gain.value=1;o.connect(og);og.connect(f);o.start();});
    f.connect(g);S.out(g,.3);}
  if(W.droplets){const drop=function(){if(AC.state==='running'){const t=AC.currentTime,f0=rnd(1000,2400);
      const o=AC.createOscillator();o.frequency.setValueAtTime(f0,t);
      o.frequency.exponentialRampToValueAtTime(f0*.4,t+.13);
      const g=AC.createGain();g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(.11,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.3);
      o.connect(g);S.pan(g,rnd(-.8,.8));S.out(g,.6);o.start(t);o.stop(t+.35);
      if(Math.random()<.4)setTimeout(drop,rnd(130,280));}
    setTimeout(drop,rnd(1400,5200));};setTimeout(drop,2000);}
  if(W.birds){const bird=function(){if(AC.state==='running'){const t=AC.currentTime,n=2+(Math.random()*3|0);
      for(let i=0;i<n;i++){const f0=rnd(2400,3600);
        const o=AC.createOscillator();o.frequency.setValueAtTime(f0,t+i*.14);
        o.frequency.exponentialRampToValueAtTime(f0*.72,t+i*.14+.09);
        const g=AC.createGain();g.gain.setValueAtTime(0,t+i*.14);
        g.gain.linearRampToValueAtTime(.045,t+i*.14+.015);g.gain.exponentialRampToValueAtTime(.0001,t+i*.14+.11);
        o.connect(g);S.pan(g,rnd(-.9,.9));S.out(g,.4);o.start(t+i*.14);o.stop(t+i*.14+.15);}}
    setTimeout(bird,rnd(1800,6500));};setTimeout(bird,1500);}
  if(W.chimes){const notes=[523.25,587.33,659.25,783.99,880];
    const chime=function(){if(AC.state==='running'){const t=AC.currentTime,f=notes[(Math.random()*notes.length)|0];
      [1,.4].forEach(function(v,k){const o=AC.createOscillator();o.frequency.value=f*(k?2:1);
        const g=AC.createGain();g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(.05*v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+2.4);
        o.connect(g);S.pan(g,rnd(-.8,.8));S.out(g,.9);o.start(t);o.stop(t+2.5);});}
    setTimeout(chime,rnd(3500,9000));};setTimeout(chime,2500);}
  if(W.rustle){const ru=function(){if(AC.state==='running'){const t=AC.currentTime;
      const src=AC.createBufferSource();src.buffer=nb;
      const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=rnd(900,1600);bp.Q.value=1.2;
      const g=AC.createGain();g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(.028,t+.15);g.gain.linearRampToValueAtTime(0,t+.5);
      src.connect(bp);bp.connect(g);S.pan(g,rnd(-.9,.9));S.out(g,.3);src.start(t);src.stop(t+.6);}
    setTimeout(ru,rnd(3000,8000));};setTimeout(ru,3000);}
  S.whoosh=function(vol,panV){const t=AC.currentTime;const src=AC.createBufferSource();src.buffer=nb;src.loop=true;
    const bp=AC.createBiquadFilter();bp.type='bandpass';bp.Q.value=2;
    bp.frequency.setValueAtTime(280,t);bp.frequency.linearRampToValueAtTime(950,t+1.2);
    const g=AC.createGain();g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+.5);g.gain.linearRampToValueAtTime(0,t+1.6);
    src.connect(bp);bp.connect(g);S.pan(g,panV);S.out(g,.7);src.start(t);src.stop(t+1.8);};
  S.puff=function(){const t=AC.currentTime;const src=AC.createBufferSource();src.buffer=nb;
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=500;
    const g=AC.createGain();g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.0001,t+.35);
    src.connect(f);f.connect(g);S.out(g,.4);src.start(t);src.stop(t+.4);
    const o=AC.createOscillator();o.frequency.setValueAtTime(500,t);
    o.frequency.exponentialRampToValueAtTime(180,t+.3);
    const og=AC.createGain();og.gain.setValueAtTime(.1,t);og.gain.exponentialRampToValueAtTime(.0001,t+.32);
    o.connect(og);S.out(og,.3);o.start(t);o.stop(t+.35);};
  S.step=function(sp){const t=AC.currentTime,src=AC.createBufferSource();src.buffer=nb;
    const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=rnd(300,500);bp.Q.value=1.4;
    const g=AC.createGain();g.gain.setValueAtTime(sp?.07:.04,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.08);
    src.connect(bp);bp.connect(g);S.out(g,.15);src.start(t);src.stop(t+.1);};
  S.heart=function(f){const t=AC.currentTime;const o=AC.createOscillator();o.frequency.value=60;
    const g=AC.createGain();g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(.05+.08*f,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
    o.connect(g);S.out(g,.1);o.start(t);o.stop(t+.25);};
  S.pick=function(){const t=AC.currentTime;
    [523.25,659.25,783.99].forEach(function(fr,i){const o=AC.createOscillator();o.frequency.value=fr;
      const g=AC.createGain();g.gain.setValueAtTime(0,t+i*.09);
      g.gain.linearRampToValueAtTime(.13,t+i*.09+.01);
      g.gain.exponentialRampToValueAtTime(.0001,t+i*.09+1.1);
      o.connect(g);S.out(g,.7);o.start(t+i*.09);o.stop(t+i*.09+1.2);});};
  S.win=function(){const t=AC.currentTime;[523.25,659.25,783.99,1046.5].forEach(function(fr,i){
      const o=AC.createOscillator();o.frequency.value=fr;
      const g=AC.createGain();g.gain.setValueAtTime(0,t+i*.35);
      g.gain.linearRampToValueAtTime(.12,t+i*.35+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+i*.35+1.8);
      o.connect(g);S.out(g,.8);o.start(t+i*.35);o.stop(t+i*.35+2);});};
  S.lose=function(){const t=AC.currentTime;[392,329.63,261.63].forEach(function(fr,i){
      const o=AC.createOscillator();o.frequency.value=fr;
      const g=AC.createGain();g.gain.setValueAtTime(0,t+i*.4);
      g.gain.linearRampToValueAtTime(.1,t+i*.4+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+i*.4+1.6);
      o.connect(g);S.out(g,.7);o.start(t+i*.4);o.stop(t+i*.4+1.8);});};
  S.duck=function(v){master.gain.cancelScheduledValues(AC.currentTime);
    master.gain.linearRampToValueAtTime(G.muted?0:v,AC.currentTime+.4);};
  AC.resume();
}
