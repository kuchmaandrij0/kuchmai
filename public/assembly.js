import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const stage = document.querySelector('.assembly-stage');
const canvas = document.querySelector('#assembly-canvas');
const startButton = document.querySelector('.assembly-start');
const replay = document.querySelector('.assembly-replay');
const status = document.querySelector('.assembly-status');
const counter = document.querySelector('.assembly-counter');
const progressBar = document.querySelector('.assembly-progress span');
const steps = [...document.querySelectorAll('.assembly-steps li')];
const fallback = document.querySelector('.assembly-fallback');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const labels = ['Колёса находят своё место.','Платформа соединяет всё воедино.','Энергия внутри: устанавливаем батарею.','Электромотор. Сердце нового движения.','Линии обретают форму. Опускаем кузов.','Последний штрих. Включаем свет.'];
const starts = [0, 1.5, 3, 4.5, 6, 8];
const duration = 10.5;
let renderer, scene, camera, car, floorRing;
let parts = [];
let frame = 0;
let running = false;
let complete = false;
let visible = false;
let startedAt = 0;
let pausedAt = null;
let currentStep = -1;
let pointerX = 0;
let pointerY = 0;
let lastProgress = -1;
const clamp = THREE.MathUtils.clamp;
const smooth = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
const mat = (color, metalness=.5, roughness=.35) => new THREE.MeshStandardMaterial({color, metalness, roughness});

function buildScene() {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = .75;
  scene.fog = new THREE.FogExp2(0x0a0d12,.047);
  camera = new THREE.PerspectiveCamera(35,1,.1,100);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x151922,2.4));
  const key = new THREE.DirectionalLight(0xf1f5ff,4.5);
  key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5});key.shadow.bias=-.002;scene.add(key);
  const rim=new THREE.DirectionalLight(0xff443b,1.25);rim.position.set(3,3,-4);scene.add(rim);
  const fill=new THREE.DirectionalLight(0x88baff,2);fill.position.set(-4,2,-3);scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80),mat(0x0a0d12,.4,.55));
  floor.material.envMapIntensity=0;
  floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(36,60,0x28303c,0x151c25);grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
  floorRing=new THREE.Mesh(new THREE.RingGeometry(3.3,3.31,100),new THREE.MeshBasicMaterial({color:0xff3b37,transparent:true,opacity:.28,side:THREE.DoubleSide}));floorRing.rotation.x=-Math.PI/2;floorRing.position.y=.006;scene.add(floorRing);
  const innerRing=floorRing.clone();innerRing.scale.setScalar(.84);innerRing.material=innerRing.material.clone();innerRing.material.opacity=.1;scene.add(innerRing);
  car=new THREE.Group();car.scale.setScalar(1.12);scene.add(car);
  const white=mat(0xe5e9ed,.68,.24), black=mat(0x0b1018,.25,.38), silver=mat(0xaab7c6,.86,.22), glass=mat(0x101c2c,.72,.12);
  const cyan = new THREE.MeshStandardMaterial({color:0x63d6d2,metalness:.65,roughness:.3,emissive:0x1a7779,emissiveIntensity:.35});
  function box(parent,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function cylinder(parent,r1,r2,h,x,y,z,material,axis='y'){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,40),material);if(axis==='z')mesh.rotation.x=Math.PI/2;if(axis==='x')mesh.rotation.z=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
  function register(group,step,offset,delay=0,spin=0){car.add(group);group.visible=false;parts.push({group,step,offset:new THREE.Vector3(...offset),delay,spin,base:group.position.clone()});return group;}
  for(const x of [-1.43,1.43])for(const z of [-.91,.91]){
    const wheel=new THREE.Group();wheel.position.set(x,.47,z);
    const rubber=mat(0x0d1015,.03,.84);
    cylinder(wheel,.405,.405,.2,0,0,0,rubber,'z');
    for(const offset of [-.055,.055]){const tire=new THREE.Mesh(new THREE.TorusGeometry(.345,.105,12,48),rubber);tire.position.z=offset;tire.castShadow=true;wheel.add(tire);}
    cylinder(wheel,.31,.31,.285,0,0,0,silver,'z');
    cylinder(wheel,.255,.255,.297,0,0,0,black,'z');
    for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;const spoke=box(wheel,.065,.53,.31,0,0,0,silver);spoke.rotation.z=angle;}
    cylinder(wheel,.085,.085,.32,0,0,0,silver,'z');
    register(wheel,0,[x<0?-4:4,.45,z*3],z>0?.22:0,x<0?-Math.PI*3:Math.PI*3);
  }
  const chassis=new THREE.Group();
  box(chassis,4.1,.13,1.53,0,.49,0,black);
  for(const z of [-.68,.68])box(chassis,4.15,.12,.09,0,.58,z,silver);
  for(const x of [-1.43,1.43]){cylinder(chassis,.065,.065,1.9,x,.48,0,silver,'z');for(const z of [-.7,.7]){const spring=cylinder(chassis,.085,.085,.35,x,.68,z,silver);for(let j=0;j<4;j++)cylinder(chassis,.105,.105,.026,x,.53+j*.07,z,black);}}
  register(chassis,1,[0,3.5,0]);
  const battery=new THREE.Group();box(battery,2.25,.19,1.28,.12,.69,0,cyan);
  for(let i=0;i<9;i++)box(battery,.018,.025,1.17,-.86+i*.25,.8,0,silver);
  box(battery,1.8,.012,.04,.1,.812,0,mat(0xf3ca77,.7,.3));register(battery,2,[0,3.8,0]);
  const motor=new THREE.Group();cylinder(motor,.25,.25,.66,-1.38,.9,0,silver,'z');
  box(motor,.58,.25,.44,-1.36,1.06,.1,black);box(motor,.45,.04,.32,-1.36,1.2,.1,cyan);
  for(let j=0;j<5;j++)box(motor,.5,.018,.035,-1.38,1.216,-.04+j*.065,silver);
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.18,.91,.38),new THREE.Vector3(-.8,1,.52),new THREE.Vector3(-.7,.82,.48)]);
  motor.add(new THREE.Mesh(new THREE.TubeGeometry(cable,18,.018,8,false),mat(0xf4782c,.25,.4)));register(motor,3,[-2.8,3,0]);
  const body=new THREE.Group();
  const shape=new THREE.Shape();shape.moveTo(-2.2,.58);shape.lineTo(-2.26,1.04);shape.quadraticCurveTo(-2.2,1.2,-1.63,1.3);shape.lineTo(-1,1.91);shape.quadraticCurveTo(-.84,2.02,-.55,2.04);shape.lineTo(.78,2.04);shape.quadraticCurveTo(1.07,2.02,1.3,1.75);shape.lineTo(1.92,1.34);shape.quadraticCurveTo(2.2,1.26,2.2,1.05);shape.lineTo(2.2,.58);shape.lineTo(1.94,.58);shape.absarc(1.43,.58,.51,0,Math.PI,false);shape.lineTo(-.92,.58);shape.absarc(-1.43,.58,.51,0,Math.PI,false);shape.lineTo(-2.2,.58);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:1.58,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:24});geo.translate(0,0,-.79);const shell=new THREE.Mesh(geo,white);shell.castShadow=true;shell.receiveShadow=true;body.add(shell);
  function panel(points,z,material){const sh=new THREE.Shape();points.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),material);mesh.position.z=z;if(z<0){mesh.material=material.clone();mesh.material.side=THREE.DoubleSide;}body.add(mesh);return mesh;}
  for(const z of [-.852,.852]){
    panel([[-1.5,1.34],[-.91,1.92],[-.11,1.92],[-.11,1.35]],z,glass);
    panel([[.01,1.35],[.01,1.92],[.77,1.92],[1.46,1.35]],z,glass);
    box(body,.035,.73,.012,-.04,1.21,z,black);
    box(body,.18,.025,.022,-.3,1.24,z,silver);box(body,.18,.025,.022,1.05,1.24,z,silver);
    box(body,2.1,.065,.04,.02,.68,z,black);
    const mirror=box(body,.22,.12,.21,-1.23,1.43,z*1.13,black);mirror.rotation.y=z>0?-.18:.18;
  }
  function glassQuad(vertices){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();const material=glass.clone();material.side=THREE.DoubleSide;const mesh=new THREE.Mesh(geometry,material);body.add(mesh);}
  glassQuad([[-1.68,1.37,-.73],[-1.68,1.37,.73],[-1.08,1.98,.72],[-1.08,1.98,-.72]]);
  glassQuad([[1.48,1.74,-.72],[1.48,1.74,.72],[1.99,1.39,.73],[1.99,1.39,-.73]]);
  // Fine shut lines and trim define the sculpted hood and doors.
  for(const z of [-.62,.62]){const line=new THREE.Mesh(new THREE.BoxGeometry(.52,.008,.012),silver);line.position.set(-1.88,1.24,z);line.rotation.z=.12;body.add(line);}
  box(body,.045,.2,1.36,-2.29,.85,black);box(body,.055,.035,1.5,-2.3,1.13,silver);
  box(body,.05,.15,1.3,2.23,.81,black);register(body,4,[0,5.5,0]);
  const details=new THREE.Group();
  const led=new THREE.MeshStandardMaterial({color:0xd5ffff,emissive:0xb0eaff,emissiveIntensity:3,metalness:.15,roughness:.18});
  const rearLED=new THREE.MeshStandardMaterial({color:0xff363b,emissive:0xff2222,emissiveIntensity:2});
  for(const z of [-.56,.56]){box(details,.07,.065,.36,-2.29,1.12,z,led);box(details,.06,.1,.34,2.25,1.13,z,rearLED);}
  box(details,.04,.018,1.05,2.25,1.15,0,rearLED);
  const badgeGroup=new THREE.Group();badgeGroup.position.set(-2.325,1.065,0);
  for(const z of [-.048,.048])box(badgeGroup,.014,.09,.012,0,0,z,silver);box(badgeGroup,.014,.012,.105,0,0,0,silver);details.add(badgeGroup);
  const plateCanvas=document.createElement('canvas');plateCanvas.width=256;plateCanvas.height=64;const ctx=plateCanvas.getContext('2d');ctx.fillStyle='#10131a';ctx.fillRect(0,0,256,64);ctx.fillStyle='#e7edf4';ctx.font='bold 32px Arial';ctx.textAlign='center';ctx.fillText('HONDA M-NV',128,44);const plateMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(plateCanvas)});
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(.6,.15),plateMat);plate.rotation.y=-Math.PI/2;plate.position.set(-2.333,.85,0);details.add(plate);
  register(details,5,[0,.15,0]);
  const headLight=new THREE.SpotLight(0xc5eaff,20,8,.3,.8,1);headLight.position.set(-2.4,1,0);headLight.target.position.set(-6,0,0);details.add(headLight,headLight.target);
  resize();
}

function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
function render(){if(!renderer)return;const aspect=stage.clientWidth/stage.clientHeight;const distance=aspect<1?12.5:8.3;const orbit=running?Math.sin(clamp((performance.now()-startedAt)/1000/duration,0,1)*Math.PI)*.13:0;camera.position.set(-distance*.76+pointerX*.35,4.7+pointerY*.2,distance*.8+orbit);camera.lookAt(0,.8,0);renderer.render(scene,camera);}
function update(time){
  const total=Math.min(duration,(time-startedAt)/1000);
  const fraction=total/duration;
  const step=Math.min(5,starts.filter(t=>t<=total).length-1);
  if(step!==currentStep){currentStep=step;status.textContent=labels[step];counter.textContent=`0${step+1} / 06`;steps.forEach((el,i)=>{el.classList.toggle('is-active',i===step);el.classList.toggle('is-done',i<step);});}
  const percent=Math.floor(fraction*100);if(percent!==lastProgress){progressBar.style.transform=`scaleX(${fraction})`;lastProgress=percent;}
  for(const part of parts){const p=clamp((total-starts[part.step]-part.delay)/1.75,0,1);part.group.visible=total>=starts[part.step]+part.delay;const eased=smooth(p);part.group.position.copy(part.base).addScaledVector(part.offset,1-eased);part.group.rotation.y=part.spin*(1-eased);if(part.step===4&&p>.65)part.group.position.y+=Math.sin((p-.65)/.35*Math.PI*2)*.025*(1-p);}
  for(const group of fallback.querySelectorAll('[data-fallback-step]')){const p=smooth((total-starts[Number(group.dataset.fallbackStep)])/1.5);group.style.opacity=p;group.style.transform=`translateY(${-60*(1-p)}px)`;}
  if(floorRing){floorRing.material.opacity=.2+Math.sin(total*3)*.08;}
  render();
  if(total<duration){frame=requestAnimationFrame(update);}else finish();
}
function finish(){running=false;complete=true;stage.dataset.state='complete';stage.setAttribute('aria-busy','false');status.textContent='Honda M-NV. Готова к новому движению.';counter.textContent='06 / 06';steps.forEach(el=>{el.classList.remove('is-active');el.classList.add('is-done');});replay.hidden=false;progressBar.style.transform='scaleX(1)';replay.focus({preventScroll:true});}
function start(){if(running||complete)return;running=true;currentStep=-1;lastProgress=-1;stage.dataset.state='building';stage.setAttribute('aria-busy','true');startButton.hidden=true;replay.hidden=true;startedAt=performance.now();if(reduced.matches){update(startedAt+duration*1000);}else frame=requestAnimationFrame(update);}
function reset(){cancelAnimationFrame(frame);running=false;complete=false;pausedAt=null;parts.forEach(p=>p.group.visible=false);steps.forEach(el=>el.classList.remove('is-active','is-done'));fallback.querySelectorAll('[data-fallback-step]').forEach(el=>el.style.opacity='0');start();}
try{buildScene();}catch(error){renderer?.dispose();renderer=null;canvas.hidden=true;fallback.removeAttribute('hidden');fallback.querySelectorAll('[data-fallback-step]').forEach(el=>el.style.opacity='0');stage.querySelector('.assembly-render-label').textContent='ASSEMBLY / 01';}
startButton.addEventListener('click',start);
stage.addEventListener('click',event=>{if(!event.target.closest('button'))start();});
replay.addEventListener('click',reset);
stage.addEventListener('pointermove',event=>{if(!complete||!renderer||event.pointerType==='touch')return;const r=stage.getBoundingClientRect();pointerX=(event.clientX-r.left)/r.width-.5;pointerY=(event.clientY-r.top)/r.height-.5;render();});
stage.addEventListener('pointerleave',()=>{pointerX=pointerY=0;if(complete)render();});
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible&&running&&pausedAt===null){pausedAt=performance.now();cancelAnimationFrame(frame);}else if(visible&&running&&pausedAt!==null){startedAt+=performance.now()-pausedAt;pausedAt=null;frame=requestAnimationFrame(update);}else if(visible)render();},{threshold:.05}).observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&pausedAt===null){pausedAt=performance.now();cancelAnimationFrame(frame);}else if(!document.hidden&&visible&&running&&pausedAt!==null){startedAt+=performance.now()-pausedAt;pausedAt=null;frame=requestAnimationFrame(update);}});
reduced.addEventListener('change',()=>{if(reduced.matches&&running){cancelAnimationFrame(frame);update(startedAt+duration*1000);}});
