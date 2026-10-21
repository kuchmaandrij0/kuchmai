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
const roadImage = new Image();
const chassisImage = new Image();
let roadPattern=null;
let mechanicalSprites=[];
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
// Rim centres and ellipse axes measured in the original image's 1000-unit space.
const wheelRegions = [
  {x:576,y:495,rx:80,ry:119,tilt:.075,rimRx:60,rimRy:87,
    outline:[[578,376],[614,388],[641,425],[654,469],[653,520],[636,568],[606,604],[565,614],[532,601],[507,574],[489,540],[515,518],[527,480],[536,435],[552,396]]},
  {x:928,y:459,rx:50,ry:96,tilt:.04,rimRx:28,rimRy:70,
    outline:[[925,367],[953,378],[973,412],[980,459],[971,505],[951,541],[922,555],[893,540],[878,511],[873,470],[881,421],[900,380]]}
];
const travelSpeed = 3.2; // metres per second; both axles share the same angular speed.
const tyreRadius = .34;
const angularSpeed = travelSpeed / tyreRadius;
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
  wheelSprites=wheelRegions.map(wheel=>{
    const tyre=sprite(c=>{
      const rubber=c.createRadialGradient(wheel.x-18,wheel.y-25,10,wheel.x,wheel.y,wheel.ry);
      rubber.addColorStop(0,'#30343a');rubber.addColorStop(.75,'#171b20');rubber.addColorStop(1,'#080b0e');
      c.beginPath();c.ellipse(wheel.x,wheel.y,wheel.rx,wheel.ry,wheel.tilt,0,Math.PI*2);c.fillStyle=rubber;c.fill();
      polygon(c,wheel.outline);c.clip();c.drawImage(image,0,0,1000,sourceHeight);
    });
    // Inverse projection converts the photographed ellipse to a circular rim.
    const rim=document.createElement('canvas');rim.width=rim.height=256;
    const rc=rim.getContext('2d');rc.beginPath();rc.arc(128,128,128,0,Math.PI*2);rc.clip();
    rc.translate(128,128);rc.scale(128/wheel.rimRx,128/wheel.rimRy);rc.rotate(-wheel.tilt);rc.translate(-wheel.x,-wheel.y);
    rc.drawImage(image,0,0,1000,sourceHeight);
    return {...wheel,image:tyre,rim};
  });
  bodySprites=bodyRegions.map(part=>({...part,image:sprite(c=>{polygon(c,part.polygon);c.clip();c.drawImage(image,0,0,1000,sourceHeight);c.globalCompositeOperation='destination-out';for(const w of wheelRegions){polygon(c,w.outline);c.fill();}})}));
}
function resize(){const rect=stage.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!running)draw(elapsed);}
function drawRoad(t, active){
  ctx.fillStyle='#1b2630';ctx.fillRect(0,0,width,height);
  if(roadImage.complete&&roadImage.naturalWidth){
    const scale=Math.max(width/roadImage.naturalWidth,height/roadImage.naturalHeight);
    const rw=roadImage.naturalWidth*scale,rh=roadImage.naturalHeight*scale;
    ctx.drawImage(roadImage,(width-rw)/2,(height-rh)/2,rw,rh);
    // Only asphalt grain flows. Continuous lane lines keep their true perspective.
    if(roadPattern&&active&&!reduced.matches){
      ctx.save();
      const shift=t*travelSpeed*145;
      roadPattern.setTransform(new DOMMatrix().translate(shift,-shift*.13).rotate(-7.5).scale(.9));
      ctx.fillStyle=roadPattern;ctx.globalAlpha=.13;
      ctx.fillRect(0,height*.49,width,height*.51);
      ctx.restore();
    }
  }
  const grade=ctx.createLinearGradient(0,0,0,height);
  grade.addColorStop(0,'#050a1477');grade.addColorStop(.35,'#050a140c');grade.addColorStop(.7,'#050a140c');grade.addColorStop(1,'#050a1477');
  ctx.fillStyle=grade;ctx.fillRect(0,0,width,height);
}
function prepareMechanics(){
  const masks={battery:[[350,374],[635,326],[850,372],[680,454]],motor:[[180,340],[370,340],[445,435],[325,494],[180,455]]};
  const removeTyres=c=>{
    c.globalCompositeOperation='destination-out';
    c.beginPath();c.ellipse(563,495,105,133,.13,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(934,426,62,116,.06,0,Math.PI*2);c.fill();
    c.globalCompositeOperation='source-over';
  };
  const platform=sprite(c=>{c.drawImage(chassisImage,0,0,1000,sourceHeight);removeTyres(c);c.globalCompositeOperation='destination-out';Object.values(masks).forEach(points=>{polygon(c,points);c.fill();});});
  const component=key=>sprite(c=>{polygon(c,masks[key]);c.clip();c.drawImage(chassisImage,0,0,1000,sourceHeight);removeTyres(c);});
  mechanicalSprites=[{image:platform,step:1,offset:[520,-90]},{image:component('battery'),step:2,offset:[-110,-320]},{image:component('motor'),step:3,offset:[-420,-140]}];
}
function chassis(t){
  for(const part of mechanicalSprites){const p=easeOut((t-starts[part.step])/1.3);if(p<=0)continue;ctx.save();ctx.translate(part.offset[0]*(1-p),part.offset[1]*(1-p));ctx.globalAlpha*=p;ctx.drawImage(part.image,0,0);ctx.restore();}
}
function drawWheel(w,index,t,tyre=true,rim=true){
  const p=easeOut((t-index*.14)/1.2);if(p<=0)return;
  const offset=(1-p)*(index===1?700:-650);
  ctx.save();ctx.translate(offset,0);ctx.globalAlpha=p;
  if(tyre)ctx.drawImage(w.image,0,0);
  if(!rim){ctx.restore();return;}
  // Project a rotating circle back to its fixed ellipse; the tyre never wobbles.
  ctx.translate(w.x,w.y);ctx.rotate(w.tilt);ctx.scale(w.rimRx,w.rimRy);
  ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.clip();
  const angle=reduced.matches?0:-t*angularSpeed;
  const exposure=reduced.matches?[0]:[-.055,-.018,.018,.055];
  for(const blur of exposure){ctx.save();ctx.globalAlpha=p/exposure.length;ctx.rotate(angle+blur);ctx.drawImage(w.rim,-1,-1,2,2);ctx.restore();}
  ctx.restore();
}
function drawBody(t){
  for(const p of bodySprites){const raw=clamp((t-starts[p.step]-p.delay)/1.55);if(raw<=0)continue;const e=easeOut(raw);const bounce=0;ctx.save();ctx.translate(500+p.offset[0]*(1-e),350+p.offset[1]*(1-e)+bounce);ctx.rotate(p.rotation*(1-e));ctx.translate(-500,-350);ctx.globalAlpha=clamp(raw*4);ctx.drawImage(p.image,0,0);ctx.restore();
  }
}
function draw(t){
  if(!width||!ctx)return;ctx.save();drawRoad(t,running||complete);
  if(ready&&(running||complete)){
    const carWidth=Math.min(width*.84,height*1.68);const scale=carWidth/1000;const left=(width-carWidth)*.5;const top=height*.52-sourceHeight*scale*.5;
    ctx.save();const suspension=0;ctx.translate(left,top+suspension);ctx.scale(scale,scale);
    // Contact shadows remain at the exact tyre contact patches.
    for(const w of wheelRegions){const shadow=ctx.createRadialGradient(w.x,w.y+w.ry-1,1,w.x,w.y+w.ry-1,50);shadow.addColorStop(0,'#000b');shadow.addColorStop(1,'#0000');ctx.save();ctx.translate(w.x,w.y+w.ry-1);ctx.scale(1,.22);ctx.translate(-w.x,-w.y-w.ry+1);ctx.fillStyle=shadow;ctx.fillRect(w.x-55,w.y+w.ry-55,110,110);ctx.restore();}
    const coverage=smooth((t-8)/2.3);ctx.save();ctx.globalAlpha=1-coverage;chassis(t);ctx.restore();

    if(t<duration)wheelSprites.forEach((w,i)=>drawWheel(w,i,t,true,false));
    if(t>=duration){ctx.drawImage(image,0,0,1000,sourceHeight);}else drawBody(t);
    // Far tyre is behind the bumper once the body closes around it.
    wheelSprites.forEach((w,i)=>drawWheel(w,i,t,false,true));


    ctx.restore();
  }
  ctx.restore();
}
function updateUI(t){const next=Math.min(5,starts.filter(s=>s<=t).length-1);if(next!==step){step=next;status.textContent=labels[step];counter.textContent=`0${step+1} / 06`;steps.forEach((el,i)=>{el.classList.toggle('is-active',i===step);el.classList.toggle('is-done',i<step);});}progressBar.style.transform=`scaleX(${clamp(t/duration)})`;}
function tick(now){frame=0;if(!visible||document.hidden)return;elapsed=Math.max(complete?duration:0,(now-startedAt)/1000);if(running){updateUI(Math.min(elapsed,duration));if(elapsed>=duration)finish();}draw(elapsed);if((running||complete)&&!reduced.matches)frame=requestAnimationFrame(tick);}
function finish(){running=false;complete=true;stage.dataset.state='complete';stage.setAttribute('aria-busy','false');status.textContent='Honda M-NV. Собрана на ходу.';counter.textContent='06 / 06';steps.forEach(el=>{el.classList.remove('is-active');el.classList.add('is-done');});replay.hidden=false;progressBar.style.transform='scaleX(1)';}
function showStillFinish(){const now=performance.now();elapsed=duration;startedAt=now-duration*1000;if(pausedAt!==null)pausedAt=now;updateUI(duration);finish();draw(duration);}
function start(){if(!ready||running||complete)return;running=true;step=-1;elapsed=0;pausedAt=null;startedAt=performance.now();stage.dataset.state='building';stage.setAttribute('aria-busy','true');startButton.hidden=true;replay.hidden=true;if(reduced.matches){showStillFinish();}else frame=requestAnimationFrame(tick);}
function reset(){cancelAnimationFrame(frame);running=complete=false;steps.forEach(el=>el.classList.remove('is-active','is-done'));start();}
function syncVisibility(){const active=visible&&!document.hidden;if(!active){if((running||complete)&&pausedAt===null)pausedAt=performance.now();cancelAnimationFrame(frame);frame=0;}else{if(pausedAt!==null){startedAt+=performance.now()-pausedAt;pausedAt=null;}if((running||complete)&&!reduced.matches&&!frame)frame=requestAnimationFrame(tick);else draw(elapsed);}}
async function loadAssets(){
  startButton.disabled=true;
  image.src='assets/honda-mnv.png';roadImage.src='assets/mnv-road.png';chassisImage.src='assets/mnv-chassis.png';
  try{
    await Promise.all([image.decode(),roadImage.decode(),chassisImage.decode()]);
    prepareSprites();prepareMechanics();
    const grain=document.createElement('canvas');grain.width=512;grain.height=128;
    grain.getContext('2d').drawImage(roadImage,roadImage.naturalWidth*.3,roadImage.naturalHeight*.84,roadImage.naturalWidth*.35,roadImage.naturalHeight*.14,0,0,512,128);
    roadPattern=ctx.createPattern(grain,'repeat');
    ready=true;startButton.disabled=false;stage.dataset.asset='ready';draw(elapsed);
  }catch(error){stage.dataset.asset='error';status.textContent='Не удалось загрузить сцену. Обнови страницу, чтобы повторить.';startButton.querySelector('strong').textContent='ИЗОБРАЖЕНИЕ НЕ ЗАГРУЗИЛОСЬ';startButton.querySelector('small').textContent='Обнови страницу и попробуй ещё раз.';}
}
loadAssets();
startButton.addEventListener('click',start);
stage.addEventListener('click',event=>{if(!event.target.closest('button'))start();});
replay.addEventListener('click',reset);
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncVisibility();},{threshold:.08}).observe(stage);
document.addEventListener('visibilitychange',syncVisibility);
reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;if(reduced.matches&&(running||complete)){showStillFinish();}else syncVisibility();});
