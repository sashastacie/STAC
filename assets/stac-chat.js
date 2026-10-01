/* STAC chat assistant. Answers come only from window.STAC_CHAT_DATA (approved
   copy in content/chatbot-faq.md). No AI, no server, nothing leaves the page. */
(function(){
  'use strict';
  var DATA=window.STAC_CHAT_DATA||[]; if(!DATA.length) return;
  // Site root, worked out from this script's own address, so the chat also works
  // on pages in sub-folders (e.g. tools/readiness.html) and on the /STAC/ path.
  var me=document.currentScript||[].slice.call(document.scripts).filter(function(s){ return /stac-chat\.js/.test(s.src); })[0];
  var ROOT=me&&me.src?me.src.replace(/assets\/stac-chat\.js.*$/,''):'';

  var UI={
    en:{title:'STAC assistant',status:'Online · instant answers',open:'Chat with STAC',close:'Close chat',
        hint:'Questions? Ask STAC.',placeholder:'Type your question…',send:'Send',
        note:'Automated answers from STAC. For anything else, talk to the team.',
        greet:"Hi! I'm the STAC assistant. Ask me anything about our services, how we work, or how to get started.",
        miss:"Good question. I don't have a ready answer for that one. Want to send it to the team? They read every message and reply personally.",
        human:'Talk to a person',contact:'Go to the contact form',sendTeam:'Send this question to the team',also:'You might also mean:',
        handoff:"Great, I'll take you to the contact form with your question filled in."},
    nl:{title:'STAC-assistent',status:'Online · direct antwoord',open:'Chat met STAC',close:'Chat sluiten',
        hint:'Vragen? Vraag het STAC.',placeholder:'Typ uw vraag…',send:'Versturen',
        note:'Automatische antwoorden van STAC. Voor al het andere: praat met het team.',
        greet:'Hallo! Ik ben de STAC-assistent. Stel mij gerust een vraag over onze diensten, onze werkwijze of hoe u kunt beginnen.',
        miss:'Goede vraag. Daar heb ik geen kant-en-klaar antwoord op. Wilt u de vraag doorsturen naar het team? Zij lezen elk bericht en reageren persoonlijk.',
        human:'Praat met een persoon',contact:'Naar het contactformulier',sendTeam:'Stuur deze vraag naar het team',also:'Misschien bedoelt u ook:',
        handoff:'Top, ik breng u naar het contactformulier met uw vraag alvast ingevuld.'}
  };
  var POPULAR=[51,9,17,11,47];
  var STOP={
    en:'a an the and or of to in on for with is are am be do does did can could would should will you your we our us i me my it this that what which who how when where why there any about from at by as have has had please tell know want need make get work working whats re help wanna gonna like would',
    nl:'een de het en of van naar in op voor met is zijn ben wordt doen doet kan kunnen zou zal jullie jij je u uw wij we ons onze ik mij mijn het dit dat wat welke wie hoe wanneer waar waarom er iets over uit bij als heb heeft hebben graag vertel weten wil willen nodig ook maken laten krijgen werken werkt helpen help hulp zou'
  };
  var stopEN={}, stopNL={};
  STOP.en.split(' ').forEach(function(w){ stopEN[w]=1; });
  STOP.nl.split(' ').forEach(function(w){ stopNL[w]=1; });

  /* ---------- text helpers ---------- */
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function words(s){ return norm(s).split(' ').filter(Boolean); }
  function content(ws){ return ws.filter(function(w){ return w.length>1&&!stopEN[w]&&!stopNL[w]; }); }
  function lev(a,b){
    if(Math.abs(a.length-b.length)>2) return 9;
    var prev=[],cur,i,j;
    for(j=0;j<=b.length;j++) prev[j]=j;
    for(i=1;i<=a.length;i++){ cur=[i]; for(j=1;j<=b.length;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; }
    return prev[b.length];
  }
  function siteLang(){ return (document.documentElement.lang||'en').toLowerCase().indexOf('nl')===0?'nl':'en'; }
  // Answer in the visitor's language: Dutch when they type Dutch, else the site's language.
  function detectLang(text){
    var en=0,nl=0; words(text).forEach(function(w){ if(stopEN[w]&&!stopNL[w]) en++; if(stopNL[w]&&!stopEN[w]) nl++; });
    return nl>en?'nl':en>nl?'en':siteLang();
  }

  /* ---------- matching ---------- */
  var INDEX=DATA.map(function(d){
    var qset={}, all={};
    content(words(d.q.en+' '+d.q.nl)).forEach(function(w){ qset[w]=1; all[w]=1; });
    content(words(d.k)).forEach(function(w){ all[w]=1; });
    return {d:d,q:qset,all:Object.keys(all)};
  });
  // Light stemming so "prices"/"price" and "campagnes"/"campagne" count as the same word
  function stem(w){
    if(w.length>5&&/ies$/.test(w)) return w.slice(0,-3)+'y';
    if(w.length>5&&/(s|x|ch|sh)es$/.test(w)) return w.slice(0,-2);      // boxes, taxes
    if(w.length>5&&/en$/.test(w)) return w.slice(0,-2);                 // Dutch plurals
    if(w.length>4&&/s$/.test(w)&&!/ss$/.test(w)) return w.slice(0,-1);  // prices, but not "process"
    return w;
  }
  function scoreEntry(e,qw){
    var s=0;
    qw.forEach(function(w){
      var best=0, sw=stem(w);
      for(var i=0;i<e.all.length;i++){
        var t=e.all[i], v=0;
        if(t===w||stem(t)===sw) v=3;
        else if(w.length>=4&&t.length>=4&&(t.indexOf(w)===0||w.indexOf(t)===0)) v=2;
        else if(w.length>=5){ var d=lev(w,t); if(d===1) v=2.5; else if(d===2&&w.length>=8) v=1.5; }  // typos
        if(v>best) best=v;
        if(best===3) break;
      }
      if(best&&e.q[w]) best+=0.5;          // words from the question itself weigh a bit more
      s+=best;
    });
    return s;
  }
  // Ties go to answers marked as preferred (p, from chatbot-keywords.tsv), e.g. the
  // general "What services do you offer?" over "Do I have to use all three services?".
  function match(text){
    var qw=content(words(text)); if(!qw.length) return [];
    return INDEX.map(function(e){ return {d:e.d,s:scoreEntry(e,qw)}; })
      .filter(function(r){ return r.s>=2.5; })
      .sort(function(a,b){ return b.s-a.s||(b.d.p||0)-(a.d.p||0)||a.d.id-b.d.id; });
  }

  /* ---------- state ---------- */
  var KEY='stac_chat_log', log=[];
  try{ log=JSON.parse(sessionStorage.getItem(KEY)||'[]'); }catch(e){ log=[]; }
  function save(){ try{ sessionStorage.setItem(KEY,JSON.stringify(log.slice(-40))); }catch(e){} }
  function byId(id){ for(var i=0;i<DATA.length;i++) if(DATA[i].id===id) return DATA[i]; return null; }

  /* ---------- DOM ---------- */
  var root=document.body, t=UI[siteLang()];
  var MARK=ROOT+'assets/chat-icon.png';   // cropped 128px STAC mark (the favicon file is 320 KB)
  var el=function(tag,cls,txt){ var n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; };

  var launch=el('button','sc-launch'); launch.type='button';
  // The STAC mark with a small speech-bubble badge: on-brand, but still clearly "chat"
  launch.innerHTML='<img class="sc-mark" src="'+MARK+'" alt=""/><span class="sc-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.3 1 4.4 2.8 6L4 21.5l4.3-2.1c1.2.4 2.4.6 3.7.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg></span>';
  var hint=el('div','sc-hint');
  var panel=el('div','sc-panel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','false');
  panel.innerHTML='<div class="sc-head"><div class="sc-av"><img alt=""/></div><div class="sc-title"><b></b><span></span></div><button type="button" class="sc-x">&times;</button></div>'+
    '<div class="sc-log" aria-live="polite"></div><div class="sc-chips"></div>'+
    '<form class="sc-form" autocomplete="off"><input type="text" maxlength="300"/><button type="submit" disabled><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15 12 3.4 13.9z"/></svg></button></form>'+
    '<div class="sc-note"></div>';
  panel.querySelector('.sc-av img').src=MARK;
  var logEl=panel.querySelector('.sc-log'), chipsEl=panel.querySelector('.sc-chips'), form=panel.querySelector('.sc-form');
  var input=form.querySelector('input'), sendBtn=form.querySelector('button'), closeBtn=panel.querySelector('.sc-x');
  root.appendChild(hint); root.appendChild(panel); root.appendChild(launch);

  function labels(){
    t=UI[siteLang()];
    launch.setAttribute('aria-label',t.open); hint.textContent=t.hint;
    panel.setAttribute('aria-label',t.title);
    panel.querySelector('.sc-title b').textContent=t.title;
    panel.querySelector('.sc-title span').textContent=t.status;
    closeBtn.setAttribute('aria-label',t.close);
    input.placeholder=t.placeholder; input.setAttribute('aria-label',t.placeholder);
    sendBtn.setAttribute('aria-label',t.send);
    panel.querySelector('.sc-note').textContent=t.note;
  }
  labels();
  // Follow the site's EN/NL switch
  new MutationObserver(function(){ labels(); if(lastChips) chips(lastChips.ids,lastChips.lang); })
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

  /* ---------- rendering ---------- */
  function addText(who,text){
    var m=el('div','sc-msg '+(who==='user'?'sc-user':'sc-bot'));
    // Make the e-mail address clickable without injecting HTML
    var parts=String(text).split(/(info@stacinternational\.com)/);
    parts.forEach(function(p){
      if(p==='info@stacinternational.com'){ var a=el('a',null,p); a.href='mailto:'+p; m.appendChild(a); }
      else if(p) m.appendChild(document.createTextNode(p));
    });
    logEl.appendChild(m); scroll();
  }
  function addAction(label,fn){
    var box=el('div','sc-act'), b=el('button',null,label); b.type='button'; b.onclick=fn; box.appendChild(b);
    logEl.appendChild(box); scroll();
  }
  function scroll(){ logEl.scrollTop=logEl.scrollHeight; }
  var lastChips=null;
  function chips(ids,lang){
    lastChips={ids:ids,lang:lang};
    var L=siteLang(); chipsEl.innerHTML='';
    ids.forEach(function(id){
      var d=byId(id); if(!d) return;
      var b=el('button',null,d.q[L]); b.type='button';
      b.onclick=function(){ ask(d.q[L],d); };
      chipsEl.appendChild(b);
    });
    var h=el('button','human',UI[L].human); h.type='button';
    h.onclick=function(){ handoff(''); };
    chipsEl.appendChild(h);
    chipsEl.scrollLeft=0;
  }
  var typingEl=null, busy=false;
  function botSay(text,after){
    busy=true;
    typingEl=el('div','sc-typing'); typingEl.innerHTML='<i></i><i></i><i></i>'; logEl.appendChild(typingEl); scroll();
    var delay=Math.min(1400,450+text.length*6);
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) delay=150;
    setTimeout(function(){
      if(typingEl){ typingEl.remove(); typingEl=null; }
      addText('bot',text); log.push({w:'bot',t:text}); save();
      busy=false; if(after) after();
    },delay);
  }

  /* ---------- conversation ---------- */
  // Business types: when a visitor says what kind of business they run, add one
  // tailored line after the answer. Examples stay within STAC's real services, and
  // the "we've done this" parts refer to work shown on the site.
  var INDUSTRIES=[
    {key:'food', re:/\b(food|foods|restaurant|restaurants|bakery|bakeries|baker|bakers|cafe|coffee|catering|lunchroom|snackbar|bar|kitchen|horeca|eten|bakkerij|restaurantje|koffie|cookie|cookies|cake|cakes|pastry|pastries|dessert|desserts|sweets|chocolate|ice cream|food truck|koekjes|koek|taart|taarten|gebak|banketbakker|ijs)\b/,
     en:"For a food business, that could mean automating orders, stock counts and invoices, a live dashboard of daily sales, or running your menu and social media posts. We've already run social media for a bakery and a restaurant.",
     nl:'Voor een foodbedrijf kan dat betekenen: bestellingen, voorraadtellingen en facturen automatiseren, een live dashboard van de dagomzet, of uw menu- en social media posts verzorgen. We hebben al social media gedaan voor een bakkerij en een restaurant.'},
    {key:'retail', re:/\b(shop|shops|store|stores|retail|webshop|boutique|winkel|winkels|supermarket|supermarkt|minimarket)\b/,
     en:'For a shop, that could mean automating stock and supplier orders, a sales dashboard per product, an online shop, or a weekly rhythm of product posts. We already manage social media for a general store.',
     nl:'Voor een winkel kan dat betekenen: voorraad en leveranciersbestellingen automatiseren, een verkoopdashboard per product, een webshop, of een vast weekritme van productposts. We beheren al social media voor een buurtwinkel.'},
    {key:'wellness', re:/\b(salon|massage|spa|beauty|wellness|clinic|kliniek|kapper|barber|nails|fitness|gym|studio)\b/,
     en:"For a salon or studio, that could mean automated booking reminders and invoices, a simple dashboard of bookings and revenue, or content that fills your agenda. We've run social media for a massage studio.",
     nl:'Voor een salon of studio kan dat betekenen: automatische boekingsherinneringen en facturen, een eenvoudig dashboard van boekingen en omzet, of content die uw agenda vult. We hebben social media gedaan voor een massagestudio.'},
    {key:'transport', re:/\b(truck|trucks|transport|logistics|logistiek|fleet|vloot|delivery|bezorging|garage|workshop|werkplaats|dealer|dealership)\b/,
     en:"For transport or a garage, that could mean predicting maintenance before breakdowns, a live fleet dashboard, or automated workshop paperwork. We've built predictive maintenance for a large truck dealership.",
     nl:'Voor transport of een garage kan dat betekenen: onderhoud voorspellen vóór er iets kapotgaat, een live vlootdashboard, of automatische werkplaatsadministratie. We hebben voorspellend onderhoud gebouwd voor een grote truckdealer.'}
  ];
  var industryShown={};
  function detectIndustry(text){
    var w=norm(text);
    for(var i=0;i<INDUSTRIES.length;i++) if(INDUSTRIES[i].re.test(w)) return INDUSTRIES[i];
    return null;
  }
  // "cookie business", "we run a bakery": only a business type, no real question.
  // Those get the business-type examples and the contact button, not a loose keyword match.
  var GENERIC={business:1,businesses:1,company:1,companies:1,firm:1,own:1,owner:1,run:1,running:1,sell:1,selling:1,sells:1,small:1,local:1,im:1,bedrijf:1,bedrijfje:1,zaak:1,zaakje:1,onderneming:1,eigen:1,verkoop:1,verkopen:1,klein:1,kleine:1};
  function onlyBusinessType(text,ind){
    return content(words(text)).every(function(w){ return GENERIC[w]||ind.re.test(w); });
  }
  function route(text){
    var ind=detectIndustry(text);
    return ind&&onlyBusinessType(text,ind)?[]:match(text);
  }
  // The tailored line, once per business type per visit, after the main reply
  function industryLine(text,lang,then){
    var ind=detectIndustry(text);
    if(!ind||industryShown[ind.key]){ if(then) then(); return; }
    industryShown[ind.key]=true;
    track('chat-industry-'+ind.key,'Chat: visitor mentioned a '+ind.key+' business');
    botSay(ind[lang],then);
  }

  // Hand-picked follow-ups where the default (same topic group) isn't the best next step
  var NEXT={51:[22,31,40]};   // "What services do you offer?" -> dig into one discipline
  var CONTACT_AFTER={51:1};   // answers that end by pointing to the contact form get a button for it
  function followUps(d){
    if(NEXT[d.id]) return NEXT[d.id].slice();
    var same=DATA.filter(function(x){ return x.cat===d.cat&&x.id!==d.id; });
    var start=same.findIndex(function(x){ return x.id>d.id; }); if(start<0) start=0;
    var pick=[]; for(var i=0;i<same.length&&pick.length<2;i++) pick.push(same[(start+i)%same.length].id);
    if(d.id!==9&&pick.indexOf(9)<0) pick.push(9);
    return pick;
  }
  function ask(text,forced){
    if(busy) return;
    text=String(text).trim(); if(!text) return;
    addText('user',text); log.push({w:'user',t:text}); save();
    var lang=forced?siteLang():detectLang(text);
    if(forced){ answer(forced,lang); return; }
    var res=route(text);
    if(!res.length){
      track('chat-no-answer','Chat: question without an answer');
      // A known business type still gets relevant examples before the hand-off
      var ind=detectIndustry(text);
      if(ind&&!industryShown[ind.key]){
        industryLine(text,lang,function(){
          addAction(UI[lang].sendTeam,function(){ handoff(text); });
          chips(POPULAR,lang);
        });
        return;
      }
      botSay(UI[lang].miss,function(){
        addAction(UI[lang].sendTeam,function(){ handoff(text); });
        chips(POPULAR,lang);
      });
      return;
    }
    answer(res[0].d,lang,res[1]&&res[1].s>=res[0].s*.85?res[1].d:null,text);
  }
  function track(name,title){ if(window.stacTrack) window.stacTrack(name,title); }   // counts only; never the typed text
  function answer(d,lang,alt,text){
    track('chat-answer-'+d.id,'Chat answer: '+d.q.en);
    botSay(d.a[lang],function(){
      var ids=followUps(d);
      if(alt&&ids.indexOf(alt.id)<0) ids.unshift(alt.id);
      var done=function(){
        if(CONTACT_AFTER[d.id]) addAction(UI[lang].contact,function(){ handoff(''); });
        chips(ids,lang);
      };
      if(text) industryLine(text,lang,done); else done();
    });
  }

  /* ---------- hand-off to the contact form ---------- */
  function handoff(q){
    var L=siteLang();
    track(q?'chat-question-to-team':'chat-talk-to-person',q?'Chat: question sent to the team':'Chat: talk to a person');
    var form=document.getElementById('ctform-el');
    if(!form){                                        // other pages: carry the question over
      try{ sessionStorage.setItem('stac_chat_q',q||''); }catch(e){}
      location.href=ROOT+'index.html#contact'; return;
    }
    if(q) botSay(UI[L].handoff,go); else go();
    function go(){
      setOpen(false);
      var c=document.getElementById('contact'); if(c) c.scrollIntoView({behavior:'smooth',block:'start'});
      fill(q);
    }
  }
  function fill(q){
    var ta=document.getElementById('ta'); if(!ta) return;
    if(q) ta.value=q;
    setTimeout(function(){ var n=document.getElementById('c-name'); if(n) n.focus({preventScroll:true}); },600);
  }
  // Arriving on the home page from another page's hand-off
  try{
    var carried=sessionStorage.getItem('stac_chat_q');
    if(carried!==null&&document.getElementById('ctform-el')){ sessionStorage.removeItem('stac_chat_q'); fill(carried); }
  }catch(e){}

  /* ---------- open / close ---------- */
  var greeted=false, openedAt=0;
  function setOpen(on){
    if(on) openedAt=Date.now();
    document.documentElement.classList.toggle('sc-open',on);
    launch.setAttribute('aria-expanded',on?'true':'false');
    if(on){
      if(!document.documentElement.classList.contains('sc-open-counted')){ track('chat-open','Chat opened'); document.documentElement.classList.add('sc-open-counted'); }
      launch.classList.add('seen'); hint.classList.remove('on');
      try{ sessionStorage.setItem('stac_chat_seen','1'); }catch(e){}
      if(!greeted){
        greeted=true;
        if(log.length){ log.forEach(function(m){ addText(m.w==='user'?'user':'bot',m.t); }); chips(POPULAR,siteLang()); }
        else botSay(UI[siteLang()].greet,function(){ chips(POPULAR,siteLang()); });
      }
      setTimeout(function(){ if(window.matchMedia('(min-width: 561px)').matches) input.focus(); },250);
    } else {
      launch.focus({preventScroll:true});
    }
  }
  launch.addEventListener('click',function(){ setOpen(true); });
  hint.addEventListener('click',function(){ setOpen(true); });
  closeBtn.addEventListener('click',function(){ setOpen(false); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&document.documentElement.classList.contains('sc-open')) setOpen(false); });
  // It's a pop-up: tapping the page outside it closes it (ignoring the tap that just opened it)
  document.addEventListener('click',function(e){
    if(!document.documentElement.classList.contains('sc-open')||Date.now()-openedAt<400) return;
    if(panel.contains(e.target)||launch.contains(e.target)||hint.contains(e.target)) return;
    setOpen(false);
  });
  input.addEventListener('input',function(){ sendBtn.disabled=!input.value.trim(); });
  form.addEventListener('submit',function(e){ e.preventDefault(); var v=input.value; input.value=''; sendBtn.disabled=true; ask(v); });

  // A gentle nudge once per visit, after the visitor has had a look around
  var seen=false; try{ seen=!!sessionStorage.getItem('stac_chat_seen'); }catch(e){}
  if(seen) launch.classList.add('seen');
  else setTimeout(function(){ if(!document.documentElement.classList.contains('sc-open')){ hint.classList.add('on'); setTimeout(function(){ hint.classList.remove('on'); },7000); } },6000);

  // Small test hook for the readiness tool and QA
  window.STAC_CHAT={match:function(q){ var r=match(q); return r.length?r[0].d.id:null; },detectLang:detectLang,
    industry:function(q){ var i=detectIndustry(q); return i?i.key:null; },
    // What the chat actually does with a message: an answer id, or null (business-type line / hand-off)
    reply:function(q){ var r=route(q); return r.length?r[0].d.id:null; },
    industries:INDUSTRIES.map(function(i){ return {key:i.key,en:i.en,nl:i.nl}; })};
})();
