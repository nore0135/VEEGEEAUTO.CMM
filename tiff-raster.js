/* Bounded viewport conversion for packed grayscale engineering TIFF scans. */
(function(root){'use strict';
function sample(source,rect,out){const {data,width,bits,photo}=source,stride=Math.ceil(width*bits/8),mask=(1<<bits)-1,stepX=rect.width/rect.outWidth,stepY=rect.height/rect.outHeight;
 const nx=Math.min(4,Math.max(1,Math.ceil(stepX))),ny=Math.min(4,Math.max(1,Math.ceil(stepY)));
 for(let oy=0;oy<rect.outHeight;oy++)for(let ox=0;ox<rect.outWidth;ox++){let shade=255;
  for(let sy=0;sy<ny;sy++){const y=Math.min(source.height-1,Math.floor(rect.y+(oy+(sy+.5)/ny)*stepY));for(let sx=0;sx<nx;sx++){const x=Math.min(width-1,Math.floor(rect.x+(ox+(sx+.5)/nx)*stepX)),bit=x*bits,value=(data[y*stride+(bit>>3)]>>(8-bits-(bit&7)))&mask;shade=Math.min(shade,(photo===0?mask-value:value)*255/mask);}}
  const i=(oy*rect.outWidth+ox)*4;out[i]=out[i+1]=out[i+2]=shade;out[i+3]=255;
 }return out;}
root.CMM_TIFF_RASTER={sample};if(typeof module!=='undefined')module.exports={sample};
})(typeof window==='undefined'?globalThis:window);
