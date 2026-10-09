/* In-portal image, TIFF and PDF viewer. Decoding stays in the browser. */
(()=>{'use strict';
let active=null,cached=null,epoch=0,pdfLibrary=null,tiffLibrary=null;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('The image viewer could not load. Check your internet connection and select the drawing again.'));};document.head.append(s);});}
async function pdfjs(){if(!pdfLibrary)pdfLibrary=import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';return m;}).catch(e=>{pdfLibrary=null;throw e;});return pdfLibrary;}
async function utif(){if(!tiffLibrary)tiffLibrary=script('https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js').then(()=>script('https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js')).then(()=>window.UTIF).catch(e=>{tiffLibrary=null;throw e;});return tiffLibrary;}
function close(){epoch++;if(active){active.dead=true;active.task?.cancel();active.pdf?.destroy();active.observer?.disconnect();cancelAnimationFrame(active.tiffFrame);cancelAnimationFrame(active.zoomFrame);clearTimeout(active.detailTimer);clearTimeout(active.timer);if(active.url)URL.revokeObjectURL(active.url);active=null;}}
function clear(){close();cached=null;}
async function mount(host,doc,fetchFile){
 close();const ticket=epoch,v={host,doc,dead:false,scale:1,page:1,pages:1,width:0,height:0,rotation:0,pointers:new Map()};active=v;
 const valid=()=>!v.dead&&ticket===epoch&&host.isConnected;
 host.innerHTML='<div class="dv-toolbar" role="toolbar" aria-label="Drawing viewer controls"><button data-dv="minus" aria-label="Zoom out" title="Zoom out (−)">−</button><output data-dv-percent>100%</output><button data-dv="plus" aria-label="Zoom in" title="Zoom in (+)">+</button><span class="dv-separator"></span><button data-dv="fit">Fit</button><button data-dv="actual">100%</button><button data-dv="rotate" aria-label="Rotate drawing clockwise">Rotate ↻</button><button data-dv="full">Full screen</button><span class="dv-pages"><button data-dv="previous" aria-label="Previous page">‹</button><output data-dv-page>1 / 1</output><button data-dv="next" aria-label="Next page">›</button></span><button data-dv="download" class="dv-download">Download ↓</button></div><p class="dv-status" role="status">Loading drawing…</p><div class="dv-stage" tabindex="0" aria-label="Drawing canvas. Scroll to zoom, drag to pan. Plus and minus zoom; zero fits the drawing."><div class="dv-sheet"></div></div><p class="dv-hint">Wheel / pinch to zoom<span class="dv-hint-dot">·</span>Drag to explore<span class="dv-hint-dot">·</span>Double-click to fit<span class="dv-quality">PRECISION VIEW</span></p>';
 const q=s=>host.querySelector(s),stage=q('.dv-stage'),sheet=q('.dv-sheet'),status=q('.dv-status');v.stage=stage;v.sheet=sheet;
 const say=text=>{if(valid())status.textContent=text;};
 function labels(){q('[data-dv-percent]').textContent=Math.round(v.scale*100)+'%';q('[data-dv-page]').textContent=v.page+' / '+v.pages;q('[data-dv="previous"]').disabled=v.page<=1;q('[data-dv="next"]').disabled=v.page>=v.pages;}
 function layout(){const rotated=v.rotation%180!==0,w=(rotated?v.height:v.width)*v.scale,h=(rotated?v.width:v.height)*v.scale;sheet.style.width=w+'px';sheet.style.height=h+'px';if(v.canvas&&!v.tiffRaw){v.canvas.style.width=v.width*v.scale+'px';v.canvas.style.height=v.height*v.scale+'px';v.canvas.style.transform=`translate(-50%,-50%) rotate(${v.rotation}deg)`;}if(v.previewCanvas){v.previewCanvas.style.width=v.width*v.scale+'px';v.previewCanvas.style.height=v.height*v.scale+'px';v.previewCanvas.style.transform=`translate(-50%,-50%) rotate(${v.rotation}deg)`;}if(v.tiffRaw&&v.crop)positionTIFF();labels();if(v.tiffRaw)scheduleTIFF();}
 function zoomNow(value,x=stage.clientWidth/2,y=stage.clientHeight/2){if(!v.width)return;const rect=sheet.getBoundingClientRect(),sr=stage.getBoundingClientRect(),old=v.scale;const px=(sr.left+x-rect.left)/old,py=(sr.top+y-rect.top)/old;v.scale=clamp(value,.02,8);layout();const next=sheet.getBoundingClientRect();stage.scrollLeft+=next.left+px*v.scale-(sr.left+x);stage.scrollTop+=next.top+py*v.scale-(sr.top+y);if(v.pdf){clearTimeout(v.timer);v.timer=setTimeout(()=>paintPDF().catch(e=>say(e.message)),180);}}
 function stopZoom(){cancelAnimationFrame(v.zoomFrame);v.zoomFrame=0;v.zoomGoal=null;}
 function zoom(value,x=stage.clientWidth/2,y=stage.clientHeight/2){
  if(!v.width)return;v.zoomGoal=clamp(value,.02,8);v.anchor={x,y};
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){const goal=v.zoomGoal;stopZoom();zoomNow(goal,x,y);return;}
  if(v.zoomFrame)return;let previous=performance.now();
  const step=now=>{if(!valid())return;const dt=Math.min(40,now-previous);previous=now;const goal=v.zoomGoal;
   const next=Math.exp(Math.log(v.scale)+(Math.log(goal)-Math.log(v.scale))*(1-Math.exp(-dt/42)));
   if(Math.abs(Math.log(goal/next))<.001){v.zoomFrame=0;zoomNow(goal,v.anchor.x,v.anchor.y);v.zoomGoal=null;return;}
   zoomNow(next,v.anchor.x,v.anchor.y);v.zoomFrame=requestAnimationFrame(step);
  };v.zoomFrame=requestAnimationFrame(step);
 }
 function fit(){if(!v.width)return;stopZoom();const r=v.rotation%180!==0;zoomNow(Math.min((stage.clientWidth-48)/(r?v.height:v.width),(stage.clientHeight-48)/(r?v.width:v.height)));stage.scrollLeft=0;stage.scrollTop=0;}
 // A lightweight whole-page layer follows gestures immediately. Detail is sharpened after motion settles.
 function previewTIFF(){const ratio=Math.min(1,Math.sqrt(1000000/(v.width*v.height))),w=Math.max(1,Math.round(v.width*ratio)),h=Math.max(1,Math.round(v.height*ratio));const c=document.createElement('canvas');c.width=w;c.height=h;c.setAttribute('aria-hidden','true');const ctx=c.getContext('2d'),pixels=ctx.createImageData(w,h);CMM_TIFF_RASTER.sample(v.tiffRaw,{x:0,y:0,width:v.width,height:v.height,outWidth:w,outHeight:h},pixels.data);ctx.putImageData(pixels,0,0);v.previewCanvas=c;sheet.replaceChildren(c);}
 function positionTIFF(){if(!v.canvas||!v.crop)return;const {x,y,cw,ch}=v.crop,angle=v.rotation*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),dx=(x+cw/2-v.width/2)*v.scale,dy=(y+ch/2-v.height/2)*v.scale;v.canvas.style.width=cw*v.scale+'px';v.canvas.style.height=ch*v.scale+'px';v.canvas.style.left=`calc(50% + ${dx*co-dy*si}px)`;v.canvas.style.top=`calc(50% + ${dx*si+dy*co}px)`;v.canvas.style.transform=`translate(-50%,-50%) rotate(${v.rotation}deg)`;}
 function scheduleTIFF(){clearTimeout(v.detailTimer);v.detailTimer=setTimeout(()=>{cancelAnimationFrame(v.tiffFrame);v.tiffFrame=requestAnimationFrame(paintTIFF);},100);}
 function paintTIFF(){if(!v.tiffRaw||!valid())return;const r=sheet.getBoundingClientRect(),sr=stage.getBoundingClientRect(),angle=v.rotation*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const corners=[[sr.left,sr.top],[sr.right,sr.top],[sr.left,sr.bottom],[sr.right,sr.bottom]].map(([x,y])=>{const dx=(x-cx)/v.scale,dy=(y-cy)/v.scale;return [dx*co+dy*si+v.width/2,-dx*si+dy*co+v.height/2];});
 const x=clamp(Math.floor(Math.min(...corners.map(p=>p[0])))-4,0,v.width),y=clamp(Math.floor(Math.min(...corners.map(p=>p[1])))-4,0,v.height),right=clamp(Math.ceil(Math.max(...corners.map(p=>p[0])))+4,0,v.width),bottom=clamp(Math.ceil(Math.max(...corners.map(p=>p[1])))+4,0,v.height),cw=right-x,ch=bottom-y;if(cw<=0||ch<=0)return;
 const density=Math.min(1,v.scale*(window.devicePixelRatio||1),Math.sqrt(4000000/(cw*ch))),ow=Math.max(1,Math.ceil(cw*density)),oh=Math.max(1,Math.ceil(ch*density));
 const canvas=v.canvas||document.createElement('canvas');canvas.width=ow;canvas.height=oh;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',doc.name+' page '+v.page);const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(ow,oh);CMM_TIFF_RASTER.sample(v.tiffRaw,{x,y,width:cw,height:ch,outWidth:ow,outHeight:oh},pixels.data);ctx.putImageData(pixels,0,0);
 v.crop={x,y,cw,ch};if(!v.canvas){v.canvas=canvas;sheet.append(canvas);}positionTIFF();say('Ready');}

 stage.addEventListener('scroll',()=>{if(v.tiffRaw)scheduleTIFF();},{passive:true});
 async function paintPDF(){if(!v.pdfPage||!valid())return;v.task?.cancel();const page=v.pdfPage;const pixelScale=Math.min(v.scale*(window.devicePixelRatio||1),Math.sqrt(20000000/(v.width*v.height)));const viewport=page.getViewport({scale:pixelScale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',doc.name+' page '+v.page);const task=page.render({canvasContext:canvas.getContext('2d'),viewport});v.task=task;try{await task.promise;if(valid()&&v.task===task){v.canvas=canvas;sheet.replaceChildren(canvas);layout();say('Ready');}}catch(e){if(e.name!=='RenderingCancelledException'&&valid())throw e;}}
 async function page(number){if(!valid())return;stopZoom();clearTimeout(v.detailTimer);const pageTicket=(v.pageTicket||0)+1;v.pageTicket=pageTicket;v.page=clamp(number,1,v.pages);say('Rendering drawing…');
 if(v.pdf){const p=await v.pdf.getPage(v.page);if(!valid()||pageTicket!==v.pageTicket)return;v.pdfPage=p;const viewport=p.getViewport({scale:1});v.width=viewport.width;v.height=viewport.height;fit();clearTimeout(v.timer);await paintPDF();}
 else if(v.tiff){const ifd=v.ifds[v.page-1],w=Number(ifd.t256?.[0]),h=Number(ifd.t257?.[0]),bits=ifd.t258||[1],channels=Number(ifd.t277?.[0]||bits.length),photo=Number(ifd.t262?.[0]??2),bps=bits[0];
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid TIFF page dimensions.');const packed=Math.ceil(w*bits.reduce((a,b)=>a+b,0)/8)*h;
 const compact=channels===1&&[0,1].includes(photo)&&[1,2,4,8].includes(bps);
 if(packed>128*1024*1024||(!compact&&w*h>16000000))throw Error('This TIFF uses too much decoded memory for this browser. Download the original to view it.');
 cancelAnimationFrame(v.tiffFrame);v.tiffRaw=null;v.canvas=null;v.previewCanvas=null;v.crop=null;sheet.replaceChildren();for(const old of v.ifds)delete old.data;
 await new Promise(resolve=>requestAnimationFrame(resolve));if(!valid()||pageTicket!==v.pageTicket)return;
 v.tiff.decodeImage(v.bytes.buffer,ifd,v.ifds);v.width=w;v.height=h;
 if(compact){v.tiffRaw={data:ifd.data,width:w,height:h,bits:bps,photo};delete ifd.data;previewTIFF();fit();clearTimeout(v.detailTimer);paintTIFF();}
 else{const pixels=v.tiff.toRGBA8(ifd),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer,pixels.byteOffset,pixels.byteLength),w,h),0,0);delete ifd.data;v.canvas=canvas;sheet.replaceChildren(canvas);fit();say('Ready');}}

 labels();}
 function download(){if(!v.bytes)return;const url=URL.createObjectURL(new Blob([v.bytes],{type:v.type||'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download=doc.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 q('[data-dv="download"]').disabled=true;
 host.querySelectorAll('[data-dv]').forEach(b=>b.onclick=async()=>{try{const a=b.dataset.dv;if(a==='download')return download();if(a==='full'){if(document.fullscreenElement)await document.exitFullscreen();else await host.requestFullscreen();return;}if(!v.width)return;if(a==='plus')zoom((v.zoomGoal||v.scale)*1.25);if(a==='minus')zoom((v.zoomGoal||v.scale)/1.25);if(a==='actual')zoom(1);if(a==='fit')fit();if(a==='rotate'){v.rotation=(v.rotation+90)%360;fit();}if(a==='previous')await page(v.page-1);if(a==='next')await page(v.page+1);}catch(e){say(e.message);}});
 stage.addEventListener('wheel',e=>{if(!v.width)return;e.preventDefault();const r=stage.getBoundingClientRect();zoom((v.zoomGoal||v.scale)*Math.exp(-clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1),-160,160)*.0018),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 stage.ondblclick=fit;stage.onkeydown=e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')fit();else zoom((v.zoomGoal||v.scale)*(e.key==='-'?.8:1.25));}};
 stage.onpointerdown=e=>{if(e.button!==0)return;stopZoom();stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);v.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});stage.classList.add('dragging');};
 stage.onpointermove=e=>{const old=v.pointers.get(e.pointerId);if(!old)return;const points=[...v.pointers.values()];if(points.length===2){const other=[...v.pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);const r=stage.getBoundingClientRect();if(before>0)zoomNow(v.scale*after/before,(e.clientX+other.x)/2-r.left,(e.clientY+other.y)/2-r.top);}else{stage.scrollLeft-=e.clientX-old.x;stage.scrollTop-=e.clientY-old.y;}v.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});};
 stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=e=>{v.pointers.delete(e.pointerId);if(!v.pointers.size)stage.classList.remove('dragging');};
 v.observer=new ResizeObserver(()=>{if(valid()&&v.width)layout();});v.observer.observe(stage);
 try{let data=cached?.id===doc.id?cached.data:await fetchFile(doc.id);if(!valid())return;cached={id:doc.id,data};v.bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));v.type=data.type;q('[data-dv="download"]').disabled=false;
 const pdf=v.type==='application/pdf'||/\.pdf$/i.test(doc.name),tiff=v.type==='image/tiff'||/\.tiff?$/i.test(doc.name);
 if(pdf){const lib=await pdfjs();if(!valid())return;const task=lib.getDocument({data:v.bytes.slice(),isEvalSupported:false});v.pdf=await task.promise;if(!valid()){v.pdf.destroy();return;}v.pages=v.pdf.numPages;await page(1);}
 else if(tiff){v.tiff=await utif();if(!valid())return;v.ifds=v.tiff.decode(v.bytes.buffer).filter(d=>d.t256&&d.t257);v.pages=v.ifds.length;if(!v.pages)throw Error('No image pages found in this TIFF.');await page(1);}
 else if(/^image\/(png|jpeg|webp|gif|bmp)$/.test(v.type)){v.url=URL.createObjectURL(new Blob([v.bytes],{type:v.type}));const img=new Image();img.src=v.url;await img.decode();if(!valid())return;v.width=img.naturalWidth;v.height=img.naturalHeight;v.canvas=img;img.alt=doc.name;img.draggable=false;sheet.replaceChildren(img);fit();say('Ready');}
 else say('Preview supports PDF, TIFF, PNG, JPG, WebP, GIF and BMP. Download this format to use its original application.');
 }catch(e){say('Unable to display drawing: '+e.message);}labels();
}
window.CMM_DRAWING_VIEWER={mount,close,clear};
})();

