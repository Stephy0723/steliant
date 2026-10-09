/* GGPreloader — motor determinista: render(t) es función pura del tiempo.
   Uso: const p = GGPreloader.create(el,{variant:'A',reduced,sound,onDone}); p.play();  */
(function(){
const GLYPHS='▓▒░█<>/\\#%&$@01Ξ≡';
const WORD='STELIANT ESPORTS';
const ORDER=[3,7,0,5,9,1,8,4,2,6];
const SLICES=7, BARS=5;
const SLICE_BASE=[-.9,.55,-.35,.8,-.6,.3,-.75];
const LOG=['> sintonizando señal…','> canal 06 · 60 Hz · LATAM','> descifrando STELIANT ESPORTS','> ok'];

function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function env(keys,t){if(!keys)return 0;if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){const[a,va]=keys[i-1],[b,vb]=keys[i];if(t<=b)return b===a?vb:va+(vb-va)*(t-a)/(b-a)}return keys[keys.length-1][1]}
const envMax=(list,t)=>list?Math.max(0,...list.map(k=>env(k,t))):0;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=q=>q*q*(3-2*q);

const VARIANTS={
A:{id:'A',name:'Sintonía',total:2800,exitAt:2450,exit:'crt',
  concept:'La señal busca el canal: estática, tres ráfagas, la marca se descifra y el televisor se apaga para mostrar la web.',
  noise:[[0,.55],[600,.6],[1300,.28],[1850,0]],roll:[[0,0],[950,1]],
  gl:[[[560,0],[600,1],[740,.15],[760,0]],[[860,0],[900,.85],[1030,.12],[1050,0]],[[1150,0],[1180,.7],[1320,.08],[1800,.04],[1850,0]],[[2440,0],[2470,.5],[2560,0]]],
  brand:[[560,0],[620,.8],[1300,1]],reveal:[[1150,0],[1800,1]],by:[[1950,0],[2250,1]],out:[[2450,0],[2800,1]],
  phases:[['Estática',0,600],['Ráfagas RGB',600,1300],['Descifrado',1150,1800],['Calma',1800,2450],['Apagón CRT',2450,2800]],
  frames:[[250,'Estática + barra de sintonía'],[640,'Ráfaga 1: franjas y RGB'],[1200,'Caracteres aleatorios'],[1600,'Las letras se fijan'],[2150,'Calma · by Stephanie López Frías / Steliant'],[2600,'Colapso vertical'],[2730,'Línea → la web']]},
B:{id:'B',name:'Corte',total:2400,exitAt:1900,exit:'strips',
  concept:'La marca llega partida en siete franjas y encaja en tres golpes secos. Sale abriéndose en tiras horizontales.',
  noise:[[0,.3],[450,.2],[1100,0]],
  gl:[[[0,.35],[1100,.35],[1140,0]],[[440,0],[460,.9],[560,0]],[[790,0],[810,.8],[900,0]],[[1100,0],[1110,.7],[1200,0]]],
  misalign:[[0,1],[455,1],[460,.55],[805,.55],[810,.22],[1105,.22],[1110,0]],
  brand:[[100,0],[180,1]],reveal:[[0,.3],[455,.3],[460,.6],[805,.6],[810,.85],[1105,.85],[1110,1]],by:[[1300,0],[1600,1]],out:[[1900,0],[2400,1]],
  phases:[['Partida',0,450],['Golpe 1',450,800],['Golpe 2',800,1100],['Golpe 3',1100,1250],['Calma',1250,1900],['Tiras',1900,2400]],
  frames:[[220,'Siete franjas desalineadas'],[500,'Golpe 1'],[850,'Golpe 2'],[1150,'Golpe 3: encaja'],[1550,'Calma · by Stephanie López Frías / Steliant'],[2080,'Las tiras se abren'],[2290,'La web']]},
C:{id:'C',name:'Descifrado',total:2600,exitAt:2150,exit:'blocks',
  concept:'Registro de conexión en mono, el GG se traza y el wordmark se descifra letra a letra. Sale disolviéndose en bloques de píxel.',
  noise:[[0,.18],[900,.12],[1400,0]],log:[[0,0],[900,4]],
  gl:[[[400,0],[420,.18],[1450,.18],[1460,0]],[[1480,0],[1500,.6],[1620,0]],[[2140,0],[2160,.3],[2260,0]]],
  brand:[[350,0],[450,1]],reveal:[[450,0],[1500,1]],draw:[[350,0],[1450,1]],by:[[1650,0],[1950,1]],out:[[2150,0],[2600,1]],
  phases:[['Log',0,900],['Trazo GG',350,1450],['Descifrado',450,1500],['Bloqueo',1480,1620],['Calma',1620,2150],['Bloques',2150,2600]],
  frames:[[320,'Log de conexión'],[750,'GG se traza'],[1150,'Letras descifrándose'],[1520,'Bloqueo con micro-glitch'],[1900,'Calma · by Stephanie López Frías / Steliant'],[2330,'Disolución en bloques'],[2520,'La web']]}
};
const REDUCED={log:null,draw:null,misalign:null,roll:null,total:1700,exitAt:1300,exit:'fade',noise:null,gl:[[[500,0],[520,.15],[640,.15],[660,0]]],brand:[[0,0],[400,1]],reveal:[[0,1]],by:[[300,0],[700,1]],out:[[1300,0],[1700,1]],
  phases:[['Fundido',0,400],['Glitch mínimo',500,660],['Calma',400,1300],['Fundido',1300,1700]]};

// Marca y wordmark oficiales: paths de src/components/Logo/GGMark.jsx y
// "GLITCH ▪ GANG" como GGWordmark.jsx. Si cambian allí, actualizar aquí.
const MARK='<svg class="pl-mark" viewBox="0 0 464 280"><path d="M0 234V46L46 0H185.2L230.4 45.2V88H176V65.2L157.2 46.4H74.8L54.4 66.8V213.2L74.8 233.6H158L177.6 214V170.4H117.6V124H230.4V234L184.4 280H46L0 234Z"/><path d="M233.312 234V46L279.312 0H418.513L463.713 45.2V88H409.312V65.2L390.513 46.4H308.113L287.712 66.8V213.2L308.113 233.6H391.312L410.913 214V170.4H350.913V124H463.713V234L417.713 280H279.312L233.312 234Z"/><path class="notch" d="M419.5 1.52588e-05L464 44.8618V62L293 1.52588e-05H328.5H419.5Z"/></svg>';
function lockup(){
  const ch=WORD.split('').map((c,i)=>(i===6?'<span class="dot"></span>':'')+`<span class="ch" data-i="${i}"><i>${c}</i><em></em></span>`).join('');
  return `<div class="pl-lock">${MARK}<div class="pl-word">${ch}</div></div>`;
}

let actx=null;
function audio(){if(!actx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;actx=new C()}if(actx.state==='suspended')actx.resume();return actx}
function zap(kind){
  const a=audio();if(!a)return;const t=a.currentTime;
  const len=kind==='off'?.28:.09,buf=a.createBuffer(1,a.sampleRate*len,a.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src=a.createBufferSource();src.buffer=buf;
  const f=a.createBiquadFilter();f.type='bandpass';f.Q.value=kind==='off'?.7:4;
  f.frequency.setValueAtTime(kind==='off'?900:2400,t);f.frequency.exponentialRampToValueAtTime(kind==='off'?120:700,t+len);
  const g=a.createGain();g.gain.setValueAtTime(.14,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
  src.connect(f).connect(g).connect(a.destination);src.start(t);
  if(kind==='off'){const o=a.createOscillator(),og=a.createGain();o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(30,t+.25);og.gain.setValueAtTime(.12,t);og.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(og).connect(a.destination);o.start(t);o.stop(t+.26)}
}

function create(root,opts={}){
  const base=VARIANTS[opts.variant||'A'];
  const V=opts.reduced?Object.assign({},base,REDUCED,{id:base.id,name:base.name}):base;
  const seed=opts.seed||7;
  root.classList.add('pl','pl--'+V.exit);
  const W=root.clientWidth||1,H=root.clientHeight||1;
  let cover='';
  if(V.exit==='strips'){for(let i=0;i<10;i++)cover+=`<i style="left:0;right:0;top:${i*10}%;height:calc(10% + 1px)"></i>`}
  const cols=10,rows=Math.min(24,Math.max(5,Math.round(cols*H/W)));
  if(V.exit==='blocks'){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cover+=`<i style="left:${c*100/cols}%;top:${r*100/rows}%;width:calc(${100/cols}% + 1px);height:calc(${100/rows}% + 1px)"></i>`}
  let slices='';for(let i=0;i<SLICES;i++){const a=i*100/SLICES,b=100-(i+1)*100/SLICES;slices+=`<div class="pl-s" style="clip-path:inset(${a}% -20% ${b}% -20%)">${lockup()}</div>`}
  root.innerHTML=`<div class="pl-cover">${cover}</div><div class="pl-screen"><canvas class="pl-noise" width="160" height="100"></canvas><div class="pl-roll"></div><div class="pl-bars">${'<i></i>'.repeat(BARS)}</div><div class="pl-log"></div><div class="pl-center"><div class="pl-brand"><div class="pl-r">${lockup()}</div><div class="pl-l pl-c">${lockup()}</div>${slices}<div class="pl-by">BY STELIANT</div></div></div><div class="pl-scan"></div><div class="pl-vig"></div></div><div class="pl-skip">TOCA O PULSA UNA TECLA PARA SALTAR</div>`;
  const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
  const screen=$('.pl-screen'),canvas=$('.pl-noise'),ctx=canvas.getContext('2d'),roll=$('.pl-roll'),bars=$$('.pl-bars i'),log=$('.pl-log'),center=$('.pl-center'),brand=$('.pl-brand'),by=$('.pl-by');
  const rL=$('.pl-r'),cL=$('.pl-c'),sL=$$('.pl-s'),marks=$$('.pl-mark'),coverEls=$$('.pl-cover i');
  const chars=WORD.split('').map((_,i)=>$$(`.ch[data-i="${i}"]`).map(el=>({i:el.firstChild,em:el.lastChild})));
  const blockThr=coverEls.map((_,i)=>rng(seed*31+i)()*.82);
  let lastTick=-1,prevGl=0,exitFired=false;

  function drawNoise(tick,op){
    canvas.style.opacity=op;if(op<=0)return;
    const r=rng(seed*977+tick),img=ctx.createImageData(160,100),d=img.data;
    for(let i=0;i<d.length;i+=4){const v=r()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
    ctx.putImageData(img,0,0);
  }
  function render(t){
    const tick=Math.floor(t/66),r=rng(seed*1000+tick);
    const gl=envMax(V.gl,t),mis=env(V.misalign,t),reveal=env(V.reveal,t),ex=env(V.out,t);
    if(tick!==lastTick){drawNoise(tick,env(V.noise,t)*.5);lastTick=tick}
    const ro=env(V.roll,t);roll.style.opacity=ro>0&&ro<1?1:0;roll.style.top=(-25+ro*125)+'%';
    bars.forEach(b=>{const on=r()<gl*.8;b.style.opacity=on?1:0;if(on){b.style.top=r()*96+'%';b.style.height=(.6+r()*7)+'%';b.style.transform=`translateX(${((r()*2-1)*gl*8).toFixed(2)}%)`}});
    const off=gl*.06+mis*.04;
    rL.style.transform=`translate(${-off}em,${((r()-.5)*gl*.03).toFixed(3)}em)`;cL.style.transform=`translate(${off}em,0)`;
    const rgbOp=Math.min(.9,gl*2.2+mis*.6);rL.style.opacity=cL.style.opacity=rgbOp;
    sL.forEach((s,i)=>{const j=r()<gl*.9?(r()*2-1)*gl*.35:0;s.style.transform=`translateX(${(SLICE_BASE[i]*mis*.9+j).toFixed(3)}em)`});
    brand.style.opacity=env(V.brand,t);
    chars.forEach((els,i)=>{const locked=reveal>=(ORDER[i]+1)/10-1e-6,g=locked?'':GLYPHS[Math.floor(r()*GLYPHS.length)];els.forEach(e=>{e.i.style.visibility=locked?'visible':'hidden';e.em.textContent=g})});
    const dr=V.draw?env(V.draw,t):1;marks.forEach(m=>m.style.opacity=dr);
    by.style.opacity=env(V.by,t);
    if(V.log){const n=env(V.log,t);log.innerHTML=LOG.map((l,i)=>{const q=clamp(n-i);if(q<=0)return'';const s=l.slice(0,Math.ceil(l.length*q));return i===3?`<b>${s}</b>`:s}).filter(Boolean).join('\n')+(n<4&&tick%2?'▌':'')}
    // salida
    root.classList.remove('pl--glow');screen.style.transform='';root.style.opacity='';
    const content=V.exit==='crt'||V.exit==='fade'?1:1-clamp(ex*4);center.style.opacity=log.style.opacity=content;
    if(V.exit==='crt'&&ex>0){const a=smooth(clamp(ex/.5)),b=smooth(clamp((ex-.5)/.3)),c=clamp((ex-.8)/.2);screen.style.transform=`scale(${1-b*.99},${1-a*.994})`;if(a>.7)root.classList.add('pl--glow');root.style.opacity=1-c}
    if(V.exit==='strips')coverEls.forEach((s,i)=>{const q=smooth(clamp(ex*1.5-Math.abs(i-4.5)*.07));s.style.transform=`translateX(${(i%2?1:-1)*q*102}%)`});
    if(V.exit==='blocks')coverEls.forEach((s,i)=>{const th=blockThr[i];s.style.opacity=ex>th?0:1;s.style.background=ex>th-.07&&ex<=th?'rgba(var(--accent-rgb),.28)':''});
    if(V.exit==='fade')root.style.opacity=1-smooth(ex);
    if(opts.sound){if(gl>.55&&prevGl<=.55)zap('zap');if(!exitFired&&ex>0){exitFired=true;zap(V.exit==='crt'?'off':'zap')}}
    prevGl=gl;
  }

  let raf=0,start=0,done=false,skipped=false;
  function frame(now){
    // opts.hold(): mientras devuelva true, se congela en la calma justo antes de la salida
    if(opts.hold&&now-start>V.exitAt-1&&opts.hold())start=now-(V.exitAt-1);
    const t=now-start;render(Math.min(t,V.total));
    if(t>=V.total){finish();return}
    raf=requestAnimationFrame(frame);
  }
  function finish(){if(done)return;done=true;cancelAnimationFrame(raf);root.classList.remove('pl--live');unbind();opts.onDone&&opts.onDone()}
  function skip(){if(done||skipped)return;skipped=true;const t=performance.now()-start;if(t<V.exitAt)start-=V.exitAt-t}
  const onKey=e=>{if(e.key==='Tab')return;skip()};
  function bind(){root.addEventListener('pointerdown',skip);window.addEventListener('keydown',onKey)}
  function unbind(){root.removeEventListener('pointerdown',skip);window.removeEventListener('keydown',onKey)}
  function play(){done=false;skipped=false;exitFired=false;prevGl=0;root.classList.add('pl--live');if(opts.skippable!==false)bind();start=performance.now();raf=requestAnimationFrame(frame)}
  function destroy(){cancelAnimationFrame(raf);unbind();root.innerHTML='';root.className=root.className.replace(/\bpl[\w-]*/g,'').trim();root.removeAttribute('style')}
  render(0);
  return{play,render,skip,destroy,variant:V,get done(){return done}};
}

const KEY='gg-intro-v3';
function once(opts={}){
  const reduced=opts.reduced??matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!opts.force&&sessionStorage.getItem(KEY))return null;
  const el=document.createElement('div');el.className='pl--fixed';el.setAttribute('role','presentation');document.body.appendChild(el);
  document.documentElement.style.overflow='hidden';
  const p=create(el,Object.assign({},opts,{reduced,onDone(){sessionStorage.setItem(KEY,'1');document.documentElement.style.overflow='';el.remove();opts.onDone&&opts.onDone()}}));
  p.play();return p;
}
window.GGPreloader={create,once,VARIANTS,REDUCED,zap};
})();

