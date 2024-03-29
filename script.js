import { plotData } from "./plot.js";
import { printHexagons } from "./print-hex.js";
import { Graph, Tile, Pixel } from "./graph.js";
import { Point, Hex } from "./dist/lib-module.js";

const canvas = document.getElementById("plot");
const graphCanvas = document.getElementById("graph");
const w = (canvas.width = graphCanvas.width = window.innerWidth);
const h = (canvas.height = graphCanvas.height = window.innerHeight);

async function loadTiff() {
  // using local ArrayBuffer
  const response = await fetch("./tiffs/sent-ndvi.tif");
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  return tiff;
}

async function main() {
  console.log('loading raster')
  const tiff = await loadTiff();
  const image = await tiff.getImage();
  const data = await image.readRasters();

  const size = 700;
  const origin = { x: 0, y: 0 };
  const graph = new Graph(size, origin);
  console.log('computing graph...')
  graph.addData(data);

  //const xy = graph.hexToPixel(new Hex(0,-1,1))
  //
  //TODO: ver problema da discrepancia de tamanho(provavelmente precisa normalizar
  //por raiz de 3, ou algo do tipo
  //TODO: mudar escala de ciza pra escala do plotty
  //

  console.log('rendering graph')
  drawGraph(graphCanvas, graph);
  console.log('rendering image')
  drawTiff(canvas, data);

  var slider = document.getElementById("opacity");
  slider.addEventListener("input", (e) => {
    graphCanvas.style.opacity = e.target.value;
  });
}
function drawTiff(canvas, data) {
  const { width, height } = data;
  const ctx = canvas.getContext("2d");
  const n = data[0].length
  const newData = new Uint8ClampedArray(n*4);
  console.log('const',n)
  for (let k = 0;k<n;k++) {
    const v = data[0][k];
    const x = Math.floor(((v + 1) / 2) * 255);
    newData[k*4] = x;
    newData[k*4+1] = x;
    newData[k*4+2] = x;
    newData[k*4+3] =255;
  }
  console.log('put')
  const img = new ImageData(newData, width, height)
  ctx.putImageData(
    img,
    0,
    0
  );
}
function drawGraph(canvas, graph) {
  const hexs = graph.tiles.map((x) => {
    return {
      points: graph.polygonCorners(x),
      fill: Math.round(((x.mean + 1) / 2) * 255),
    };
  });

  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 5;
  ctx.strokeStile = "black";
  hexs.forEach((hex) => {
    drawHex(ctx, hex.points, hex.fill);
  });
}

function drawHex(ctx, points, fill = null) {
  ctx.beginPath();
  for (var i = 0; i < 6; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  if (fill === null) {
    ctx.stroke();
    return;
  }
  ctx.stroke();
  ctx.fillStyle = `rgb(${fill},${fill},${fill})`;
  ctx.closePath();
  ctx.fill();
}

main();
