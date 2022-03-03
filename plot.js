export function plotData(width, height, data){
  const canvas = document.getElementById("plot");
  const plot = new plotty.plot({
    canvas,
    data,
    width,
    height,
    //domain: [0, 256],
    colorScale: "viridis"
  });
  plot.render();
}
