export const PLAYER = Object.freeze({ radius:.29, height:1.8, eye:1.62, speed:4.8, jump:7.8, gravity:23, terminal:28, step:1/120 });
const EPSILON = 1e-7;
export function overlapsPlayer(position,x,y,z) {
  return position.x+PLAYER.radius > x+EPSILON && position.x-PLAYER.radius < x+1-EPSILON &&
    position.y+PLAYER.height > y+EPSILON && position.y < y+1-EPSILON &&
    position.z+PLAYER.radius > z+EPSILON && position.z-PLAYER.radius < z+1-EPSILON;
}
function obstacles(world,p) {
  const result=[];
  for(let x=Math.floor(p.x-PLAYER.radius+EPSILON);x<=Math.floor(p.x+PLAYER.radius-EPSILON);x++)
    for(let y=Math.floor(p.y+EPSILON);y<=Math.floor(p.y+PLAYER.height-EPSILON);y++)
      for(let z=Math.floor(p.z-PLAYER.radius+EPSILON);z<=Math.floor(p.z+PLAYER.radius-EPSILON);z++)
        if(world.get(x,y,z)) result.push({x,y,z});
  return result;
}
export class Player {
  constructor() { this.position={x:.5,y:10,z:10.5}; this.velocityY=0; this.grounded=false; }
  spawn(world) {
    this.position={x:.5,y:world.surface(0,10)+.01,z:10.5};
    this.velocityY=0; this.grounded=false;
  }
  jump() { if(this.grounded) {this.velocityY=PLAYER.jump;this.grounded=false;return true;} return false; }
  update(world, input, yaw, dt) {
    let forward=(input.has('KeyW')?1:0)-(input.has('KeyS')?1:0);
    let right=(input.has('KeyD')?1:0)-(input.has('KeyA')?1:0);
    const length=Math.hypot(forward,right);
    if(length) {forward/=length;right/=length;}
    this.move(world,'x',(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*PLAYER.speed*dt);
    this.move(world,'z',(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*PLAYER.speed*dt);
    this.velocityY=Math.max(-PLAYER.terminal,this.velocityY-PLAYER.gravity*dt);
    this.grounded=false;
    this.move(world,'y',this.velocityY*dt);
  }
  move(world, axis, amount) {
    if(!amount) return;
    // 작은 이동 단위로 나누어 빠른 낙하 중에도 얇은 바닥을 통과하지 않습니다.
    const steps=Math.max(1,Math.ceil(Math.abs(amount)/.15));
    const increment=amount/steps;
    for(let i=0;i<steps;i++) {
      this.position[axis]+=increment;
      const hits=obstacles(world,this.position);
      if(!hits.length) continue;
      for(const block of hits) {
        const edge=axis==='y' ? (increment>0 ? PLAYER.height : 0) : PLAYER.radius;
        const boundary=increment>0 ? block[axis]-edge : block[axis]+1+edge;
        this.position[axis]=increment>0 ? Math.min(this.position[axis],boundary) : Math.max(this.position[axis],boundary);
      }
      if(axis==='y') {this.grounded=increment<0;this.velocityY=0;}
      break;
    }
  }
}
