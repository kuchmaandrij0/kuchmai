const stage = document.querySelector('.assembly-stage');
const canvas = document.querySelector('#assembly-canvas');
const startButton = document.querySelector('.assembly-start');
const replay = document.querySelector('.assembly-replay');
const status = document.querySelector('.assembly-status');
const counter = document.querySelector('.assembly-counter');
const progressBar = document.querySelector('.assembly-progress span');
const steps = [...document.querySelectorAll('.assembly-steps li')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ctx = canvas.getContext('2d', {alpha: false});
const image = new Image();
const duration = 12;
const starts = [0, 1.7, 3.2, 4.6, 6.2, 9.3];
const labels = ['Колёса уже в движении.','Шасси догоняет колёса и встаёт на место.','Батарея подключается на ходу.','Электромотор: теперь есть тяга.','Панели кузова собираются вокруг платформы.','Фары, бамперы, последние детали. Поехали.'];
const clamp = (n, a=0, b=1) => Math.max(a, Math.min(b, n));
const easeOut = t => 1 - (1-clamp(t)) ** 4;
const smooth = t => {t=clamp(t);return t*t*(3-2*t);};
let width = 0, height = 0, ready = false, frame = 0;
let startedAt = 0, pausedAt = null, elapsed = 0;
let running = false, complete = false, visible = false, step = -1;
let wheelSprites = [], bodySprites = [], sourceHeight = 660;
// These regions share one photograph, so the assembled silhouette stays coherent.
const wheelRegions = [
  {x:575,y:498,rx:79,ry:112,tilt:.18},
  {x:923,y:459,rx:43,ry:92,tilt:.08},
  {x:155,y:527,rx:66,ry:60,far:true}
];
const bodyRegions = [
  {id:'cabin',step:4,delay:0,offset:[80,-580],rotation:-.12,polygon:[[0,0],[1000,0],[1000,225],[860,225],[680,250],[600,230],[270,230],[0,250]]},
  {id:'rear',step:4,delay:.45,offset:[780,-160],rotation:.2,polygon:[[860,225],[1000,225],[1000,666],[850,666],[840,330]]},
  {id:'doors',step:4,delay:.9,offset:[500,120],rotation:-.2,polygon:[[600,230],[680,250],[860,225],[840,330],[850,666],[480,666],[480,360]]},
  {id:'hood',step:4,delay:1.4,offset:[-550,-400],rotation:.18,polygon:[[0,250],[270,230],[600,230],[480,360],[0,360]]},
  {id:'bumper',step:5,delay:0,offset:[-700,200],rotation:-.08,polygon:[[0,360],[480,360],[480,666],[0,666]]}
];
function polygon(context, points){context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();}
function sprite(draw){const c=document.createElement('canvas');c.width=1000;c.height=sourceHeight;const cctx=c.getContext('2d');draw(cctx);return c;}
function prepareSprites(){
  sourceHeight=1000*image.naturalHeight/image.naturalWidth;
  wheelSprites=wheelRegions.map(wheel=>({ ...wheel, image:sprite(c=>{
    const tyre=c.createRadialGradient(wheel.x-15,wheel.y-15,5,wheel.x,wheel.y,wheel.ry);
    tyre.addColorStop(0,'#252b32');tyre.addColorStop(.7,'#15191e');tyre.addColorStop(1,'#06090d');
    c.beginPath();c.ellipse(wheel.x,wheel.y,wheel.rx,wheel.ry,wheel.tilt||0,0,Math.PI*2);c.fillStyle=tyre;c.fill();
    if(!wheel.far){c.save();c.beginPath();c.ellipse(wheel.x,wheel.y,wheel.rx*.88,wheel.ry*.87,wheel.tilt||0,0,Math.PI*2);c.clip();c.drawImage(image,0,0,1000,sourceHeight);c.restore();}
    else{c.beginPath();c.ellipse(wheel.x,wheel.y,wheel.rx*.65,wheel.ry*.65,0,0,Math.PI*2);c.strokeStyle='#4b535d';c.lineWidth=8;c.stroke();}
  }) }));
  bodySprites=bodyRegions.map(part=>({...part,image:sprite(c=>{polygon(c,part.polygon);c.clip();c.drawImage(image,0,0,1000,sourceHeight);c.globalCompositeOperation='destination-out';for(const w of wheelRegions){c.beginPath();c.ellipse(w.x,w.y,w.rx-1,w.ry-1,0,0,Math.PI*2);c.fill();}})}));
}
function resize(){const rect=stage.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!running)draw(elapsed);}
function drawRoad(t, active){
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#080d15');bg.addColorStop(.5,'#15202c');bg.addColorStop(1,'#0a0f16');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*.6,height*.46,0,width*.6,height*.46,width*.65);glow.addColorStop(0,'#18334466');glow.addColorStop(1,'#10182500');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  const horizon=height*.47;ctx.fillStyle='#080c12';ctx.fillRect(0,horizon,width,height-horizon);
  // Travelling road texture: the car stays in frame while the world passes it.
  const motion=active?t:0;
  for(let i=0;i<35;i++){let x=((i*113+motion*330)%(width+300))-150;const y=horizon+((i*61)%(height*.6));ctx.strokeStyle=i%4===0?'#52637525':'#69809312';ctx.lineWidth=i%4===0?1.5:.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+40+(y-horizon)*.3,y+6);ctx.stroke();}
  ctx.save();ctx.setLineDash([width*.1,width*.12]);ctx.lineDashOffset=-motion*width*.55;ctx.strokeStyle='#c1d2dd28';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-width*.4,height*.69);ctx.lineTo(width*1.4,height*1.08);ctx.stroke();ctx.restore();
  ctx.strokeStyle='#ff4b4533';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-width*.2,height*.55);ctx.lineTo(width*1.2,height*.77);ctx.stroke();
  if(active){ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle='#9ac5df';for(let i=0;i<8;i++){const x=(i*191+t*700)%(width+400)-200;const y=height*.22+i%3*height*.08;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+30+i*7,y+3);ctx.stroke();}ctx.restore();}
  const vignette=ctx.createLinearGradient(0,0,0,height);vignette.addColorStop(0,'#05080d88');vignette.addColorStop(.4,'#05080d00');vignette.addColorStop(1,'#05080d99');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
}
function chassis(t){
  const platform=easeOut((t-starts[1])/1.3);if(platform<=0)return;
  ctx.save();ctx.translate((1-platform)*650,-(1-platform)*160);ctx.globalAlpha=platform;
  const deck=[[155,500],[650,354],[923,425],[575,490]];
  polygon(ctx,deck);ctx.fillStyle='#293441';ctx.fill();ctx.strokeStyle='#93a3ae';ctx.lineWidth=4;ctx.stroke();
  polygon(ctx,[[155,500],[575,490],[575,508],[155,518]]);ctx.fillStyle='#111a24';ctx.fill();
  for(let i=0;i<6;i++){ctx.strokeStyle='#72838b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(285+i*68,409-i*11);ctx.lineTo(530+i*53,490-i*16);ctx.stroke();}
  ctx.restore();
  const battery=easeOut((t-starts[2])/1.25);if(battery>0){ctx.save();ctx.translate(-140*(1-battery),-350*(1-battery));ctx.globalAlpha=battery;polygon(ctx,[[345,405],[650,350],[794,402],[504,492]]);ctx.fillStyle='#304c52';ctx.fill();ctx.strokeStyle='#5cbdbe';ctx.lineWidth=3;ctx.stroke();for(let i=0;i<7;i++){ctx.strokeStyle='#769297';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(375+i*38,405-i*7);ctx.lineTo(510+i*35,472-i*11);ctx.stroke();}ctx.restore();}
  const motor=easeOut((t-starts[3])/1.35);if(motor>0){ctx.save();ctx.translate(-440*(1-motor),-170*(1-motor));ctx.globalAlpha=motor;polygon(ctx,[[245,395],[323,365],[397,401],[322,437]]);ctx.fillStyle='#98a7b3';ctx.fill();polygon(ctx,[[245,395],[322,437],[322,471],[245,428]]);ctx.fillStyle='#455666';ctx.fill();polygon(ctx,[[322,437],[397,401],[397,435],[322,471]]);ctx.fillStyle='#647b8b';ctx.fill();ctx.strokeStyle='#fa7d3b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(362,424);ctx.bezierCurveTo(408,406,412,448,450,432);ctx.stroke();ctx.restore();}
}
function drawWheel(w,index,t){
  const p=easeOut((t-index*.2)/1.4);if(p<=0)return;const offset=(1-p)*(index===1?700:-650);
  ctx.save();ctx.translate(offset,0);ctx.globalAlpha=p;ctx.drawImage(w.image,0,0);if(w.far){ctx.restore();return;}
  // Rotate just the wheel face; keep its perspective and tyre silhouette intact.
  const angle=-t*6;
  ctx.save();ctx.translate(w.x,w.y);ctx.scale(w.rx/w.ry,1);ctx.beginPath();ctx.arc(0,0,w.ry*.7,0,Math.PI*2);ctx.clip();ctx.rotate(angle);ctx.scale(w.ry/w.rx,1);ctx.drawImage(image,w.x/1000*image.naturalWidth-w.rx*.72/1000*image.naturalWidth,(w.y-w.ry*.72)/sourceHeight*image.naturalHeight,w.rx*1.44/1000*image.naturalWidth,w.ry*1.44/sourceHeight*image.naturalHeight,-w.rx*.72,-w.ry*.72,w.rx*1.44,w.ry*1.44);ctx.restore();ctx.restore();
}
function drawBody(t){
  for(const p of bodySprites){const raw=clamp((t-starts[p.step]-p.delay)/1.55);if(raw<=0)continue;const e=easeOut(raw);const bounce=Math.sin(raw*Math.PI*3)*(1-raw)*7;ctx.save();ctx.translate(500+p.offset[0]*(1-e),350+p.offset[1]*(1-e)+bounce);ctx.rotate(p.rotation*(1-e));ctx.translate(-500,-350);ctx.globalAlpha=clamp(raw*4);ctx.drawImage(p.image,0,0);ctx.restore();
    if(raw>.86&&raw<1&&!reduced.matches){ctx.save();ctx.globalAlpha=(1-raw)*5;ctx.strokeStyle='#b9f5ef';ctx.lineWidth=1.5;for(let i=0;i<4;i++){const x=430+i*80,y=400+i*7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-30*(1-raw)*8,y-20*(1-raw)*8);ctx.stroke();}ctx.restore();}}
}
function draw(t){
  if(!width||!ctx)return;ctx.save();drawRoad(t,running||complete);
  if(ready&&(running||complete)){
    const carWidth=Math.min(width*.84,height*1.68);const scale=carWidth/1000;const left=(width-carWidth)*.5;const top=height*.52-sourceHeight*scale*.5;
    ctx.save();const suspension=reduced.matches?0:Math.sin(t*8)*.8;ctx.translate(left,top+suspension);ctx.scale(scale,scale);
    const shadow=ctx.createRadialGradient(530,520,20,530,520,420);shadow.addColorStop(0,'#000b');shadow.addColorStop(1,'#0000');ctx.save();ctx.translate(0,390);ctx.scale(1,.25);ctx.fillStyle=shadow;ctx.fillRect(0,0,1000,1000);ctx.restore();
    const coverage=smooth((t-8)/2.3);ctx.save();ctx.globalAlpha=1-coverage;chassis(t);ctx.restore();
    wheelSprites.filter(w=>w.far).forEach(w=>drawWheel(w,2,t));
    if(t>=duration){ctx.drawImage(image,0,0,1000,sourceHeight);}else drawBody(t);
    // Far tyre is behind the bumper once the body closes around it.
    wheelSprites.filter(w=>!w.far).forEach((w,i)=>drawWheel(w,i,t));

    if(t>10){const glowAlpha=smooth((t-10)/1.6)*.3;const head=ctx.createRadialGradient(190,350,0,190,350,90);head.addColorStop(0,`rgba(180,232,255,${glowAlpha})`);head.addColorStop(1,'#99ddff00');ctx.fillStyle=head;ctx.fillRect(80,260,220,170);}
    ctx.restore();
  }
  ctx.restore();
}
function updateUI(t){const next=Math.min(5,starts.filter(s=>s<=t).length-1);if(next!==step){step=next;status.textContent=labels[step];counter.textContent=`0${step+1} / 06`;steps.forEach((el,i)=>{el.classList.toggle('is-active',i===step);el.classList.toggle('is-done',i<step);});}progressBar.style.transform=`scaleX(${clamp(t/duration)})`;}
function tick(now){frame=0;if(!visible||document.hidden)return;elapsed=(now-startedAt)/1000;if(running){updateUI(Math.min(elapsed,duration));if(elapsed>=duration)finish();}draw(elapsed);if((running||complete)&&!reduced.matches)frame=requestAnimationFrame(tick);}
function finish(){running=false;complete=true;stage.dataset.state='complete';stage.setAttribute('aria-busy','false');status.textContent='Honda M-NV. Собрана на ходу.';counter.textContent='06 / 06';steps.forEach(el=>{el.classList.remove('is-active');el.classList.add('is-done');});replay.hidden=false;progressBar.style.transform='scaleX(1)';}
function start(){if(!ready||running||complete)return;running=true;step=-1;elapsed=0;pausedAt=null;startedAt=performance.now();stage.dataset.state='building';stage.setAttribute('aria-busy','true');startButton.hidden=true;replay.hidden=true;if(reduced.matches){elapsed=duration;updateUI(duration);finish();draw(duration);}else frame=requestAnimationFrame(tick);}
function reset(){cancelAnimationFrame(frame);running=complete=false;steps.forEach(el=>el.classList.remove('is-active','is-done'));start();}
function syncVisibility(){const active=visible&&!document.hidden;if(!active){if((running||complete)&&pausedAt===null)pausedAt=performance.now();cancelAnimationFrame(frame);frame=0;}else{if(pausedAt!==null){startedAt+=performance.now()-pausedAt;pausedAt=null;}if((running||complete)&&!reduced.matches&&!frame)frame=requestAnimationFrame(tick);else draw(elapsed);}}
image.onload=()=>{ready=true;prepareSprites();startButton.disabled=false;stage.dataset.asset='ready';draw(elapsed);};
image.onerror=()=>{stage.dataset.asset='error';status.textContent='Не удалось загрузить Honda M-NV. Обнови страницу, чтобы повторить.';startButton.querySelector('strong').textContent='ИЗОБРАЖЕНИЕ НЕ ЗАГРУЗИЛОСЬ';startButton.querySelector('small').textContent='Обнови страницу и попробуй ещё раз.';};
startButton.disabled=true;
image.src='assets/honda-mnv.png';
startButton.addEventListener('click',start);
stage.addEventListener('click',event=>{if(!event.target.closest('button'))start();});
replay.addEventListener('click',reset);
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncVisibility();},{threshold:.08}).observe(stage);
document.addEventListener('visibilitychange',syncVisibility);
reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;if(reduced.matches&&(running||complete)){elapsed=duration;finish();draw(duration);}else syncVisibility();});
