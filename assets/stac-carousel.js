/* Featured-work carousels (all pages) and the AI abbreviation explainer.
   The carousel drifts in an endless loop: the visible cards are followed by clones,
   and the offset wraps once a full set has scrolled past. The card nearest the middle
   is lifted smoothly, hovering slows it to a stop, arrows glide one card, and on touch
   screens it can be dragged. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css=''+
  '.fp-track3.fp-loop{transition:none!important;position:relative;will-change:transform;}'+
  '.fp-viewport3{touch-action:pan-y;}'+
  '.abx{position:relative;margin:-6px 0 26px;padding:16px 20px 18px;background:#fff;border-radius:14px;min-height:96px;overflow:hidden;}'+
  '.abx-top{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;}'+
  '.abx-tag{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#6B8FAA;font-weight:600;}'+
  '.abx-term{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:clamp(26px,3vw,36px);line-height:1;color:#0B1A2E;white-space:nowrap;}'+
  '.abx-term b{color:var(--techdk,#0C7A6E);font-weight:800;}'+
  '.abx-r{display:inline-block;vertical-align:bottom;max-width:0;overflow:hidden;white-space:pre;opacity:0;transition:max-width .75s cubic-bezier(.65,0,.35,1),opacity .5s ease;}'+
  '.abx.on .abx-r{max-width:var(--w);opacity:1;}'+
  '.abx-desc{margin-top:8px;font-size:13.5px;line-height:1.6;color:var(--muted,#5A7A9A);max-width:640px;opacity:0;transform:translateY(6px);transition:opacity .5s ease .45s,transform .5s ease .45s;}'+
  '.abx.on .abx-desc{opacity:1;transform:none;}'+
  '.abx-bar{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--techdk,#0C7A6E);opacity:.5;transform-origin:left;transform:scaleX(0);}'+
  '.abx-bar.run{transition:transform linear;transform:scaleX(1);}'+
  '.fp-filter-btn.abx-hit{border-color:var(--techdk,#0C7A6E);}'+
  '@media(max-width:600px){.abx{padding:14px 16px 16px;min-height:112px;}.abx-term{white-space:normal;}}'+
  '@media(prefers-reduced-motion:reduce){.abx-r,.abx-desc{transition:none;}}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  function lang(){ return document.documentElement.lang==='nl'?'nl':'en'; }
  var langWatchers=[];
  new MutationObserver(function(){ setTimeout(function(){ langWatchers.forEach(function(f){f();}); },0); })
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

  /* ---------- carousel ---------- */
  function Carousel(wrap){
    var viewport=wrap.querySelector('.fp-viewport3'), track=wrap.querySelector('.fp-track3');
    if(!viewport||!track) return;
    var originals=[].slice.call(track.querySelectorAll('.fp-card3'));
    if(!originals.length) return;
    var prevBtn=wrap.querySelector('.fp-arrow3.prev'), nextBtn=wrap.querySelector('.fp-arrow3.next');
    var filters=wrap.parentElement.querySelector('.fp-filters');
    var SPEED=reduce?0:26;               // px per second
    var offset=0,setW=0,step=0,looping=false,lift=false,cards=[],base=1;
    var vel=SPEED,hover=false,holdUntil=0,tween=null,visible=false,raf=0,last=0,drag=null;
    track.classList.add('fp-loop');

    function build(){
      track.querySelectorAll('.fp-clone').forEach(function(c){c.remove();});
      var vis=originals.filter(function(c){return c.style.display!=='none';});
      cards=vis.slice();
      originals.forEach(function(c){c.style.transform='';c.style.opacity='';c.classList.remove('is-center');});
      if(!vis.length){ track.style.transform=''; return; }
      var r=vis[0].getBoundingClientRect(), m=parseFloat(getComputedStyle(vis[0]).marginRight)||0;
      step=r.width+m; setW=step*vis.length;
      base=parseFloat(getComputedStyle(vis[0]).opacity)||1;
      var vw=viewport.clientWidth;
      lift=Math.round(vw/step)>=3;
      looping=setW>vw+step*0.5;
      if(looping){
        var copies=Math.ceil((vw+step)/setW);
        for(var k=0;k<copies;k++) vis.forEach(function(c){
          var cl=c.cloneNode(true);
          cl.classList.add('fp-clone'); cl.setAttribute('aria-hidden','true'); cl.setAttribute('inert','');
          track.appendChild(cl); cards.push(cl);
        });
        offset=mod(step/2-m/2-vw/2,setW);   // first card starts in the middle
      }else{
        offset=-(vw-(setW-m))/2;             // too few to loop: centre them
      }
      cards.forEach(function(c){c.style.transition='box-shadow .4s ease';});
      paint();
      var panel=wrap.closest('.fp-panel');
      if(panel&&panel.classList.contains('open')) panel.style.maxHeight=panel.scrollHeight+'px';
    }
    function mod(a,n){ return ((a%n)+n)%n; }
    function paint(){
      if(looping) offset=mod(offset,setW);
      track.style.transform='translateX('+(-offset)+'px)';
      var mid=viewport.clientWidth/2, best=null, bd=1e9;
      cards.forEach(function(c){
        var d=Math.abs(c.offsetLeft+c.offsetWidth/2-offset-mid)/step;
        if(d<bd){bd=d;best=c;}
        if(!lift){ c.style.transform=''; c.style.opacity=''; return; }
        var k=Math.max(0,1-d); k=k*k*(3-2*k);
        c.style.transform=k>0.001?'translateY('+(-16*k).toFixed(2)+'px) scale('+(1+0.07*k).toFixed(4)+')':'';
        c.style.opacity=(base+(1-base)*k).toFixed(3);
        c.style.zIndex=k>0.5?'2':'';
      });
      cards.forEach(function(c){c.classList.toggle('is-center',lift&&c===best&&bd<0.5);});
    }
    function ease(t){ return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
    function frame(t){
      raf=0; if(!visible||!cards.length) return;
      var dt=last?Math.min(0.05,(t-last)/1000):0; last=t;
      if(tween){
        var p=Math.min(1,(t-tween.t0)/tween.d);
        offset=tween.from+(tween.to-tween.from)*ease(p);
        if(p>=1) tween=null;
      }else if(looping&&!drag){
        var target=(hover||t<holdUntil)?0:SPEED;
        vel+=(target-vel)*Math.min(1,dt*(target?1.2:4));
        offset+=vel*dt;
      }
      paint();
      raf=requestAnimationFrame(frame);
    }
    function start(){ if(!raf&&visible){ last=0; raf=requestAnimationFrame(frame); } }
    function nudge(dir){
      if(!cards.length) return;
      if(!looping){ return; }
      var mid=viewport.clientWidth/2, m=step-cards[0].offsetWidth;
      var pos=(offset+mid-(step/2-m/2))/step;          // which card sits in the middle, as a fraction
      var to=(Math.round(pos)+dir)*step-mid+step/2-m/2;
      tween={from:offset,to:to,t0:performance.now(),d:reduce?1:650};
      vel=0; holdUntil=performance.now()+3500; start();
    }
    if(prevBtn) prevBtn.addEventListener('click',function(){nudge(-1);});
    if(nextBtn) nextBtn.addEventListener('click',function(){nudge(1);});
    wrap.addEventListener('mouseenter',function(){hover=true;});
    wrap.addEventListener('mouseleave',function(){hover=false;});
    wrap.addEventListener('focusin',function(){hover=true;});
    wrap.addEventListener('focusout',function(){hover=false;});

    // touch drag
    viewport.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||!looping) return;
      drag={x:e.clientX,o:offset,id:e.pointerId}; tween=null; vel=0;
    });
    viewport.addEventListener('pointermove',function(e){
      if(!drag||e.pointerId!==drag.id) return;
      offset=drag.o-(e.clientX-drag.x); paint();
    });
    function endDrag(){ if(drag){ drag=null; holdUntil=performance.now()+2500; nudge(0); } }
    viewport.addEventListener('pointerup',endDrag);
    viewport.addEventListener('pointercancel',endDrag);

    if(filters){
      var btns=filters.querySelectorAll('.fp-filter-btn');
      btns.forEach(function(btn){
        btn.addEventListener('click',function(){
          btns.forEach(function(b){b.classList.remove('active');});
          btn.classList.add('active');
          var tag=btn.getAttribute('data-filter');
          originals.forEach(function(c){
            var tags=(c.getAttribute('data-tags')||'').split(',');
            c.style.display=(tag==='all'||tags.indexOf(tag)!==-1)?'':'none';
          });
          build(); start();
        });
      });
    }

    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        visible=es[es.length-1].isIntersecting;
        if(visible){ build(); start(); }
      }).observe(wrap);
    }else{ visible=true; }
    var rt; window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(function(){build();start();},150); });
    langWatchers.push(build);
    build(); start();
  }

  /* ---------- abbreviation explainer (AI filters) ---------- */
  // [Brackets] mark the letters the abbreviation is made of.
  var TERMS={
    ml:{t:'[M]achine [L]earning',en:'Software that learns patterns from your data to predict what comes next.',
        nl:'Machinaal leren: software die patronen uit uw data leert om te voorspellen wat er komt.'},
    genai:{t:'[Gen]erative [AI]',en:'AI that creates new text, images or code on request.',
        nl:'Generatieve AI: AI die op verzoek nieuwe tekst, beelden of code maakt.'},
    analytics:{t:'[B]usiness [I]ntelligence',en:'Dashboards and reports that turn your numbers into decisions.',
        nl:'Dashboards en rapporten die uw cijfers omzetten in beslissingen.'},
    xai:{t:'e[X]plainable [AI]',en:'AI that shows why it made each prediction, so you can trust it.',
        nl:'Verklaarbare AI: AI die laat zien waarom het elke voorspelling doet, zodat u erop kunt vertrouwen.'},
    nlp:{t:'[N]atural [L]anguage [P]rocessing',en:'Software that reads and understands written and spoken language.',
        nl:'Natuurlijke taalverwerking: software die geschreven en gesproken taal leest en begrijpt.'},
    cv:{t:'[C]omputer [V]ision',en:'Software that sees: it recognises and measures objects in images.',
        nl:'Computervisie: software die ziet en objecten in beelden herkent en meet.'},
    rl:{t:'[R]einforcement [L]earning',en:'AI that learns by trial and error, the way you would practise a skill.',
        nl:'Reinforcement learning: AI die leert door uitproberen, zoals u een vaardigheid oefent.'}
  };
  var HOLD=4200;

  function Explainer(filters){
    var btns=[].slice.call(filters.querySelectorAll('.fp-filter-btn')).filter(function(b){return TERMS[b.getAttribute('data-filter')];});
    if(btns.length<2) return;
    filters.querySelectorAll('.fp-info-dot').forEach(function(d){d.remove();});
    var box=document.createElement('div');
    box.className='abx'; box.setAttribute('aria-live','polite');
    box.innerHTML='<div class="abx-top"><span class="abx-tag"></span><span class="abx-term"></span></div><div class="abx-desc"></div><span class="abx-bar"></span>';
    filters.parentNode.insertBefore(box,filters.nextSibling);
    var tag=box.querySelector('.abx-tag'), term=box.querySelector('.abx-term'), desc=box.querySelector('.abx-desc'), bar=box.querySelector('.abx-bar');
    var i=0,cur=null,timer=0,swap=0,locked=null,hovered=null,visible=false;

    function html(t){
      return t.replace(/\[([^\]]+)\]|([^\[]+)/g,function(_,h,r){
        return h?'<b>'+h+'</b>':'<span class="abx-r">'+r+'</span>';
      });
    }
    function show(key,instant){
      if(key===cur&&!instant) return;
      cur=key;
      btns.forEach(function(b){b.classList.toggle('abx-hit',b.getAttribute('data-filter')===key);});
      clearTimeout(swap);
      box.classList.remove('on');
      swap=setTimeout(function(){
        var T=TERMS[key];
        tag.textContent=lang()==='nl'?'Uitgelegd':'Decoded';
        term.innerHTML=html(T.t);
        desc.textContent=lang()==='nl'?T.nl:T.en;
        term.querySelectorAll('.abx-r').forEach(function(s,n){
          s.style.setProperty('--w',(s.scrollWidth+2)+'px');
          s.style.transitionDelay=(n*90)+'ms';
        });
        void box.offsetWidth;
        box.classList.add('on');
      },(instant||reduce)?0:420);
    }
    function runBar(){
      bar.classList.remove('run'); bar.style.transitionDuration='0ms'; void bar.offsetWidth;
      if(locked||hovered||reduce) return;
      bar.style.transitionDuration=HOLD+'ms'; bar.classList.add('run');
    }
    function cycle(){
      clearTimeout(timer);
      if(!visible||locked||hovered) { runBar(); return; }
      show(btns[i%btns.length].getAttribute('data-filter'));
      runBar();
      timer=setTimeout(function(){ i++; cycle(); },HOLD);
    }
    btns.forEach(function(b,n){
      var key=b.getAttribute('data-filter');
      function enter(){ hovered=key; i=n; show(key); cycle(); }
      function leave(){ hovered=null; if(locked) show(locked); timer=setTimeout(function(){ i=n+1; cycle(); },locked?0:1200); runBar(); }
      b.addEventListener('mouseenter',enter); b.addEventListener('focus',enter);
      b.addEventListener('mouseleave',leave); b.addEventListener('blur',leave);
    });
    filters.querySelectorAll('.fp-filter-btn').forEach(function(b){
      b.addEventListener('click',function(){
        var key=b.getAttribute('data-filter');
        locked=TERMS[key]?key:null;
        if(locked){ i=btns.indexOf(b); show(locked); }
        cycle();
      });
    });
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        var v=es[es.length-1].isIntersecting;
        if(v&&!visible){ visible=true; cycle(); } else if(!v){ visible=false; clearTimeout(timer); }
      }).observe(box);
    }else{ visible=true; }
    langWatchers.push(function(){ if(cur) show(cur,true); });
    show(btns[0].getAttribute('data-filter'),true);
  }

  function init(){
    document.querySelectorAll('.fp-filters').forEach(Explainer);
    document.querySelectorAll('.fp-carousel3').forEach(Carousel);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
