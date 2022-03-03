import * as hex from './dist/lib-module.js'
export function printHexagons(canvas) {
  const size = 100;
  const orientation = hex.Layout.flat;
  const layout = new hex.Layout(
    orientation,
    new hex.Point(size, size),
    new hex.Point(0,0)
  );

  const coords = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const q = i;
      const r = j;
      const s = -q - r;
      coords.push([q, r, s]);
    }
  }
  //const coords = [[0,0,0],[1,-1,0],[-1,1,0],[0,1,-1],[0,-1,1]]
  const points = coords.map((x) => layout.hexToPixel(new hex.Hex(...x)));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  points.forEach((point) => {
    probe(ctx,layout,point)
    drawHexagon(ctx, point.x, point.y, size);
  });
  window.addEventListener('mousemove',(e)=>{
  const coords = layout.pixelToHex(new hex.Point(e.clientX,e.clientY))
    console.log(coords.round())
  })
}

function probe(ctx,layout,point){
  const coords = layout.pixelToHex(new hex.Point(point.x,point.y))
  console.log('coords',coords)
  const color = `rgb(${coords.q/10*255},0,0)`
  drawCircle(ctx, point.x, point.y, color);
  
}


function drawCircle(ctx,x,y, color='back'){
  const pointSize = 17
  ctx.fillStyle = color
  ctx.beginPath();
  ctx.arc(x, y, pointSize, 0, Math.PI * 2, true);
  ctx.fill();
}
function drawHexagon(ctx, x, y, r) {
  ctx.lineWidth = 4;
  const a = (2 * Math.PI) / 6;
  //const r = 50;
  ctx.beginPath();
  for (var i = 0; i < 6; i++) {
    ctx.lineTo(x + r * Math.cos(a * i), y + r * Math.sin(a * i));
  }
  ctx.closePath();
  ctx.stroke();
}
