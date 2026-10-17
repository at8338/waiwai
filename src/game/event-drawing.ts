import type { Pixel } from './avatar.ts';
/** Small deterministic software pixel pen. No canvas/DOM, smoothing or random noise. */
export function eventDrawing(width: number, height: number, density = 2) {
  const w = width * density, h = height * density, grid: (number | undefined)[] = Array(w * h);
  const rect = (color: number, x: number, y: number, width: number, height: number) => {
    for(let yy=Math.max(0,Math.round(y*density));yy<Math.min(h,Math.round((y+height)*density));yy++)for(let xx=Math.max(0,Math.round(x*density));xx<Math.min(w,Math.round((x+width)*density));xx++)grid[yy*w+xx]=color;
  };
  const poly = (color: number, points: number[][]) => {
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const xx=(x+.5)/density,yy=(y+.5)/density;let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++) {const[xi,yi]=points[i],[xj,yj]=points[j];if((yi>yy)!==(yj>yy)&&xx<(xj-xi)*(yy-yi)/(yj-yi)+xi)inside=!inside;}
      if(inside)grid[y*w+x]=color;
    }
  };
  const oval = (color: number, x: number, y: number, width: number, height: number) => {
    for(let yy=Math.max(0,Math.floor(y*density));yy<Math.min(h,(y+height)*density);yy++)for(let xx=Math.max(0,Math.floor(x*density));xx<Math.min(w,(x+width)*density);xx++)if((((xx+.5)/density-x-width/2)/(width/2))**2+((((yy+.5)/density-y-height/2)/(height/2))**2)<=1)grid[yy*w+xx]=color;
  };
  const line = (color: number, x: number, y: number, xx: number, yy: number, thickness = .5) => {const n=Math.max(1,Math.ceil(Math.max(Math.abs(xx-x),Math.abs(yy-y))*density));for(let i=0;i<=n;i++)rect(color,x+(xx-x)*i/n,y+(yy-y)*i/n,thickness,thickness);};
  const pixels = (): Pixel[] => {const out:Pixel[]=[];for(let y=0;y<h;y++)for(let x=0;x<w;){const color=grid[y*w+x];if(color===undefined){x++;continue;}let end=x+1;while(end<w&&grid[y*w+end]===color)end++;out.push({color,x:x/density,y:y/density,w:(end-x)/density,h:1/density});x=end;}return out;};
  return { rect, poly, oval, line, pixels };
}
