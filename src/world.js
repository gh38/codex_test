export const WORLD = Object.freeze({ min: -16, max: 15, maxY: 24, reach: 6 });
export const BLOCKS = Object.freeze([
  { id: 1, name: '풀 블록', short: '풀', color: '#80a656' },
  { id: 2, name: '흙 블록', short: '흙', color: '#a47b54' },
  { id: 3, name: '돌 블록', short: '돌', color: '#929c97' },
  { id: 4, name: '나무 블록', short: '나무', color: '#b58a59' },
  { id: 5, name: '모래 블록', short: '모래', color: '#dbcb94' },
  { id: 6, name: '나뭇잎', short: '잎', color: '#608b48' },
]);
export const keyOf = (x, y, z) => `${x},${y},${z}`;
export const DIRECTIONS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

export class VoxelWorld {
  constructor() { this.blocks = new Map(); }
  get(x, y, z) { return this.blocks.get(keyOf(x, y, z)) ?? 0; }
  set(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return false;
    if (type) this.blocks.set(keyOf(x, y, z), type);
    else this.blocks.delete(keyOf(x, y, z));
    return true;
  }
  inBounds(x, y, z) {
    return [x,y,z].every(Number.isInteger) && x >= WORLD.min && x <= WORLD.max &&
      z >= WORLD.min && z <= WORLD.max && y >= 0 && y <= WORLD.maxY;
  }
  surface(x, z) {
    for (let y = WORLD.maxY; y >= 0; y--) if (this.get(x,y,z)) return y + 1;
    return 0;
  }
  exposed(x,y,z) { return DIRECTIONS.some(([dx,dy,dz]) => !this.get(x+dx,y+dy,z+dz)); }
  generate() {
    this.blocks.clear();
    for (let x = WORLD.min; x <= WORLD.max; x++) {
      for (let z = WORLD.min; z <= WORLD.max; z++) {
        const edge = Math.min(x - WORLD.min, WORLD.max-x, z-WORLD.min, WORLD.max-z);
        const hills = Math.sin(x*.23)*1.5 + Math.cos(z*.27)*1.2 + Math.sin((x+z)*.18);
        const height = Math.max(2, Math.round(4 + hills - (edge < 2 ? 1 : 0)));
        for (let y = 0; y <= height; y++) {
          const type = y < height-2 ? 3 : y < height ? 2 : edge < 2 ? 5 : 1;
          this.set(x,y,z,type);
        }
      }
    }
    for (const [x,z] of [[-10,-7],[-7,1],[7,-8],[11,2],[-11,10],[3,-13],[10,11]]) {
      const base = this.surface(x,z);
      for (let y = base; y < base+4; y++) this.set(x,y,z,4);
      for (let dx=-2; dx<=2; dx++) for (let dz=-2; dz<=2; dz++) {
        for (let dy=2; dy<=5; dy++) {
          if (Math.abs(dx)+Math.abs(dz)+(dy===5?2:0)>4 || (dx===0 && dz===0 && dy<4)) continue;
          this.set(x+dx,base+dy,z+dz,6);
        }
      }
    }
  }
}

// 광선이 통과하는 격자만 검사하므로 블록 수가 늘어도 선택 비용이 작습니다.
export function traceBlock(world, origin, direction, reach = WORLD.reach) {
  const length = Math.hypot(direction.x,direction.y,direction.z);
  if (!length) return null;
  const axes = ['x','y','z'];
  const cell = axes.map(a => Math.floor(origin[a]));
  const dir = axes.map(a => direction[a]/length);
  const step = dir.map(v => Math.sign(v));
  const delta = dir.map(v => v === 0 ? Infinity : Math.abs(1/v));
  const next = dir.map((v,i) => v===0 ? Infinity : ((cell[i]+(v>0?1:0))-origin[axes[i]])/v);
  let distance = 0;
  let normal = [0,0,0];
  while (distance <= reach) {
    const type = world.get(...cell);
    if (type) return { x:cell[0], y:cell[1], z:cell[2], type, normal, distance };
    const axis = next[0] <= next[1] && next[0] <= next[2] ? 0 : next[1] <= next[2] ? 1 : 2;
    distance = next[axis];
    if (!Number.isFinite(distance)) break;
    cell[axis] += step[axis];
    next[axis] += delta[axis];
    normal = [0,0,0];
    normal[axis] = -step[axis];
  }
  return null;
}
