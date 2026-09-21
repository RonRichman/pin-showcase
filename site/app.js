(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const signed = (v, digits = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
  const compact = (v) => Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v.toFixed(2)).toLocaleString('en-US');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escapeText = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t)));
  const rgb = (a) => `rgb(${a.join(',')})`;
  const surfaceColor = (t) => t < .5 ? mix([37,83,69],[240,234,215],t*2) : mix([240,234,215],[195,102,67],(t-.5)*2);
  const text = (x,y,value,attrs='') => `<text x="${x}" y="${y}" ${attrs}>${escapeText(value)}</text>`;

  function canvasContext(canvas, width, height) {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width*scale) || canvas.height !== Math.round(height*scale)) {
      canvas.width = Math.round(width*scale); canvas.height = Math.round(height*scale);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,width,height);
    return ctx;
  }

  // A teaching surface, intentionally independent of fitted-model data.
  const heroCanvas = $('hero-surface');
  let paused = reduceMotion.matches, heroVisible = true, heroTime = 0, lastFrame = 0;
  function drawHero() {
    const w = heroCanvas.clientWidth, h = heroCanvas.clientHeight;
    if (!w || !h) return;
    const ctx = canvasContext(heroCanvas,w,h);
    const s = w/600;
    const project = (x,y,z) => [w*.5+(x-y)*w*.22, h*.43+(x+y)*w*.095-z*w*.19];
    ctx.lineWidth=.6; ctx.strokeStyle='#436454';
    for(let k=-5;k<=5;k++) {
      let p=project(k/5,-1,0),q=project(k/5,1,0);
      ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
      p=project(-1,k/5,0);q=project(1,k/5,0);
      ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
    }
    const shift=Math.sin(heroTime*.00032)*.22;
    const f=(x,y)=>.12+.5*clamp((1+3*(x+y*.8-shift))/2)+.34*clamp((1+4*(y-x*.3-.1))/2);
    const n=28;
    for(let j=0;j<n;j++) for(let i=0;i<n;i++) {
      const x=-1+i*2/n,y=-1+j*2/n,d=2/n,z=f(x+d/2,y+d/2);
      const pts=[[x,y],[x+d,y],[x+d,y+d],[x,y+d]].map(([a,b])=>project(a,b,f(a,b)));
      let col=z<.52?mix([56,108,82],[184,215,165],z/.52):mix([184,215,165],[235,159,110],(z-.52)/.46);
      ctx.fillStyle=rgb(col);ctx.strokeStyle='rgba(21,59,50,.34)';ctx.lineWidth=.55;
      ctx.beginPath();pts.forEach((p,k)=>k?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.fillStyle='#c0d4c4';ctx.font=`${Math.max(9,10*s)}px 'DM Sans',sans-serif`;
    const a=project(1.1,-.1,0),b=project(-.1,1.1,0);
    ctx.save();ctx.translate(a[0],a[1]+18);ctx.rotate(-.4);ctx.fillText('FEATURE A',0,0);ctx.restore();
    ctx.save();ctx.translate(b[0]-46,b[1]+20);ctx.rotate(.4);ctx.fillText('FEATURE B',0,0);ctx.restore();
    const p=project(.33,.32,f(.33,.32));ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fillStyle='#fff9ec';ctx.fill();
    ctx.strokeStyle='#f2e9d0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+35,p[1]-54);ctx.lineTo(p[0]+75,p[1]-54);ctx.stroke();
    ctx.fillStyle='#e8efdd';ctx.font=`${Math.max(10,11*s)}px 'DM Sans',sans-serif`;ctx.fillText('a learned region',p[0]+10,p[1]-64);
  }
  function motionLabel(){ $('motion-toggle').setAttribute('aria-pressed',String(paused));$('motion-toggle').innerHTML=paused?'Play motion <span aria-hidden="true">▷</span>':'Pause motion <span aria-hidden="true">Ⅱ</span>'; }
  $('motion-toggle').addEventListener('click',()=>{paused=!paused;motionLabel();});
  reduceMotion.addEventListener('change',()=>{paused=reduceMotion.matches;motionLabel();});
  new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;}).observe(heroCanvas);
  function animate(now){if(lastFrame && !paused && heroVisible && !document.hidden){heroTime+=Math.min(now-lastFrame,80);drawHero();}lastFrame=now;requestAnimationFrame(animate);}
  motionLabel();drawHero();requestAnimationFrame(animate);

  let activation='hard';
  const activationNames={hard:'HARD SIGMOID',step:'STEP FUNCTION',sigmoid:'SIGMOID'};
  function drawSplit(){
    const canvas=$('split-canvas'),mobile=canvas.clientWidth<500,w=mobile?Math.max(270,canvas.clientWidth):720,h=mobile?330:450,ctx=canvasContext(canvas,w,h),left=mobile?45:65,top=25,pw=w-left-20,ph=h-100;
    const angle=Number($('split-angle').value),offset=Number($('split-offset').value),theta=angle*Math.PI/180;
    $('angle-output').textContent=`${angle}°`;$('offset-output').textContent=offset.toFixed(2);
    $('activation-name').textContent=activationNames[activation];
    const descriptions={hard:'Flat on either side. A linear transition in between.',step:'An abrupt jump: a point falls on one side or the other.',sigmoid:'A smooth transition that approaches, but never reaches, 0 or 1.'};
    $('activation-description').textContent=descriptions[activation];
    const n=65;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const z=3*(Math.cos(theta)*(-1+2*x/(n-1))+Math.sin(theta)*(-1+2*y/(n-1))-offset);
      const v=activation==='hard'?clamp((1+z)/2):activation==='step'?(z>=0?1:0):1/(1+Math.exp(-z));
      ctx.fillStyle=rgb(mix([214,226,193],[23,62,53],v));ctx.fillRect(left+x*pw/n,top+(n-1-y)*ph/n,pw/n+1,ph/n+1);
    }
    ctx.font=`${mobile?11:15}px 'DM Sans',sans-serif`;ctx.fillStyle='#58655c';ctx.textAlign='center';
    [-1,0,1].forEach((v,i)=>{const x=left+i*pw/2;ctx.fillText(String(v),x,top+ph+25);ctx.textAlign='right';ctx.fillText(String(v),left-15,top+ph-i*ph/2+5);ctx.textAlign='center';});
    ctx.fillText('Feature A · normalized input',left+pw/2,top+ph+61);
    ctx.save();ctx.translate(mobile?12:20,top+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('Feature B · normalized input',0,0);ctx.restore();
    canvas.setAttribute('aria-label',`${activationNames[activation]}: a conceptual two-input response, boundary direction ${angle} degrees, position ${offset.toFixed(2)}.`);
  }
  document.querySelectorAll('[data-activation]').forEach(b=>b.addEventListener('click',()=>{activation=b.dataset.activation;document.querySelectorAll('[data-activation]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));drawSplit();}));
  ['split-angle','split-offset'].forEach(id=>$(id).addEventListener('input',drawSplit));drawSplit();

  const stages=[
    ['FEATURE EMBEDDINGS','Give every input a representation.','A continuous feature passes through a small neural network. A category is mapped to a learned vector. Each feature is still represented separately at this point.','xⱼ → φⱼ(xⱼ)'],
    ['PAIR + INTERACTION TOKEN','Let two features meet.','Bring together two feature vectors and a token learned specifically for that pair. The token lets a shared network distinguish different kinds of relationships.','[φⱼ, φₖ, eⱼₖ]'],
    ['SHARED INTERACTION NETWORK','Reuse the engine, pair by pair.','The same feed-forward network processes every pair. Sharing its weights keeps the architecture compact; the pair tokens supply a source of flexibility.','fθ(φⱼ, φₖ, eⱼₖ)'],
    ['BOUNDED ACTIVATION','Turn the response into regions.','A centered hard sigmoid gives each pair unit an output between zero and one. The learned nonlinear boundary produces the tree-like structure.','hⱼₖ = σhard(fθ(φⱼ, φₖ, eⱼₖ))'],
    ['WEIGHTED SUM + OUTPUT','Assemble the prediction.','Weight and add all 45 units, including the nine single-feature terms. Add a bias, then exponentiate to get annual claim frequency. Exposure converts frequency to an expected count.','λ(x) = exp(b + Σ wⱼₖhⱼₖ)']
  ];
  function drawArchitecture(stage){
    const svg=$('architecture-svg'),colors=['#b8d7a5','#ed9e70','#b8d7a5','#ed9e70','#b8d7a5'];
    const box=(x,y,w,h,label,index)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${stage===index?colors[index]:'#244b3e'}" stroke="${stage===index?colors[index]:'#668471'}"/>${text(x+w/2,y+h/2+5,label,`text-anchor="middle" fill="${stage===index?'#173e35':'#d5e5d4'}" font-size="13"`)}`;
    if(svg.clientWidth<520){
      svg.setAttribute('viewBox','0 0 350 390');
      let s='<g font-family="DM Sans, sans-serif">';
      s+=box(0,15,125,42,'Driver age → φⱼ',0)+box(225,15,125,42,'Bonus–malus → φₖ',0);
      s+='<path d="M62 57V80H175V102M287 57V80H175" fill="none" stroke="#8dab90"/>';
      s+=box(95,102,160,42,'pair + token eⱼₖ',1)+box(95,182,160,50,'shared network fθ',2)+box(95,272,160,42,'hard sigmoid σ',3);
      s+='<path d="M175 144V182M175 232V272M175 314V342" fill="none" stroke="#8dab90"/>';
      s+=text(175,363,'weighted sum → exp → frequency','text-anchor="middle" fill="#c5e5b0" font-size="13"');
      s+=text(270,194,'same','fill="#b8cdbf" font-size="10"')+text(270,210,'network','fill="#b8cdbf" font-size="10"')+text(270,226,'for all pairs','fill="#b8cdbf" font-size="10"');
      svg.innerHTML=s+'</g>';return;
    }
    svg.setAttribute('viewBox','0 0 760 350');
    let s='<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#8dab90"/></marker></defs><g font-family="DM Sans, sans-serif">';
    [[92,91,162,91],[92,191,162,191],[242,91,310,140],[242,191,310,140],[367,140,427,140],[527,140,577,140],[655,140,716,140]].forEach(([x,y,xx,yy])=>{s+=`<path d="M${x},${y} L${xx},${yy}" fill="none" stroke="#8dab90" stroke-width="1.5" marker-end="url(#arrow)"/>`;});
    s+=box(2,70,90,42,'Driver age',0)+box(2,170,90,42,'Bonus–malus',0)+box(162,65,80,52,'φⱼ',0)+box(162,165,80,52,'φₖ',0);
    s+=box(310,111,57,57,'pair',1)+box(299,248,79,36,'token eⱼₖ',1);
    s+='<path d="M339 248V174" stroke="#ed9e70" stroke-dasharray="4 4" marker-end="url(#arrow)"/>';
    s+=box(427,90,100,100,'shared fθ',2)+box(577,108,78,65,'σhard',3);
    s+=`<circle cx="732" cy="140" r="17" fill="${stage===4?'#b8d7a5':'#244b3e'}" stroke="#b8d7a5"/>${text(732,146,'Σ',`text-anchor="middle" fill="${stage===4?'#173e35':'#d5e5d4'}" font-size="23"`)}`;
    s+='<path d="M732 163V232" stroke="#8dab90" marker-end="url(#arrow)"/>';
    s+=text(730,258,'exp(·)','text-anchor="middle" fill="#b8d7a5" font-size="20"')+text(730,287,'frequency','text-anchor="middle" fill="#b8cdbf" font-size="11"');
    s+=text(202,30,'EMBED','text-anchor="middle" fill="#b8cdbf" font-size="10" letter-spacing="2"')+text(477,60,'ONE NETWORK','text-anchor="middle" fill="#b8cdbf" font-size="10" letter-spacing="1"');
    s+=text(482,290,'Repeated for each feature pair','text-anchor="middle" fill="#b8cdbf" font-size="12"')+text(482,312,'Diagonal terms represent one feature','text-anchor="middle" fill="#b8cdbf" font-size="11"');
    svg.innerHTML=s+'</g>';
  }
  function setStage(index){
    const ids=['stage-kicker','stage-title','stage-copy','stage-equation'];ids.forEach((id,i)=>$(id).textContent=stages[index][i]);
    document.querySelectorAll('[data-stage]').forEach(b=>{const selected=Number(b.dataset.stage)===index;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    $('stage-panel').setAttribute('aria-labelledby',`stage-tab-${index}`);drawArchitecture(index);
  }
  document.querySelectorAll('[data-stage]').forEach(b=>{b.addEventListener('click',()=>setStage(Number(b.dataset.stage)));b.addEventListener('keydown',event=>{let idx=Number(b.dataset.stage);if(event.key==='ArrowRight')idx=(idx+1)%5;else if(event.key==='ArrowLeft')idx=(idx+4)%5;else if(event.key==='Home')idx=0;else if(event.key==='End')idx=4;else return;event.preventDefault();setStage(idx);$(`stage-tab-${idx}`).focus();});});setStage(0);

  const model=window.PIN_MODEL;
  let pairIndex=0;
  const plot={left:90,top:24,width:700,height:510,canvasWidth:850,canvasHeight:620};
  function currentPair(){return model.pairs[pairIndex];}
  function drawPair(){
    const canvas=$('pair-canvas'),mobile=canvas.clientWidth<550;
    Object.assign(plot,mobile?{left:58,top:20,width:Math.max(280,canvas.clientWidth)-76,height:Math.max(280,canvas.clientWidth)*.77,canvasWidth:Math.max(280,canvas.clientWidth),canvasHeight:Math.max(280,canvas.clientWidth)*.77+100}:{left:90,top:24,width:700,height:510,canvasWidth:850,canvasHeight:620});
    const p=currentPair(),ctx=canvasContext(canvas,plot.canvasWidth,plot.canvasHeight),nx=p.xValues.length,ny=p.yValues.length;
    const vals=p.values.flat(),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1,dx=plot.width/nx,dy=plot.height/ny;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const px=plot.left+x*dx,py=plot.top+(ny-1-y)*dy;
      ctx.fillStyle=rgb(surfaceColor((p.values[y][x]-lo)/span));ctx.fillRect(px,py,dx+1,dy+1);
      if(!p.supportMask[y][x]){
        ctx.save();ctx.beginPath();ctx.rect(px,py,dx,dy);ctx.clip();ctx.strokeStyle='rgba(30,49,39,.30)';ctx.lineWidth=.7;
        for(let t=-dy;t<dx+dy;t+=7){ctx.beginPath();ctx.moveTo(px+t,py+dy);ctx.lineTo(px+t+dy,py);ctx.stroke();}ctx.restore();
      }
    }
    ctx.font=`${mobile?11:15}px 'DM Sans',sans-serif`;ctx.fillStyle='#58655c';
    for(let k=0;k<5;k++){
      const xi=Math.round(k*(nx-1)/4),yi=Math.round(k*(ny-1)/4);
      ctx.textAlign='center';ctx.fillText(compact(p.xValues[xi]),plot.left+(xi+.5)*dx,plot.top+plot.height+27);
      ctx.textAlign='right';ctx.fillText(compact(p.yValues[yi]),plot.left-14,plot.top+(ny-yi-.5)*dy+5);
    }
    ctx.textAlign='center';ctx.fillText(p.xLabel,plot.left+plot.width/2,plot.top+plot.height+65);
    ctx.save();ctx.translate(mobile?12:21,plot.top+plot.height/2);ctx.rotate(-Math.PI/2);ctx.fillText(p.yLabel+(p.ySpacing==='log'?' · log scale':''),0,0);ctx.restore();
    const ix=Number($('pair-x').value),iy=Number($('pair-y').value),cx=plot.left+(ix+.5)*dx,cy=plot.top+(ny-iy-.5)*dy;
    ctx.strokeStyle='rgba(255,253,246,.7)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(cx,plot.top);ctx.lineTo(cx,plot.top+plot.height);ctx.moveTo(plot.left,cy);ctx.lineTo(plot.left+plot.width,cy);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fillStyle='#173e35';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#fffdf6';ctx.stroke();
    $('pair-low').textContent=signed(lo);$('pair-high').textContent=signed(hi);$('pair-x-output').textContent=compact(p.xValues[ix]);$('pair-y-output').textContent=compact(p.yValues[iy]);$('pair-value').textContent=signed(p.values[iy][ix],4);
    $('pair-support').textContent=`${p.support[iy][ix].toLocaleString('en-US')} learning records in this cell${p.supportMask[iy][ix]?'':' · sparse support'}`;
    $('pair-x').setAttribute('aria-valuetext',`${compact(p.xValues[ix])} ${p.xLabel}`);$('pair-y').setAttribute('aria-valuetext',`${compact(p.yValues[iy])} ${p.yLabel}`);
    $('pair-canvas').setAttribute('aria-label',`${p.label}. Selected ${p.xLabel}: ${p.xValues[ix]}; ${p.yLabel}: ${p.yValues[iy]}. Pair contribution ${p.values[iy][ix].toFixed(4)} on the log-frequency scale.`);
  }
  function selectPair(){
    pairIndex=Number($('pair-select').value);const p=currentPair();
    $('pair-title').textContent=p.label;$('pair-x-label').textContent=p.xLabel;$('pair-y-label').textContent=p.yLabel;
    $('pair-description').textContent='A fitted pair function can vary across the whole surface. Read the pattern together with the data-support overlay.';
    [['pair-x',p.xValues],['pair-y',p.yValues]].forEach(([id,values])=>{$(id).max=values.length-1;$(id).value=Math.floor(values.length/2);});drawPair();
  }
  function showProfile(index){
    const p=model.profiles[index];document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.profile)===index)));
    $('profile-title').textContent=p.label;$('profile-description').textContent=p.description;$('profile-frequency').textContent=(p.frequency*100).toFixed(2);$('profile-baseline').textContent=p.baselineLog.toFixed(4);$('profile-log').textContent=p.logPrediction.toFixed(4);
    const sum=p.contributions.reduce((acc,c)=>acc+c.value,0);$('profile-sum').textContent=signed(sum,4);
    const rows=[...p.contributions].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
    const extent=Math.max(...model.profiles.flatMap(profile=>profile.contributions.map(c=>Math.abs(c.value))))*1.2;
    const mobile=$('shap-chart').clientWidth<550,sw=mobile?360:720,mid=mobile?235:426,half=mobile?76:214,top=35,rowHeight=43;
    $('shap-chart').setAttribute('viewBox',`0 0 ${sw} 470`);
    let s='<g font-family="DM Sans, sans-serif">';
    [-1,-.5,0,.5,1].forEach(t=>{const x=mid+t*half;s+=`<line x1="${x}" x2="${x}" y1="17" y2="420" stroke="${t===0?'#738a74':'#c7d2bd'}" stroke-dasharray="${t===0?'0':'3 5'}"/>`+text(x,450,(t*extent).toFixed(1),'fill="#58655c" font-size="13" text-anchor="middle"');});
    rows.forEach((c,i)=>{const y=top+i*rowHeight,bar=c.value/extent*half;s+=text(0,y+5,c.feature,`fill="#183d34" font-size="${mobile?12:14}"`);s+=`<rect x="${Math.min(mid,mid+bar)}" y="${y-12}" width="${Math.max(Math.abs(bar),1)}" height="23" fill="${c.value>=0?'#b25b39':'#507a5b'}"/>`;s+=text(mobile?sw-1:(c.value>=0?mid+bar+8:mid+bar-8),y+5,signed(c.value),`fill="#183d34" font-size="${mobile?11:12}" text-anchor="${mobile?'end':c.value>=0?'start':'end'}"`);});
    $('shap-chart').innerHTML=s+'</g>';$('shap-chart').setAttribute('aria-label',`${p.label}. Predicted frequency ${p.frequency.toFixed(5)}. Feature log contributions: ${rows.map(c=>`${c.feature} ${signed(c.value)}`).join(', ')}.`);
  }
  if(model?.status==='verified'){
    $('model-loading').hidden=true;$('model-explorer').hidden=false;$('profile-exhibit').hidden=false;
    $('pair-select').innerHTML=model.pairs.map((p,i)=>`<option value="${i}">${escapeText(p.label)}</option>`).join('');
    $('pair-select').addEventListener('change',selectPair);['pair-x','pair-y'].forEach(id=>$(id).addEventListener('input',drawPair));
    $('pair-canvas').addEventListener('pointermove',event=>{
      const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*plot.canvasWidth,y=(event.clientY-rect.top)/rect.height*plot.canvasHeight;
      if(x<plot.left||x>plot.left+plot.width||y<plot.top||y>plot.top+plot.height)return;
      const p=currentPair();$('pair-x').value=clamp(Math.floor((x-plot.left)/plot.width*p.xValues.length),0,p.xValues.length-1);$('pair-y').value=clamp(p.yValues.length-1-Math.floor((y-plot.top)/plot.height*p.yValues.length),0,p.yValues.length-1);drawPair();
    });
    $('model-provenance-summary').textContent=`Exhibits use ${model.model.name} from the authors’ ${model.source.archive}. The released continuous embedding applies a linear layer followed by tanh; the paper describes tanh followed by a linear layer. The ten released models yield ensemble test deviance × 100 of ${model.validation.ensembleTestDeviance.toFixed(6)}, matching the published ${Number(window.PIN_RESEARCH.datasets.france.benchmarks.find(b=>b.kind==='ensemble'&&/PIN/.test(b.name)).test*100).toFixed(3)} after rounding. This agreement does not resolve the architectural difference. The published table and checkpoint demonstration remain distinct sources.`;
    $('profile-tabs').innerHTML=model.profiles.map((p,i)=>`<button type="button" data-profile="${i}" aria-pressed="${i===0}">${escapeText(p.label)}</button>`).join('');
    document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>showProfile(Number(b.dataset.profile))));selectPair();showProfile(0);
  }

  let dataset='france',comparison='ensemble';
  function drawBenchmarks(){
    const data=window.PIN_RESEARCH?.datasets[dataset];if(!data)return;
    const rows=data.benchmarks.filter(b=>b.kind===comparison||b.kind==='baseline').sort((a,b)=>a.test-b.test);
    const pin=rows.find(b=>/PIN/.test(b.name)),next=rows.find(b=>b!==pin),values=rows.map(b=>b.test*100);
    const lo=Math.floor((Math.min(...values)-.05)*10)/10,hi=Math.ceil((Math.max(...values)+.03)*10)/10;
    const mobile=$('benchmark-chart').clientWidth<550,sw=mobile?Math.max(280,$('benchmark-chart').clientWidth):780,left=mobile?0:240,pw=mobile?sw-70:425,top=45,rh=mobile?62:49,height=top+rows.length*rh+30;
    $('benchmark-chart').setAttribute('viewBox',`0 0 ${sw} ${height}`);
    let s='<g font-family="DM Sans, sans-serif">';
    for(let i=0;i<=4;i++){const x=left+pw*i/4;s+=`<line x1="${x}" x2="${x}" y1="20" y2="${top+(rows.length-.5)*rh}" stroke="#456151" stroke-dasharray="3 5"/>`+text(x,height-2,(lo+(hi-lo)*i/4).toFixed(2),'text-anchor="middle" fill="#bfd1c3" font-size="13"');}
    rows.forEach((b,i)=>{
      const y=top+i*rh,x=left+(b.test*100-lo)/(hi-lo)*pw,isPin=/PIN/.test(b.name),label=b.name.replace(/^Ensemble /,'').replace('tree-like PIN','Tree-like PIN').replace('plain-vanilla','Plain-vanilla').replace(' (intercept-only)','');
      if(isPin)s+=`<rect x="0" y="${y-(mobile?29:22)}" width="${sw-2}" height="${mobile?53:44}" fill="#254d3e"/>`;
      s+=text(mobile?6:0,y+(mobile?-13:5),label,`fill="${isPin?'#c5e5b0':'#e0e7da'}" font-size="${mobile?12:14}"`);
      s+=`<line x1="${left}" y1="${y}" x2="${x}" y2="${y}" stroke="${isPin?'#b8d7a5':'#6d8b75'}" stroke-width="2"/>`;
      if(b.sd){const dx=b.sd*100/(hi-lo)*pw;s+=`<line x1="${x-dx}" x2="${x+dx}" y1="${y}" y2="${y}" stroke="#d8e8ce" stroke-width="3"/>`;}
      s+=`<circle cx="${x}" cy="${y}" r="${isPin?6:4}" fill="${isPin?'#b8d7a5':'#e89c70'}"/>`;
      s+=text(sw-7,y+5,(b.test*100).toFixed(3),`text-anchor="end" fill="#e3eddb" font-size="${mobile?12:14}"`);
    });
    $('benchmark-chart').innerHTML=s+'</g>';
    $('benchmark-chart').setAttribute('aria-label',`${data.label}. ${comparison} comparison. Test Poisson deviance times 100, lower is better: ${rows.map(b=>`${b.name}: ${(b.test*100).toFixed(3)}`).join('; ')}.`);
    $('result-kicker').textContent=`${dataset==='france'?'FRENCH':'BELGIAN'} MTPL · ${comparison==='ensemble'?'ENSEMBLE PIN':'MEAN PIN FIT'}`;
    $('result-score').textContent=(pin.test*100).toFixed(3);$('result-policies').textContent=data.policies.toLocaleString('en-US');$('result-parameters').textContent=data.parameters.toLocaleString('en-US');
    $('result-comparison').textContent=`${((next.test-pin.test)/next.test*100).toFixed(2)}% lower loss than ${next.name.replace(/^Ensemble /,'ensemble ')} in this comparison. ${comparison==='single'?'Whiskers show one reported standard deviation across runs, not confidence intervals.':'The ensemble averages ten independently fitted predictors.'}`;
    const tbody=document.createElement('tbody');tbody.innerHTML=data.benchmarks.map(b=>`<tr><th scope="row">${escapeText(b.name)}</th><td>${compact(b.parameters)}${b.parameterBasis==='effective degrees of freedom'?' (EDF)':''}</td><td>${(b.train*100).toFixed(3)}${b.trainSd?` (${(b.trainSd*100).toFixed(3)})`:''}</td><td>${(b.test*100).toFixed(3)}${b.sd?` (${(b.sd*100).toFixed(3)})`:''}</td></tr>`).join('');
    const existing=$('benchmark-table').querySelector('tbody');if(existing)existing.replaceWith(tbody);else $('benchmark-table').append(tbody);
    $('benchmark-table').querySelector('caption').textContent=`${data.label} · published Table ${dataset==='france'?'2':'4'} · deviance × 100 · parentheses: SD across runs`;
  }
  document.querySelectorAll('[data-dataset]').forEach(b=>b.addEventListener('click',()=>{dataset=b.dataset.dataset;document.querySelectorAll('[data-dataset]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));drawBenchmarks();}));
  document.querySelectorAll('[data-comparison]').forEach(b=>b.addEventListener('click',()=>{comparison=b.dataset.comparison;document.querySelectorAll('[data-comparison]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));drawBenchmarks();}));drawBenchmarks();

  const citation='@article{richman2026pin,\n  title={Tree-like pairwise interaction networks},\n  author={Richman, Ronald and Scognamiglio, Salvatore and W{\\"u}thrich, Mario},\n  journal={Annals of Actuarial Science},\n  year={2026},\n  doi={10.1017/S1748499526100402}\n}';
  $('copy-citation').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(citation);$('citation-copy-label').textContent='Citation copied';}
    catch{const blob=new Blob([citation],{type:'text/plain'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='richman-scognamiglio-wuthrich-2026.bib';link.click();URL.revokeObjectURL(url);$('citation-copy-label').textContent='Citation downloaded';}
  });
  new ResizeObserver(drawHero).observe(heroCanvas);
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{drawSplit();drawArchitecture(Number(document.querySelector('[data-stage][aria-selected="true"]').dataset.stage));drawBenchmarks();if(model?.status==='verified'){drawPair();showProfile(Number(document.querySelector('[data-profile][aria-pressed="true"]').dataset.profile));}},100);});
})();
