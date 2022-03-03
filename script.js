import {plotData} from './plot.js'
import {printHexagons} from './print-hex.js'
import {Graph,Tile,Pixel} from './graph.js'
import { Point, Hex } from './dist/lib-module.js'

const canvas = document.getElementById('plot')
const graphCanvas = document.getElementById('graph')
const w = canvas.width = graphCanvas.width = window.innerWidth  
const h = canvas.height = graphCanvas.height = window.innerHeight 

async function loadTiff(){
  // using local ArrayBuffer
  const response = await fetch('./tiffs/small.tif');
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  return tiff
}

async function main(){
  
  const tiff = await loadTiff();
  const image = await tiff.getImage();
  const data = await image.readRasters();
  const {width, height} = data

  const size = 40
  const origin = {x:0,y:0}
  const graph = new Graph(size,origin)
  for(let i in data[0]){
    //TODO: da pra otimizar, com ele checando se o tile nao mudou e dar tile.addPixel
    const x = i % width
    const y = Math.floor(i/height)
    const value = data[0][i]
    graph.addPixel({x,y},value)
  }

  //const xy = graph.hexToPixel(new Hex(0,-1,1))
  //console.log('xy',xy)
  //console.log(data[0])
  //plotData(width,height,data[0])
  //
  //TODO: separar isso numa funçao
  //TODO: ver problema da discrepancia de tamanho(provavelmente precisa normalizar
  //por raiz de 3, ou algo do tipo
  //TODO: mudar escala de ciza pra escala do plotty
  //
  const hexs = graph.tiles.map((x) => {
    return {
      points: graph.polygonCorners(x),
      fill: Math.round((x.mean+1)/2*255),
    };
  });

  const ctx = graphCanvas.getContext('2d')
  ctx.setImage
  console.log('ctx',ctx)

  const newData = []
  for (let i in data[0]){
    const v = data[0][i]
    const x = Math.round((v+1)/2*255)
    newData.push(x)
    newData.push(x)
    newData.push(x)
    newData.push(255)

  }

  //console.log('newData',newData)
  ctx.putImageData(new ImageData(new Uint8ClampedArray(newData),width,height),0,0)

  ctx.lineWidth = 5
  ctx.strokeStile = 'black'
  hexs.forEach(hex=>{
    drawHex(ctx,hex.points,hex.fill)
  })

}

function drawHex(ctx, points, fill=null){
  ctx.beginPath();
  for (var i = 0; i < 6; i++) {
    ctx.lineTo(points[i].x,points[i].y);
  }
  ctx.closePath();
  if (fill===null){
    ctx.stroke();
    return
  }
  ctx.stroke();
  ctx.fillStyle = `rgb(${fill},${fill},${fill})`
  ctx.closePath()
  ctx.fill()

}

//printHexagons(canvas)
main()

