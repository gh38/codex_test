import * as THREE from 'three';
import '../style.css';
import { BLOCKS, WORLD, VoxelWorld, traceBlock } from './world.js';
import { PLAYER, Player, overlapsPlayer } from './physics.js';

const $ = selector => document.querySelector(selector);
const world = new VoxelWorld();
const player = new Player();
const keys = new Set();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
} catch (error) {
  $('#fatal').hidden=false;
  $('#fatal').textContent='3D 화면을 시작하지 못했습니다. WebGL을 지원하는 데스크톱 브라우저에서 하드웨어 가속을 켜고 다시 열어 주세요.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setClearColor(0xbdd8dd);
$('#scene').append(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xbdd8dd,32,85);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,140);
camera.rotation.order='YXZ';
scene.add(new THREE.HemisphereLight(0xfffbe4,0x7b9375,2.4));
const sun=new THREE.DirectionalLight(0xffedca,2.5);
sun.position.set(-18,35,20);
scene.add(sun);

// 모든 블록이 공유하는 작은 픽셀 무늬를 직접 만들어 외부 이미지 없이 실행합니다.
function texture(color, kind='side') {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=16;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=color;ctx.fillRect(0,0,16,16);
  let seed=42;
  for(let i=0;i<100;i++) {
    seed=(seed*1664525+1013904223)>>>0;
    const x=seed%16,y=(seed>>>8)%16;
    ctx.fillStyle=i%2?'#ffffff12':'#00000012';
    ctx.fillRect(x,y,1+(seed%2),1+(seed%2));
  }
  if(kind==='grass-side') {ctx.fillStyle='#80a656';ctx.fillRect(0,0,16,4);ctx.fillRect(2,4,3,2);ctx.fillRect(10,4,4,1);}
  if(kind==='wood') {ctx.fillStyle='#63462635';for(let i=2;i<16;i+=4)ctx.fillRect(i,0,1,16);}
  if(kind==='wood-top') {ctx.strokeStyle='#79563270';for(let i=2;i<8;i+=2)ctx.strokeRect(i,i,16-i*2,16-i*2);}
  const map=new THREE.CanvasTexture(canvas);
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestMipmapLinearFilter;map.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({map});
}
const materials=Object.fromEntries(BLOCKS.map(block=>[block.id,texture(block.color,block.id===4?'wood':'side')]));
const grassSide=texture('#a47b54','grass-side');
materials[1]=[grassSide,grassSide,texture('#80a656'),materials[2],grassSide,grassSide];
const woodSide=materials[4],woodTop=texture('#bf9864','wood-top');
materials[4]=[woodSide,woodSide,woodTop,woodTop,woodSide,woodSide];
const blockGeometry=new THREE.BoxGeometry(1,1,1);
const terrain=new THREE.Group();scene.add(terrain);
const matrix=new THREE.Matrix4();
function rebuildTerrain() {
  for(const mesh of [...terrain.children]) {terrain.remove(mesh);mesh.dispose();}
  const visible=new Map(BLOCKS.map(block=>[block.id,[]]));
  for(const [key,type] of world.blocks) {
    const [x,y,z]=key.split(',').map(Number);
    if(world.exposed(x,y,z))visible.get(type).push([x,y,z]);
  }
  for(const [type,positions] of visible) {
    if(!positions.length)continue;
    const mesh=new THREE.InstancedMesh(blockGeometry,materials[type],positions.length);
    positions.forEach(([x,y,z],i)=>{matrix.makeTranslation(x+.5,y+.5,z+.5);mesh.setMatrixAt(i,matrix);});
    mesh.computeBoundingSphere();terrain.add(mesh);
  }
}
const sea=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshLambertMaterial({color:0x91bcb9}));
sea.rotation.x=-Math.PI/2;sea.position.y=.65;scene.add(sea);
const cloudMaterial=new THREE.MeshBasicMaterial({color:0xf9faf0,fog:true});
const cloudGeometry=new THREE.BoxGeometry(1,1,1);
for(const [x,y,z,s] of [[-23,23,-32,8],[17,26,-38,9],[37,24,-15,7],[-37,25,4,9],[-5,27,-49,6]]) {
  for(let i=0;i<3;i++) {
    const cloud=new THREE.Mesh(cloudGeometry,cloudMaterial);
    cloud.position.set(x+i*s*.5,y+(i%2)*.7,z+(i%2)*1.5);cloud.scale.set(s,1.1+(i%2)*.8,3.5);scene.add(cloud);
  }
}
const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.007,1.007,1.007)),new THREE.LineBasicMaterial({color:0xfff5c9}));
outline.visible=false;scene.add(outline);
let selected=1, yaw=0, pitch=-.18, active=false, started=false, target=null;
let accumulator=0,previous=performance.now(),toastTimer;
const direction=new THREE.Vector3();
const hotbar=$('#hotbar');
for(const block of BLOCKS.slice(0,5)) {
  const button=document.createElement('button');button.className='slot';button.type='button';
  button.dataset.block=block.id;button.setAttribute('aria-label',`${block.id}: ${block.name}`);
  button.innerHTML=`<span class="slot-number">${block.id}</span><span class="cube" style="--block:${block.color}" aria-hidden="true"></span><span class="slot-name">${block.short}</span>`;
  button.addEventListener('click',()=>selectBlock(block.id));hotbar.append(button);
}
function selectBlock(id) {
  selected=id;
  for(const button of hotbar.children)button.setAttribute('aria-pressed',String(Number(button.dataset.block)===id));
  $('#selected-name').textContent=BLOCKS[id-1].name;
}
function notify(message) {
  $('#toast').textContent=message;$('#toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);
}
function resetWorld() {
  world.generate();rebuildTerrain();player.spawn(world);yaw=0;pitch=-.18;
  keys.clear();accumulator=0;target=null;outline.visible=false;
}
function updateMenu() {
  $('#overlay').hidden=active;document.body.classList.toggle('playing',active);
  $('#pause').disabled=!active;
  $('#restart').hidden=!started;
  if(started) {
    $('#menu-tag').textContent='잠시 쉬어가도 괜찮아요';
    $('#menu-title').innerHTML='당신의 세계가<br>기다리고 있어요.';
    $('#menu-description').innerHTML='블록과 풍경은 그대로, 잠깐의 쉼.<br>준비되면 다시 탐험을 이어가세요.';
    $('#play').innerHTML='계속 탐험하기 <span>↗</span>';
    $('#menu-note').textContent='다시 시작하면 지금까지 바꾼 월드가 초기화됩니다.';
  }
}
function pause() {
  active=false;keys.clear();accumulator=0;updateMenu();
  if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
}
async function play() {
  if(!('requestPointerLock' in renderer.domElement)) {
    notify('이 게임은 마우스 잠금을 지원하는 데스크톱 브라우저가 필요합니다.');return;
  }
  try {await renderer.domElement.requestPointerLock();}
  catch {notify('마우스 잠금을 허용한 뒤 시작 버튼을 다시 눌러 주세요.');}
}
$('#play').addEventListener('click',play);
$('#pause').addEventListener('click',pause);
$('#restart').addEventListener('click',()=>{resetWorld();notify('새 월드를 만들었습니다.');play();});
document.addEventListener('pointerlockchange',()=>{
  active=document.pointerLockElement===renderer.domElement;
  if(active)started=true;
  keys.clear();accumulator=0;previous=performance.now();updateMenu();
});
document.addEventListener('pointerlockerror',()=>notify('마우스 잠금에 실패했습니다. 시작 버튼을 다시 눌러 주세요.'));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('mousemove',event=>{
  if(!active)return;
  yaw-=event.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-event.movementY*.002,-Math.PI/2+.01,Math.PI/2-.01);
});
document.addEventListener('keydown',event=>{
  if(!active)return;
  if(['Space','KeyW','KeyA','KeyS','KeyD','Escape'].includes(event.code))event.preventDefault();
  if(event.code==='Escape'){pause();return;}
  if(event.code==='Space'&&!event.repeat)player.jump();
  if(/^Digit[1-5]$/.test(event.code))selectBlock(Number(event.code.slice(-1)));
  keys.add(event.code);
});
document.addEventListener('keyup',event=>keys.delete(event.code));
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
function aim() {
  camera.position.set(player.position.x,player.position.y+PLAYER.eye,player.position.z);
  camera.rotation.set(pitch,yaw,0);
  camera.getWorldDirection(direction);
  return traceBlock(world,camera.position,direction);
}
renderer.domElement.addEventListener('mousedown',event=>{
  if(!active||![0,2].includes(event.button))return;
  event.preventDefault();
  const hit=aim();
  if(!hit){notify('조금 더 가까이 다가가세요. (최대 6칸)');return;}
  if(event.button===0) {
    if(hit.y===0){notify('가장 아래의 기반암은 부술 수 없습니다.');return;}
    world.set(hit.x,hit.y,hit.z,0);
  } else {
    const [nx,ny,nz]=hit.normal;
    const x=hit.x+nx,y=hit.y+ny,z=hit.z+nz;
    if(!world.inBounds(x,y,z)){notify('월드 범위 안에 설치해 주세요. (높이 최대 25칸)');return;}
    if(world.get(x,y,z)||overlapsPlayer(player.position,x,y,z)){notify('플레이어와 겹치는 위치에는 설치할 수 없습니다.');return;}
    world.set(x,y,z,selected);
  }
  rebuildTerrain();
});
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
});
function frame(now) {
  requestAnimationFrame(frame);
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(active) {
    accumulator+=dt;
    while(accumulator>=PLAYER.step){player.update(world,keys,yaw,PLAYER.step);accumulator-=PLAYER.step;}
    if(player.position.y < -10){player.spawn(world);notify('섬 밖으로 떨어져 시작 위치로 돌아왔습니다.');}
  }
  target=aim();outline.visible=active&&Boolean(target);
  if(target)outline.position.set(target.x+.5,target.y+.5,target.z+.5);
  $('#target').textContent=target ? `${BLOCKS[target.type-1].name} · ${target.distance.toFixed(1)}m` : '6칸 이내의 블록을 바라보세요';
  $('#position').textContent=`X ${player.position.x.toFixed(1)}  /  Y ${player.position.y.toFixed(1)}  /  Z ${player.position.z.toFixed(1)}`;
  renderer.render(scene,camera);
}
selectBlock(1);resetWorld();updateMenu();requestAnimationFrame(frame);
