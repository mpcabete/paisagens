import { Layout, Hex } from "./dist/lib-module.js";
export class Graph extends Layout {
  constructor(size, origin) {
    super(Layout.flat, { x: size, y: size }, origin);
    this.tiles = [];
    // size - size of tile(pixels)
  }

  addTile(q, r, s = -q - r) {
    //TODO if this.hasTile(q,r,s) throw error
    this.tiles.push(new Tile(q, r, s));
    return this;
  }

  getTile(q, r, s) {
    return this.tiles.find((t) => t.q == q && t.r == r);
  }
  addPixel({ x, y }, value) {
    if (value == null) {
      throw "value must not be null";
    }
    const { q, r, s } = this.pixelToHex({ x, y }).round();

    let tile = this.getTile(q, r, s);
    if (tile == null) {
      //nao uso o addTile pra nao precisar usar o this.getTile dps
      tile = new Tile(q, r, s);
      this.tiles.push(tile);
    }
    tile.addPixel(value);

    return tile;
  }
  addData(data) {
    const start = Date.now()
    const { width, height } = data;
    const size = this.size.x
    let lastTile = null
    let lastTilePos = {x:-1,y:-1}
    const n = data[0].length

    for (let i = 0; i < n; i++) {
      if(i%10000==0){
        console.log(`${(i/n*100).toFixed(1)}%`)
      }
      const x = i % width;
      const y = Math.floor(i / width);
      const value = data[0][i];
      if(x-lastTilePos.x<size && y==lastTilePos.y){
        lastTile.addPixel(value)
        continue
      }
      const tile = this.addPixel({ x, y }, value);
      const changed = tile !== lastTile
      if (changed) {
        lastTilePos = {x,y}
        lastTile = tile
      }
      
    }
    console.log(`${n} pixels computed in ${((Date.now()-start)/1000).toFixed(2)}s`)
  }
}
export class Tile extends Hex {
  constructor(q, r, s = -q - r) {
    super(q, r, s);
    this.pixels = [];
  }
  addPixel(value) {
    // tirei o " new Pixel({x, y}, value) " pq n vou usar esse xy e seria mto caro
    this.pixels.push(value);
  }
  get mean() {
    return this.pixels.reduce((a, v) => a + v, 0) / this.pixels.length;
  }
}
export class Pixel {
  constructor({ x, y }, value) {
    this.x = x;
    this.y = y;
    this.value = value;
  }
}
