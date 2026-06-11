(()=>{var t="permreg-root",Y="permreg.webUrl",H="permreg.dev.bundle-source",Q="permreg.dev.local-base",W="http://127.0.0.1:18086/permreg",y="\u7D44\u7E54\u533A\u5206\u7B2C1\u968E\u5C64\u30DE\u30B9\u30BF",h="\u7D44\u7E54\u533A\u5206\u7B2C2\u968E\u5C64\u30DE\u30B9\u30BF",R="0.1.0-3e21c58d";var K="",A=null;function Z(r){K=String(r||"").replace(/\/+$/,""),A=null}function tt(){return K}async function mt(){if(A&&Date.now()<A.exp)return A.value;let r=await fetch(K+"/_api/contextinfo",{method:"POST",headers:{Accept:"application/json;odata=nometadata"},credentials:"same-origin"});if(!r.ok)throw new Error("contextinfo \u306E\u53D6\u5F97\u306B\u5931\u6557 (HTTP "+r.status+")\u3002\u30B5\u30A4\u30C8URL\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");let e=await r.json();return A={value:e.FormDigestValue,exp:Date.now()+Math.max(60,(e.FormDigestTimeoutSeconds||1800)-60)*1e3},A.value}async function N(r,e,n,l){let u=Object.assign({Accept:"application/json;odata=nometadata"},l);r!=="GET"&&(u["X-RequestDigest"]=await mt(),n!=null&&(u["Content-Type"]="application/json;odata=nometadata"));let m=await fetch(K+e,{method:r==="GET"?"GET":"POST",headers:u,credentials:"same-origin",body:n!=null?JSON.stringify(n):void 0});if(!m.ok){let p="HTTP "+m.status;try{let S=await m.json(),b=S["odata.error"]&&S["odata.error"].message&&S["odata.error"].message.value||S.error&&S.error.message&&(S.error.message.value||S.error.message);b&&(p+=" \u2014 "+b)}catch{}let k=new Error(p);throw k.status=m.status,k}let _=await m.text();return _?JSON.parse(_):null}var P=r=>N("GET",r),D=(r,e)=>N("POST",r,e),V=(r,e)=>N("POST",r,e,{"X-HTTP-Method":"MERGE","IF-MATCH":"*"}),rt=r=>N("POST",r,null,{"X-HTTP-Method":"DELETE","IF-MATCH":"*"}),x=r=>"/_api/web/lists/getbytitle('"+encodeURIComponent(r.replace(/'/g,"''"))+"')";async function X(r){try{return(await P(x(r)+"?$select=Id")).Id}catch(e){if(e.status===404)return null;throw e}}async function at(r,e){let n=await X(r);return n||(await D("/_api/web/lists",{Title:r,BaseTemplate:100,Description:e})).Id}async function ot(r,e){let n=await P(x(r)+"/fields?$select=Id&$filter=InternalName eq '"+e+"'");return!!(n.value&&n.value.length)}async function G(r,e,n,l){await ot(r,e)||(await D(x(r)+"/fields",Object.assign({Title:e},l)),await V(x(r)+"/fields/getbyinternalnameortitle('"+e+"')",{Title:n}))}async function vt(r,e,n,l){if(await ot(r,e))return;let u="<Field Type='Lookup' DisplayName='"+e+"' Name='"+e+"' StaticName='"+e+"' List='{"+l+"}' ShowField='Title' Required='TRUE'/>";await D(x(r)+"/fields/createfieldasxml",{parameters:{SchemaXml:u}}),await V(x(r)+"/fields/getbyinternalnameortitle('"+e+"')",{Title:n})}async function nt(r,e){for(let n of e)try{await D(x(r)+"/defaultview/viewfields/addviewfield('"+n+"')")}catch{}}async function it(r){r("\u300C"+y+"\u300D\u3092\u78BA\u8A8D\u4E2D\u2026");let e=await at(y,"\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u7528 \u7D44\u7E54\u533A\u5206(\u7B2C1\u968E\u5C64)\u30DE\u30B9\u30BF");await G(y,"SortOrder","\u4E26\u3073\u9806",{FieldTypeKind:9}),await G(y,"Active","\u6709\u52B9",{FieldTypeKind:8,DefaultValue:"1"}),await nt(y,["SortOrder","Active"]),r("\u300C"+h+"\u300D\u3092\u78BA\u8A8D\u4E2D\u2026"),await at(h,"\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u7528 \u7D44\u7E54\u533A\u5206(\u7B2C2\u968E\u5C64)\u30DE\u30B9\u30BF"),await vt(h,"Level1","\u7B2C1\u968E\u5C64",e),await G(h,"SortOrder","\u4E26\u3073\u9806",{FieldTypeKind:9}),await G(h,"Active","\u6709\u52B9",{FieldTypeKind:8,DefaultValue:"1"}),await nt(h,["Level1","SortOrder","Active"]),r("\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86")}var ut={"chevron-up":'<polyline points="18 15 12 9 6 15"/>',"chevron-down":'<polyline points="6 9 12 15 18 9"/>',"edit-2":'<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',"trash-2":'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',"refresh-cw":'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'},$=r=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ut[r]+"</svg>";var st=`
#${t}{
  /* SP host CSS \u30B7\u30FC\u30EB\u30C9\u3002\u5F8C\u7D9A\u5BA3\u8A00\u3068 custom property \u306F all \u306E\u5BFE\u8C61\u5916/\u4E0A\u66F8\u304D\u3067\u751F\u304D\u6B8B\u308B */
  all: initial;
  /* ---- design tokens (Spira \u5171\u901A) ---- */
  --ink:#2a2a26; --ink-3:#7a766c; --ink-4:#a8a39a;
  --paper:#fafaf7; --paper-2:#f3f1ea; --paper-2-strong:#ece8de; --paper-3:#e8e4d8;
  --line:rgba(42,42,38,.12); --line-strong:rgba(42,42,38,.18);
  --accent:#7a8a78; --accent-soft:rgba(122,138,120,.18); --accent-strong:#5e6f5c;
  --danger:#b8534a; --danger-soft:rgba(184,83,74,.10); --warn:#c47f1c; --ok:#2f6f5e;
  --font-sans:"Meiryo","\u30E1\u30A4\u30EA\u30AA","Hiragino Sans","Yu Gothic UI",-apple-system,"Segoe UI",system-ui,sans-serif;
  --font-mono:ui-monospace,"Cascadia Mono","Consolas",monospace;
  --fs-xs:11px; --fs-sm:12px; --fs-md:13px; --fs-base:15px; --fs-lg:16px; --fs-xl:18px;
  --lh-base:1.75; --lh-tight:1.35;
  --s-1:4px; --s-2:6px; --s-3:8px; --s-4:10px; --s-5:12px;
  --s-6:14px; --s-7:18px; --s-8:22px; --s-9:28px; --s-10:40px;
  --gutter:24px;
  --r-2:4px; --r-3:6px;
  --shadow-panel:0 8px 20px rgba(42,42,38,.10);
  --shadow-modal:0 0 0 1px rgba(42,42,38,.06),0 4px 12px rgba(42,42,38,.10),0 16px 40px rgba(42,42,38,.18);
  --topbar-h:44px;
}
#${t}{
  position:fixed; inset:0; width:100vw; height:100vh;
  z-index:2147483600; display:flex; flex-direction:column;
  font-family:var(--font-sans); font-size:var(--fs-md); line-height:var(--lh-base);
  color:var(--ink); background:var(--paper);
  /* all:initial \u306E user-select:auto \u306F SP host \u306E none \u3092\u7D99\u627F\u3057\u3066\u30B3\u30D4\u30FC\u4E0D\u53EF\u306B\u306A\u308B\u305F\u3081\u660E\u793A */
  -webkit-user-select:text; user-select:text;
}
#${t} *, #${t} *::before, #${t} *::after{ box-sizing:border-box; }
#${t} svg{ width:16px; height:16px; flex:none; }
@media (prefers-reduced-motion: reduce){
  #${t} *{ animation-duration:.01ms !important; transition-duration:.01ms !important; }
}

/* ---- topbar ---- */
#${t} .pr-topbar{
  display:flex; align-items:center; gap:var(--s-4); flex:none;
  height:var(--topbar-h); padding:0 var(--gutter);
  background:var(--paper-2); border-bottom:1px solid var(--line);
}
#${t} .pr-title{ font-size:var(--fs-base); font-weight:600; white-space:nowrap; }
#${t} .pr-title small{ font-size:var(--fs-xs); color:var(--ink-3); font-weight:400; margin-left:var(--s-2); }

/* ---- buttons (SP host \u30B7\u30FC\u30EB\u30C9: ID + class + !important) ---- */
#${t} .pr-btn, #${t} .pr-btn *{
  font-family:var(--font-sans) !important; font-size:var(--fs-md) !important;
}
#${t} .pr-btn{
  height:34px !important; padding:0 var(--s-7) !important;
  display:inline-flex !important; align-items:center !important; justify-content:center !important;
  gap:var(--s-2) !important; border-radius:var(--r-2) !important; font-weight:500 !important;
  cursor:pointer !important; border:1px solid var(--line-strong) !important;
  background:var(--paper) !important; color:var(--ink) !important;
  white-space:nowrap !important; text-decoration:none !important;
  transition:background .1s, color .1s, border-color .1s, filter .1s !important;
}
#${t} .pr-btn svg{ width:16px !important; height:16px !important; flex:none !important; }
#${t} .pr-btn:hover{ filter:brightness(.96) !important; }
#${t} .pr-btn:focus-visible{ outline:2px solid var(--accent-soft) !important; outline-offset:1px !important; }
#${t} .pr-btn:disabled{ opacity:.5 !important; cursor:not-allowed !important; filter:none !important; }
#${t} .pr-btn--primary, #${t} .pr-btn--primary *{
  background:var(--accent) !important; color:#ffffff !important; border-color:var(--accent) !important;
}
#${t} .pr-btn--primary:hover{
  background:var(--accent-strong) !important; border-color:var(--accent-strong) !important; filter:none !important;
}
#${t} .pr-btn--secondary, #${t} .pr-btn--secondary *{
  background:var(--paper-2) !important; color:var(--ink) !important; border-color:var(--paper-3) !important;
}
#${t} .pr-btn--ghost, #${t} .pr-btn--ghost *{
  background:transparent !important; color:var(--ink-3) !important;
}
#${t} .pr-btn--ghost{ border:1px solid var(--line-strong) !important; }
#${t} .pr-btn--ghost:hover, #${t} .pr-btn--ghost:hover *{
  border-color:var(--ink-4) !important; color:var(--ink) !important; filter:none !important;
}
#${t} .pr-btn--danger, #${t} .pr-btn--danger *{
  background:transparent !important; color:var(--danger) !important;
}
#${t} .pr-btn--danger{ border-color:var(--danger) !important; }
#${t} .pr-btn--danger:hover{ background:var(--danger-soft) !important; filter:none !important; }
#${t} .pr-btn--icon{ width:30px !important; height:30px !important; padding:0 !important; }
#${t} .pr-btn--icon-action{
  background:var(--paper) !important; color:var(--ink-3) !important; border:1px solid var(--line) !important;
}
#${t} .pr-btn--icon-action *{ background:transparent !important; color:var(--ink-3) !important; }
#${t} .pr-btn--icon-action:hover, #${t} .pr-btn--icon-action:hover *{
  background:var(--paper-2) !important; border-color:var(--line-strong) !important; color:var(--ink) !important; filter:none !important;
}
#${t} .pr-btn--icon-trash{
  background:var(--paper) !important; color:var(--danger) !important;
  border:1px solid rgba(184,83,74,.4) !important;
}
#${t} .pr-btn--icon-trash *{ background:transparent !important; color:var(--danger) !important; }
#${t} .pr-btn--icon-trash:hover{ background:var(--danger-soft) !important; border-color:var(--danger) !important; filter:none !important; }

/* ---- inputs ---- */
#${t} .pr-input{
  min-height:30px !important; padding:0 var(--s-4) !important;
  font-family:var(--font-sans) !important; font-size:var(--fs-md) !important;
  background:var(--paper-2) !important; color:var(--ink) !important;
  border:1px solid transparent !important; border-radius:var(--r-2) !important;
  outline:none !important; text-decoration:none !important;
}
#${t} .pr-input:focus{ background:var(--paper) !important; border-color:var(--line-strong) !important; }
#${t} .pr-input::placeholder{ color:var(--ink-4) !important; }

/* ---- side nav (master-detail / \xA720) ---- */
#${t} .pr-body{ flex:1; display:flex; min-height:0; }
#${t} .pr-side{
  flex:none; width:220px; display:flex; flex-direction:column; gap:var(--s-1);
  background:var(--paper-2); border-right:1px solid var(--line); padding:var(--s-5) 0;
}
#${t} .pr-side-head{
  font-size:var(--fs-xs); color:var(--ink-3); letter-spacing:.06em;
  padding:var(--s-2) var(--s-7) var(--s-1);
}
#${t} .pr-nav-item, #${t} .pr-nav-item *{
  font-family:var(--font-sans) !important; text-align:left !important;
  background:transparent; color:var(--ink) !important; text-decoration:none !important;
}
#${t} .pr-nav-item{
  display:block !important; width:100%; border:none !important;
  border-left:3px solid transparent !important; cursor:pointer !important;
  padding:var(--s-3) var(--s-7) !important; font-size:var(--fs-md) !important;
  background:transparent !important; line-height:var(--lh-tight) !important;
}
#${t} .pr-nav-item small{
  display:block !important; font-size:var(--fs-xs) !important; color:var(--ink-3) !important;
  margin-top:var(--s-1) !important; font-weight:400 !important;
}
#${t} .pr-nav-item:hover{ background:var(--paper-2-strong) !important; }
#${t} .pr-nav-item.active{
  border-left-color:var(--accent) !important; background:var(--accent-soft) !important; font-weight:600 !important;
}
#${t} .pr-main{ flex:1; display:flex; flex-direction:column; min-width:0; }

/* ---- columns / list ---- */
#${t} .pr-app{ flex:1; display:flex; flex-direction:column; min-height:0; }
#${t} .pr-cols{ flex:1; display:flex; min-height:0; }
#${t} .pr-col{ flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid var(--line); }
#${t} .pr-col:last-child{ border-right:none; }
#${t} .pr-sub{
  display:flex; align-items:baseline; gap:var(--s-3); flex:none;
  padding:var(--s-5) var(--gutter) var(--s-2);
}
#${t} .pr-sub b{ font-size:var(--fs-md); font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#${t} .pr-sub .pr-count{ font-size:var(--fs-sm); color:var(--ink-3); font-family:var(--font-mono); white-space:nowrap; }
#${t} .pr-toolbar{
  display:flex; gap:var(--s-3); flex:none;
  padding:var(--s-2) var(--gutter) var(--s-5); border-bottom:1px solid var(--line);
}
#${t} .pr-toolbar .pr-input{ flex:1; min-width:0; }
#${t} .pr-rows{ flex:1; overflow:auto; }
#${t} .pr-row{
  display:flex; align-items:center; gap:var(--s-2);
  padding:var(--s-3) var(--gutter); border-bottom:1px solid var(--line); min-height:48px;
}
#${t} .pr-row:hover{ background:var(--paper-2); }
#${t} .pr-row.sel{ background:var(--accent-soft); }
#${t} .pr-row .pr-name{
  flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  padding:0 var(--s-2); color:var(--ink);
}
#${t} .pr-row[data-kind="l1"] .pr-name{ cursor:pointer; }
#${t} .pr-row.off .pr-name{ color:var(--ink-4); text-decoration:line-through; }
#${t} .pr-row .pr-childcount{
  font-family:var(--font-mono); font-size:var(--fs-xs); color:var(--ink-3);
  background:var(--paper-2-strong); border-radius:999px; padding:0 var(--s-3); margin-left:var(--s-2);
}
#${t} .pr-active{ display:inline-flex; align-items:center; padding:0 var(--s-1); cursor:pointer; }
#${t} .pr-active input{ width:14px; height:14px; accent-color:var(--accent); cursor:pointer; margin:0; }
#${t} .pr-empty{ padding:var(--s-9) var(--gutter); color:var(--ink-4); font-size:var(--fs-md); text-align:center; }

/* ---- empty / setup state ---- */
#${t} .pr-hero{
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:var(--s-5); padding:var(--s-10) var(--gutter); text-align:center;
}
#${t} .pr-hero h4{ margin:0; font-size:var(--fs-lg); font-weight:600; line-height:var(--lh-tight); }
#${t} .pr-hero p{ margin:0; color:var(--ink-3); font-size:var(--fs-md); }

/* ---- settings ---- */
#${t} .pr-settings{ padding:var(--s-8) var(--gutter); display:flex; flex-direction:column; gap:var(--s-7); max-width:640px; }
#${t} .pr-settings h4{ margin:0; font-size:var(--fs-lg); font-weight:600; line-height:var(--lh-tight); }
#${t} .pr-field{ display:flex; flex-direction:column; gap:var(--s-2); }
#${t} .pr-field label{ font-size:var(--fs-sm); color:var(--ink-3); }
#${t} .pr-field .pr-note{ font-size:var(--fs-xs); color:var(--ink-4); }
#${t} .pr-radio{ display:flex; align-items:center; gap:var(--s-2); font-size:var(--fs-md); cursor:pointer; }
#${t} .pr-radio input{ accent-color:var(--accent); margin:0; }
#${t} .pr-kv{ font-size:var(--fs-sm); color:var(--ink-3); }
#${t} .pr-kv code{ font-family:var(--font-mono); color:var(--ink); background:var(--paper-2); padding:0 var(--s-2); border-radius:var(--r-2); }

/* ---- status bar ---- */
#${t} .pr-status{
  flex:none; min-height:30px; padding:var(--s-1) var(--gutter);
  border-top:1px solid var(--line); background:var(--paper-2);
  color:var(--ink-3); font-size:var(--fs-sm);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; user-select:text;
}

/* ---- toasts (\u53F3\u4E0A / ok 2s / warn 3s / error \u624B\u52D5) ---- */
#${t} .pr-toasts{
  position:fixed; top:var(--s-5); right:var(--s-5); z-index:2147483800;
  display:flex; flex-direction:column; gap:var(--s-3); width:360px; max-width:90vw;
}
#${t} .pr-toast{
  display:flex; align-items:flex-start; gap:var(--s-3);
  background:var(--paper); border:1px solid var(--line-strong); border-left:3px solid var(--ok);
  border-radius:var(--r-3); box-shadow:var(--shadow-panel);
  padding:var(--s-3) var(--s-4); animation:pr-slide .2s ease;
}
#${t} .pr-toast--warn{ border-left-color:var(--warn); }
#${t} .pr-toast--err{ border-left-color:var(--danger); }
#${t} .pr-toast .pr-msg{
  flex:1; min-width:0; font-size:var(--fs-sm); line-height:1.5; padding-top:var(--s-1);
  user-select:text; word-break:break-all; color:var(--ink);
}
@keyframes pr-slide{ from{ transform:translateY(-8px); opacity:0; } }

/* ---- modal ---- */
#${t} .pr-backdrop{
  position:fixed; inset:0; z-index:2147483700;
  background:rgba(15,15,15,.45); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center;
}
#${t} .pr-modal{
  background:var(--paper); border-radius:var(--r-3); box-shadow:var(--shadow-modal);
  width:min(440px, 92vw); padding:var(--s-8) var(--s-9);
  display:flex; flex-direction:column; gap:var(--s-5);
}
#${t} .pr-modal h4{ margin:0; font-size:var(--fs-lg); font-weight:600; line-height:var(--lh-tight); }
#${t} .pr-modal .pr-modal-msg{ font-size:var(--fs-md); color:var(--ink-3); user-select:text; }
#${t} .pr-modal .pr-input{ min-height:34px !important; }
#${t} .pr-modal-actions{ display:flex; justify-content:flex-end; gap:var(--s-3); margin-top:var(--s-2); }
`;var J=null;function lt(r){J=r}var w=r=>String(r??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function et(r){let e=document.createElement("template");return e.innerHTML=r.trim(),e.content.firstElementChild}function I(r,e){let n=J.querySelector(".pr-toasts");n||(n=et('<div class="pr-toasts" role="status" aria-live="polite"></div>'),J.appendChild(n));let l=et(`
    <div class="pr-toast pr-toast--${r}">
      <div class="pr-msg"></div>
      ${r==="err"?`<button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="copy" aria-label="\u30A8\u30E9\u30FC\u5185\u5BB9\u3092\u30B3\u30D4\u30FC">${$("copy")}</button>`:""}
      <button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="close" aria-label="\u9589\u3058\u308B">${$("x")}</button>
    </div>`);l.querySelector(".pr-msg").textContent=e,l.addEventListener("click",u=>{let m=u.target.closest("[data-tact]");m&&(m.dataset.tact==="copy"?navigator.clipboard.writeText(e).catch(()=>{}):l.remove())}),n.appendChild(l),r==="ok"&&setTimeout(()=>l.remove(),2e3),r==="warn"&&setTimeout(()=>l.remove(),3e3)}function M({title:r,message:e,inputValue:n,okLabel:l,danger:u}){return new Promise(m=>{let _=n!==void 0,p=et(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${w(r)}">
          <h4></h4>
          ${e!=null?'<div class="pr-modal-msg"></div>':""}
          ${_?'<input class="pr-input" type="text">':""}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
            <button class="pr-btn ${u?"pr-btn--danger":"pr-btn--primary"}" data-mact="ok"></button>
          </div>
        </div>
      </div>`);p.querySelector("h4").textContent=r,e!=null&&(p.querySelector(".pr-modal-msg").textContent=e);let k=p.querySelector("input");k&&(k.value=n),p.querySelector('[data-mact="ok"]').textContent=l||"OK";let S=d=>{document.removeEventListener("keydown",O,!0),p.remove(),m(d)},b=()=>S(_?null:!1),j=()=>S(_?k.value.trim():!0),v=!1;p.addEventListener("mousedown",d=>{v=d.target===p}),p.addEventListener("click",d=>{if(d.target===p){v&&b();return}let q=d.target.closest("[data-mact]");q&&(q.dataset.mact==="ok"?j():b())});let O=d=>{d.key==="Escape"?(d.stopPropagation(),b()):d.key==="Enter"&&(d.metaKey||d.ctrlKey||_&&d.target===k)&&j()};document.addEventListener("keydown",O,!0),J.appendChild(p),(k||p.querySelector('[data-mact="ok"]')).focus(),k&&k.select()})}var ft=3e4;function gt(r,e){if(window.__permregSource=Object.assign({},r,{ver:e}),r.dev)fetch(r.base+"/permreg.bundle.js?v="+encodeURIComponent(e)).then(n=>{if(!n.ok)throw new Error("HTTP "+n.status);return n.text()}).then(n=>{(0,eval)(n)}).catch(n=>I("err","\u81EA\u52D5\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F \u2014 "+(n&&n.message||n)));else{let n=document.getElementById("permreg-script");n&&n.remove();let l=document.createElement("script");l.id="permreg-script",l.src=r.base+"/permreg.bundle.js?v="+encodeURIComponent(e),l.onerror=()=>I("err","\u81EA\u52D5\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F (script load error)"),document.body.appendChild(l)}}function pt(r){window.__permregWatcher&&clearInterval(window.__permregWatcher),window.__permregOnVisible&&document.removeEventListener("visibilitychange",window.__permregOnVisible);let e=window.__permregSource;if(!e||!e.base)return;let n=!1,l="";async function u(){if(n)return;let m="";try{let p=await fetch(e.base+"/version.txt?t="+Date.now(),{credentials:"same-origin"});if(!p.ok)return;m=(await p.text()).trim()}catch{return}if(!m||m===r||m===l)return;if(n=!0,await M({title:"\u66F4\u65B0\u304C\u3042\u308A\u307E\u3059",message:"\u65B0\u3057\u3044\u30D0\u30FC\u30B8\u30E7\u30F3 "+m+" \u304C\u914D\u4FE1\u3055\u308C\u3066\u3044\u307E\u3059(\u5B9F\u884C\u4E2D: "+r+")\u3002\u4ECA\u3059\u3050\u66F4\u65B0\u3057\u307E\u3059\u304B? \u7DE8\u96C6\u9014\u4E2D\u306E\u5165\u529B\u306F\u5931\u308F\u308C\u307E\u3059\u3002",okLabel:"\u4ECA\u3059\u3050\u66F4\u65B0"})){gt(e,m);return}l=m,n=!1}window.__permregWatcher=setInterval(()=>{document.hidden||u()},ft),window.__permregOnVisible=()=>{document.hidden||u()},document.addEventListener("visibilitychange",window.__permregOnVisible),window.__permregCheckNow=u}(()=>{"use strict";let r=document.getElementById(t);r&&r.remove();let e={view:"master",l1:[],l2:[],selectedL1:null,ready:!1,busy:!1};function n(){try{if(window._spPageContextInfo&&window._spPageContextInfo.webAbsoluteUrl)return window._spPageContextInfo.webAbsoluteUrl}catch{}let i=location.href.match(/^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/);return i?i[1]:location.origin}Z(localStorage.getItem(Y)||n());async function l(){e.ready=!!await X(y)&&!!await X(h)}async function u(){let[i,a]=await Promise.all([P(x(y)+"/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999"),P(x(h)+"/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999")]);e.l1=i.value||[],e.l2=a.value||[],e.selectedL1&&!e.l1.some(o=>o.Id===e.selectedL1)&&(e.selectedL1=null),!e.selectedL1&&e.l1.length&&(e.selectedL1=e.l1[0].Id)}let m=i=>i.reduce((a,o)=>Math.max(a,o.SortOrder||0),0)+10,_=(i,a)=>D(x(i)+"/items",a),p=(i,a,o)=>V(x(i)+"/items("+a+")",o),k=(i,a)=>rt(x(i)+"/items("+a+")");async function S(i,a,o,s){let f=a.indexOf(o),L=f+s;if(L<0||L>=a.length)return;let z=a.map(c=>c.SortOrder);if(z.some((c,C)=>c==null||z.indexOf(c)!==C))for(let c=0;c<a.length;c++)a[c].SortOrder=(c+1)*10,await p(i,a[c].Id,{SortOrder:a[c].SortOrder});let T=a[f],g=a[L];await p(i,T.Id,{SortOrder:g.SortOrder}),await p(i,g.Id,{SortOrder:T.SortOrder})}let b=document.createElement("div");b.id=t;let j=document.createElement("style");j.textContent=st,b.appendChild(j);let v=document.createElement("div");v.className="pr-app",b.appendChild(v),document.body.appendChild(b),lt(b);function O(i){let a=b.querySelector(".pr-status");a&&(a.textContent=i)}async function d(i,a){if(!e.busy){e.busy=!0,v.style.opacity="0.55",v.style.pointerEvents="none",O(i+"\u2026");try{await a(),O(i+" \u5B8C\u4E86")}catch(o){O("\u30A8\u30E9\u30FC: "+o.message),I("err",i+"\u306B\u5931\u6557\u3057\u307E\u3057\u305F \u2014 "+o.message)}finally{e.busy=!1,v.style.opacity="",v.style.pointerEvents=""}}}function q(){let i=s=>e.l2.filter(f=>f.Level1&&f.Level1.Id===s),a=e.l1.find(s=>s.Id===e.selectedL1),o=(s,f,L)=>`
      <div class="pr-row${s.Active===!1?" off":""}${L||""}" data-kind="${f}" data-id="${s.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="\u4E0A\u3078" title="\u4E0A\u3078">${$("chevron-up")}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="\u4E0B\u3078" title="\u4E0B\u3078">${$("chevron-down")}</button>
        <span class="pr-name" ${f==="l1"?'data-act="select"':""} title="${w(s.Title)}">${w(s.Title)}${f==="l1"?`<span class="pr-childcount">${i(s.Id).length}</span>`:""}</span>
        <label class="pr-active" title="\u6709\u52B9/\u7121\u52B9">
          <input type="checkbox" data-act="active" aria-label="\u6709\u52B9" ${s.Active!==!1?"checked":""}>
        </label>
        <button class="pr-btn pr-btn--icon pr-btn--icon-action" data-act="rename" aria-label="\u540D\u79F0\u5909\u66F4" title="\u540D\u79F0\u5909\u66F4">${$("edit-2")}</button>
        <button class="pr-btn pr-btn--icon pr-btn--icon-trash" data-act="del" aria-label="\u524A\u9664" title="\u524A\u9664">${$("trash-2")}</button>
      </div>`;return e.ready?`
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>\u7B2C1\u968E\u5C64</b><span class="pr-count">${e.l1.length}\u4EF6</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="\u7B2C1\u968E\u5C64\u306E\u540D\u79F0\u3092\u5165\u529B">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${$("plus")}\u8FFD\u52A0</button>
          </div>
          <div class="pr-rows">${e.l1.map(s=>o(s,"l1",s.Id===e.selectedL1?" sel":"")).join("")||'<div class="pr-empty">\u672A\u767B\u9332</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>\u7B2C2\u968E\u5C64${a?" \u2014 "+w(a.Title):""}</b>
            <span class="pr-count">${a?i(a.Id).length+"\u4EF6":""}</span></div>
          ${a?`
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="\u300C${w(a.Title)}\u300D\u914D\u4E0B\u306E\u540D\u79F0\u3092\u5165\u529B">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${$("plus")}\u8FFD\u52A0</button>
          </div>
          <div class="pr-rows">${i(a.Id).map(s=>o(s,"l2")).join("")||'<div class="pr-empty">\u672A\u767B\u9332</div>'}</div>`:'<div class="pr-empty">\u5DE6\u3067\u7B2C1\u968E\u5C64\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044</div>'}
        </div>
      </div>`:`
        <div class="pr-hero">
          <h4>\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093</h4>
          <p>\u3053\u306E\u30B5\u30A4\u30C8\u306B\u300C${w(y)}\u300D\u3068\u300C${w(h)}\u300D\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002</p>
          <button class="pr-btn pr-btn--primary" data-act="setup">${$("plus")}\u521D\u671F\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7</button>
        </div>`}function dt(){return`
      <div class="pr-hero">
        <h4>\u5229\u7528\u8005\u4E00\u89A7(\u6E96\u5099\u4E2D)</h4>
        <p>\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u306E\u78BA\u8A8D\u30D3\u30E5\u30FC\u306F\u30D5\u30A7\u30FC\u30BA2\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059\u3002<br>\u307E\u305A\u306F\u300C\u30DE\u30B9\u30BF\u7BA1\u7406\u300D\u3067\u7D44\u7E54\u533A\u5206\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p>
      </div>`}function ct(){let i=window.__permregSource&&window.__permregSource.base||"\u76F4\u63A5\u5B9F\u884C(\u57CB\u3081\u8FBC\u307F/\u958B\u767A\u30B3\u30F3\u30BD\u30FC\u30EB)",a=localStorage.getItem(H)==="local",o=localStorage.getItem(Q)||W;return`
      <div class="pr-settings">
        <h4>\u8A2D\u5B9A</h4>
        <div class="pr-kv">\u30D0\u30FC\u30B8\u30E7\u30F3: <code>${w(R)}</code> / \u4ECA\u56DE\u306E\u8AAD\u8FBC\u5143: <code>${w(i)}</code></div>
        <div class="pr-field">
          <label>bundle \u306E\u914D\u4FE1\u5143(\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u6642\u306B\u3069\u3053\u304B\u3089\u672C\u4F53\u3092\u8AAD\u3080\u304B)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${a?"":"checked"}>
            SharePoint (\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8/permreg/ \u306B\u914D\u7F6E\u3057\u305F dist)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="local" ${a?"checked":""}>
            \u30ED\u30FC\u30AB\u30EB\u958B\u767A\u30B5\u30FC\u30D0(\u958B\u767A\u8005\u30E2\u30FC\u30C9)</label>
        </div>
        <div class="pr-field">
          <label>\u30ED\u30FC\u30AB\u30EB\u914D\u4FE1 URL(\u958B\u767A\u8005\u30E2\u30FC\u30C9\u6642)</label>
          <input type="text" class="pr-input" id="pr-dev-base" value="${w(o)}" placeholder="${w(W)}">
          <span class="pr-note">\u30EA\u30DD\u30B8\u30C8\u30EA\u3067 <code>npm run dev</code> \u3092\u8D77\u52D5\u3057\u3001\u30D3\u30EB\u30C9\u3057\u305F dist/ \u3092\u914D\u4FE1\u3057\u307E\u3059\u3002</span>
        </div>
        <div>
          <button class="pr-btn pr-btn--primary" data-act="save-settings">\u4FDD\u5B58</button>
        </div>
        <div class="pr-field">
          <span class="pr-note">\u8A2D\u5B9A\u306F\u6B21\u56DE\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u304B\u3089\u53CD\u6620\u3055\u308C\u307E\u3059(\u3053\u306E\u30D1\u30CD\u30EB\u306F\u518D\u8AAD\u8FBC\u3055\u308C\u307E\u305B\u3093)\u3002</span>
        </div>
      </div>`}function B(){let i={users:dt,master:q,settings:ct},a=(o,s,f)=>`
      <button class="pr-nav-item${e.view===o?" active":""}" data-act="nav" data-view="${o}">
        ${s}<small>${f}</small></button>`;v.innerHTML=`
      <div class="pr-topbar">
        <span class="pr-title">permreg<small>\u5229\u7528\u8005\u6A29\u9650\u767B\u9332 \u7BA1\u7406</small></span>
        <input type="text" class="pr-input" id="pr-weburl" style="flex:1" value="${w(tt())}"
          aria-label="SharePoint \u30B5\u30A4\u30C8URL" title="SharePoint \u30B5\u30A4\u30C8URL">
        <button class="pr-btn pr-btn--ghost" data-act="reload">${$("refresh-cw")}\u518D\u8AAD\u8FBC</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="close" aria-label="\u9589\u3058\u308B" title="\u9589\u3058\u308B">${$("x")}</button>
      </div>
      <div class="pr-body">
        <nav class="pr-side" aria-label="\u30E1\u30CB\u30E5\u30FC">
          <div class="pr-side-head">\u30E1\u30CB\u30E5\u30FC</div>
          ${a("users","\u5229\u7528\u8005\u4E00\u89A7","\u767B\u9332\u72B6\u6CC1\u306E\u78BA\u8A8D\u30D3\u30E5\u30FC")}
          ${a("master","\u30DE\u30B9\u30BF\u7BA1\u7406","\u7D44\u7E54\u533A\u5206(\u7B2C1/\u7B2C2\u968E\u5C64)")}
          ${a("settings","\u8A2D\u5B9A","\u914D\u4FE1\u5143 / \u958B\u767A\u8005\u30E2\u30FC\u30C9")}
        </nav>
        <div class="pr-main">${i[e.view]()}</div>
      </div>
      <div class="pr-status">${e.ready?"\u6E96\u5099OK":"\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u672A\u4F5C\u6210"} / ${w(R)}</div>`}async function E(){await l(),e.ready&&await u(),B()}v.addEventListener("change",i=>{let a=i.target;if(a.id==="pr-weburl"){Z(a.value.trim()),localStorage.setItem(Y,tt());return}if(a.dataset.act==="active"){let o=a.closest(".pr-row"),s=o.dataset.kind==="l1"?y:h;d("\u66F4\u65B0",async()=>{await p(s,+o.dataset.id,{Active:a.checked}),await E()})}}),v.addEventListener("keydown",i=>{i.key==="Enter"&&(i.target.id==="pr-add-l1"&&v.querySelector('[data-act="add-l1"]').click(),i.target.id==="pr-add-l2"&&v.querySelector('[data-act="add-l2"]').click())}),v.addEventListener("click",async i=>{let a=i.target.closest("[data-act]");if(!a)return;let o=a.dataset.act,s=a.closest(".pr-row"),f=s&&s.dataset.kind,L=s&&+s.dataset.id,z=f==="l1"?y:h,F=f==="l1"?e.l1:e.l2.filter(g=>g.Level1&&g.Level1.Id===e.selectedL1),T=F&&F.find(g=>g.Id===L);if(o==="close"){b.remove();return}if(o==="nav"){e.view=a.dataset.view,B();return}if(o==="reload"){d("\u518D\u8AAD\u8FBC",E);return}if(o==="setup"){d("\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7",async()=>{await it(O),await E(),I("ok","\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F")});return}if(o==="select"){e.selectedL1=L,B();return}if(o==="save-settings"){let g=v.querySelector('input[name="pr-src"][value="local"]').checked,c=v.querySelector("#pr-dev-base").value.trim().replace(/\/+$/,"");g?(localStorage.setItem(H,"local"),localStorage.setItem(Q,c||W)):localStorage.removeItem(H),I("ok","\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u6B21\u56DE\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u304B\u3089\u53CD\u6620\u3055\u308C\u307E\u3059");return}if(o==="add-l1"||o==="add-l2"){let c=v.querySelector(o==="add-l1"?"#pr-add-l1":"#pr-add-l2").value.trim();if(!c)return;let C=o==="add-l1"?e.l1:e.l2.filter(U=>U.Level1&&U.Level1.Id===e.selectedL1);if(C.some(U=>U.Title===c)){I("warn","\u300C"+c+"\u300D\u306F\u65E2\u306B\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059");return}d("\u8FFD\u52A0",async()=>{let U={Title:c,SortOrder:m(C),Active:!0};o==="add-l2"&&(U.Level1Id=e.selectedL1),await _(o==="add-l1"?y:h,U),await E(),I("ok","\u300C"+c+"\u300D\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F")});return}if(T)if(o==="rename"){let g=await M({title:"\u540D\u79F0\u5909\u66F4",inputValue:T.Title,okLabel:"\u4FDD\u5B58"});if(!g||g===T.Title)return;d("\u540D\u79F0\u5909\u66F4",async()=>{await p(z,L,{Title:g}),await E()})}else if(o==="del"){if(f==="l1"){let c=e.l2.filter(C=>C.Level1&&C.Level1.Id===L);if(c.length){I("warn","\u300C"+T.Title+"\u300D\u306B\u306F\u7B2C2\u968E\u5C64\u304C "+c.length+" \u4EF6\u3042\u308A\u307E\u3059\u3002\u5148\u306B\u7B2C2\u968E\u5C64\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044");return}}if(!await M({title:"\u524A\u9664\u306E\u78BA\u8A8D",message:"\u300C"+T.Title+"\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002",okLabel:"\u524A\u9664\u3059\u308B",danger:!0}))return;d("\u524A\u9664",async()=>{await k(z,L),await E(),I("ok","\u300C"+T.Title+"\u300D\u3092\u524A\u9664\u3057\u307E\u3057\u305F")})}else(o==="up"||o==="down")&&d("\u4E26\u3079\u66FF\u3048",async()=>{await S(z,F,T,o==="up"?-1:1),await E()})}),B(),d("\u8AAD\u8FBC",E),window.__permreg={state:e,build:R},pt(R)})();})();
