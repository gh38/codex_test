import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld, traceBlock, WORLD } from '../src/world.js';
import { Player, PLAYER, overlapsPlayer } from '../src/physics.js';

function flatWorld() {
  const world=new VoxelWorld();
  for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++)world.set(x,0,z,3);
  return world;
}
function tick(player,world,seconds,input=new Set(),yaw=0) {
  for(let t=0;t<seconds;t+=PLAYER.step)player.update(world,input,yaw,PLAYER.step);
}
test('월드 생성은 결정적이며 풀·흙·돌, 높이와 범위를 유지한다',()=>{
  const a=new VoxelWorld(),b=new VoxelWorld();a.generate();b.generate();
  assert.deepEqual(a.blocks,b.blocks);
  for(const type of [1,2,3,4,5,6])assert.ok([...a.blocks.values()].includes(type));
  for(const key of a.blocks.keys())assert.ok(a.inBounds(...key.split(',').map(Number)));
  assert.equal(a.set(WORLD.max+1,1,0,1),false);
  assert.equal(a.set(0,WORLD.maxY+1,0,1),false);
});
test('빠르게 낙하해도 바닥을 관통하지 않고 정지한다',()=>{
  const world=flatWorld(),p=new Player();p.position={x:.5,y:20,z:.5};
  tick(p,world,3);
  assert.equal(p.position.y,1);assert.equal(p.grounded,true);assert.equal(p.velocityY,0);
});
test('점프, 공중 점프 제한, 착지가 동작한다',()=>{
  const world=flatWorld(),p=new Player();p.position={x:.5,y:1,z:.5};tick(p,world,.1);
  assert.equal(p.jump(),true);tick(p,world,.15);assert.ok(p.position.y>1.6);
  assert.equal(p.jump(),false);tick(p,world,2);assert.equal(p.position.y,1);assert.equal(p.grounded,true);
});
test('벽 충돌과 대각선 이동 속도 정규화',()=>{
  const world=flatWorld(),p=new Player();p.position={x:.5,y:1,z:.5};
  world.set(1,1,0,3);world.set(1,2,0,3);tick(p,world,1,new Set(['KeyD']));
  assert.ok(p.position.x<=1-PLAYER.radius+1e-6);
  const a=new Player(),b=new Player();a.position={x:0,y:1,z:0};b.position={...a.position};
  tick(a,flatWorld(),.2,new Set(['KeyW']));tick(b,flatWorld(),.2,new Set(['KeyW','KeyD']));
  assert.ok(Math.abs(Math.hypot(a.position.x,a.position.z)-Math.hypot(b.position.x,b.position.z))<1e-6);
});
test('천장에 머리를 부딪히면 상승을 멈춘다',()=>{
  const world=flatWorld(),p=new Player();p.position={x:.5,y:1,z:.5};world.set(0,3,0,3);
  tick(p,world,.1);p.jump();tick(p,world,.15);
  assert.ok(p.position.y+PLAYER.height<=3+1e-6);assert.ok(p.velocityY<=0);
});
test('블록 선택은 거리 제한, 음수 좌표와 설치할 면을 계산한다',()=>{
  const world=new VoxelWorld();world.set(-2,1,0,3);
  const hit=traceBlock(world,{x:.5,y:1.5,z:.5},{x:-1,y:0,z:0});
  assert.equal(hit.x,-2);assert.deepEqual(hit.normal,[1,0,0]);assert.equal(hit.distance,1.5);
  assert.equal(traceBlock(world,{x:8,y:1.5,z:.5},{x:-1,y:0,z:0}),null);
  assert.equal(traceBlock(world,{x:0,y:0,z:0},{x:0,y:0,z:0}),null);
  world.set(0,1,-2,1);assert.equal(traceBlock(world,{x:.5,y:1.5,z:.5},{x:0,y:0,z:-1}).z,-2);
});
test('플레이어 안에 설치를 막고 정확히 맞닿은 블록은 허용한다',()=>{
  const p={x:.5,y:1,z:.5};
  assert.equal(overlapsPlayer(p,0,1,0),true);assert.equal(overlapsPlayer(p,0,2,0),true);
  assert.equal(overlapsPlayer(p,0,0,0),false);assert.equal(overlapsPlayer(p,1,1,0),false);
});
test('블록 삭제와 다시 생성으로 편집이 초기화된다',()=>{
  const world=new VoxelWorld();world.generate();const initial=new Map(world.blocks);
  const y=world.surface(0,0)-1;world.set(0,y,0,0);assert.equal(world.get(0,y,0),0);
  world.set(0,y+1,0,4);assert.equal(world.get(0,y+1,0),4);
  world.generate();assert.deepEqual(world.blocks,initial);
});
