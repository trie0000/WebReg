(()=>{var t="permreg-root",J="permreg.webUrl",F="permreg.dev.bundle-source",Y="permreg.dev.local-base",V="http://127.0.0.1:18086/permreg",x="\u7D44\u7E54\u533A\u5206\u7B2C1\u968E\u5C64\u30DE\u30B9\u30BF",g="\u7D44\u7E54\u533A\u5206\u7B2C2\u968E\u5C64\u30DE\u30B9\u30BF",H="0.1.0-01b4a01f";var G="",A=null;function Q(r){G=String(r||"").replace(/\/+$/,""),A=null}function Z(){return G}async function ct(){if(A&&Date.now()<A.exp)return A.value;let r=await fetch(G+"/_api/contextinfo",{method:"POST",headers:{Accept:"application/json;odata=nometadata"},credentials:"same-origin"});if(!r.ok)throw new Error("contextinfo \u306E\u53D6\u5F97\u306B\u5931\u6557 (HTTP "+r.status+")\u3002\u30B5\u30A4\u30C8URL\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");let e=await r.json();return A={value:e.FormDigestValue,exp:Date.now()+Math.max(60,(e.FormDigestTimeoutSeconds||1800)-60)*1e3},A.value}async function K(r,e,s,m){let S=Object.assign({Accept:"application/json;odata=nometadata"},m);r!=="GET"&&(S["X-RequestDigest"]=await ct(),s!=null&&(S["Content-Type"]="application/json;odata=nometadata"));let y=await fetch(G+e,{method:r==="GET"?"GET":"POST",headers:S,credentials:"same-origin",body:s!=null?JSON.stringify(s):void 0});if(!y.ok){let d="HTTP "+y.status;try{let k=await y.json(),f=k["odata.error"]&&k["odata.error"].message&&k["odata.error"].message.value||k.error&&k.error.message&&(k.error.message.value||k.error.message);f&&(d+=" \u2014 "+f)}catch{}let $=new Error(d);throw $.status=y.status,$}let T=await y.text();return T?JSON.parse(T):null}var P=r=>K("GET",r),z=(r,e)=>K("POST",r,e),R=(r,e)=>K("POST",r,e,{"X-HTTP-Method":"MERGE","IF-MATCH":"*"}),rt=r=>K("POST",r,null,{"X-HTTP-Method":"DELETE","IF-MATCH":"*"}),b=r=>"/_api/web/lists/getbytitle('"+encodeURIComponent(r.replace(/'/g,"''"))+"')";async function W(r){try{return(await P(b(r)+"?$select=Id")).Id}catch(e){if(e.status===404)return null;throw e}}async function at(r,e){let s=await W(r);return s||(await z("/_api/web/lists",{Title:r,BaseTemplate:100,Description:e})).Id}async function ot(r,e){let s=await P(b(r)+"/fields?$select=Id&$filter=InternalName eq '"+e+"'");return!!(s.value&&s.value.length)}async function N(r,e,s,m){await ot(r,e)||(await z(b(r)+"/fields",Object.assign({Title:e},m)),await R(b(r)+"/fields/getbyinternalnameortitle('"+e+"')",{Title:s}))}async function mt(r,e,s,m){if(await ot(r,e))return;let S="<Field Type='Lookup' DisplayName='"+e+"' Name='"+e+"' StaticName='"+e+"' List='{"+m+"}' ShowField='Title' Required='TRUE'/>";await z(b(r)+"/fields/createfieldasxml",{parameters:{SchemaXml:S}}),await R(b(r)+"/fields/getbyinternalnameortitle('"+e+"')",{Title:s})}async function nt(r,e){for(let s of e)try{await z(b(r)+"/defaultview/viewfields/addviewfield('"+s+"')")}catch{}}async function it(r){r("\u300C"+x+"\u300D\u3092\u78BA\u8A8D\u4E2D\u2026");let e=await at(x,"\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u7528 \u7D44\u7E54\u533A\u5206(\u7B2C1\u968E\u5C64)\u30DE\u30B9\u30BF");await N(x,"SortOrder","\u4E26\u3073\u9806",{FieldTypeKind:9}),await N(x,"Active","\u6709\u52B9",{FieldTypeKind:8,DefaultValue:"1"}),await nt(x,["SortOrder","Active"]),r("\u300C"+g+"\u300D\u3092\u78BA\u8A8D\u4E2D\u2026"),await at(g,"\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u7528 \u7D44\u7E54\u533A\u5206(\u7B2C2\u968E\u5C64)\u30DE\u30B9\u30BF"),await mt(g,"Level1","\u7B2C1\u968E\u5C64",e),await N(g,"SortOrder","\u4E26\u3073\u9806",{FieldTypeKind:9}),await N(g,"Active","\u6709\u52B9",{FieldTypeKind:8,DefaultValue:"1"}),await nt(g,["Level1","SortOrder","Active"]),r("\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86")}var vt={"chevron-up":'<polyline points="18 15 12 9 6 15"/>',"chevron-down":'<polyline points="6 9 12 15 18 9"/>',"edit-2":'<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',"trash-2":'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',"refresh-cw":'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'},w=r=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+vt[r]+"</svg>";var st=`
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
`;var X=null;function lt(r){X=r}var h=r=>String(r??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function tt(r){let e=document.createElement("template");return e.innerHTML=r.trim(),e.content.firstElementChild}function E(r,e){let s=X.querySelector(".pr-toasts");s||(s=tt('<div class="pr-toasts" role="status" aria-live="polite"></div>'),X.appendChild(s));let m=tt(`
    <div class="pr-toast pr-toast--${r}">
      <div class="pr-msg"></div>
      ${r==="err"?`<button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="copy" aria-label="\u30A8\u30E9\u30FC\u5185\u5BB9\u3092\u30B3\u30D4\u30FC">${w("copy")}</button>`:""}
      <button class="pr-btn pr-btn--icon pr-btn--ghost" data-tact="close" aria-label="\u9589\u3058\u308B">${w("x")}</button>
    </div>`);m.querySelector(".pr-msg").textContent=e,m.addEventListener("click",S=>{let y=S.target.closest("[data-tact]");y&&(y.dataset.tact==="copy"?navigator.clipboard.writeText(e).catch(()=>{}):m.remove())}),s.appendChild(m),r==="ok"&&setTimeout(()=>m.remove(),2e3),r==="warn"&&setTimeout(()=>m.remove(),3e3)}function et({title:r,message:e,inputValue:s,okLabel:m,danger:S}){return new Promise(y=>{let T=s!==void 0,d=tt(`
      <div class="pr-backdrop">
        <div class="pr-modal" role="dialog" aria-modal="true" aria-label="${h(r)}">
          <h4></h4>
          ${e!=null?'<div class="pr-modal-msg"></div>':""}
          ${T?'<input class="pr-input" type="text">':""}
          <div class="pr-modal-actions">
            <button class="pr-btn pr-btn--secondary" data-mact="cancel">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
            <button class="pr-btn ${S?"pr-btn--danger":"pr-btn--primary"}" data-mact="ok"></button>
          </div>
        </div>
      </div>`);d.querySelector("h4").textContent=r,e!=null&&(d.querySelector(".pr-modal-msg").textContent=e);let $=d.querySelector("input");$&&($.value=s),d.querySelector('[data-mact="ok"]').textContent=m||"OK";let k=l=>{document.removeEventListener("keydown",O,!0),d.remove(),y(l)},f=()=>k(T?null:!1),j=()=>k(T?$.value.trim():!0),c=!1;d.addEventListener("mousedown",l=>{c=l.target===d}),d.addEventListener("click",l=>{if(l.target===d){c&&f();return}let M=l.target.closest("[data-mact]");M&&(M.dataset.mact==="ok"?j():f())});let O=l=>{l.key==="Escape"?(l.stopPropagation(),f()):l.key==="Enter"&&(l.metaKey||l.ctrlKey||T&&l.target===$)&&j()};document.addEventListener("keydown",O,!0),X.appendChild(d),($||d.querySelector('[data-mact="ok"]')).focus(),$&&$.select()})}(()=>{"use strict";let r=document.getElementById(t);r&&r.remove();let e={view:"master",l1:[],l2:[],selectedL1:null,ready:!1,busy:!1};function s(){try{if(window._spPageContextInfo&&window._spPageContextInfo.webAbsoluteUrl)return window._spPageContextInfo.webAbsoluteUrl}catch{}let o=location.href.match(/^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/);return o?o[1]:location.origin}Q(localStorage.getItem(J)||s());async function m(){e.ready=!!await W(x)&&!!await W(g)}async function S(){let[o,a]=await Promise.all([P(b(x)+"/items?$select=Id,Title,SortOrder,Active&$orderby=SortOrder,Id&$top=4999"),P(b(g)+"/items?$select=Id,Title,SortOrder,Active,Level1/Id&$expand=Level1&$orderby=SortOrder,Id&$top=4999")]);e.l1=o.value||[],e.l2=a.value||[],e.selectedL1&&!e.l1.some(n=>n.Id===e.selectedL1)&&(e.selectedL1=null),!e.selectedL1&&e.l1.length&&(e.selectedL1=e.l1[0].Id)}let y=o=>o.reduce((a,n)=>Math.max(a,n.SortOrder||0),0)+10,T=(o,a)=>z(b(o)+"/items",a),d=(o,a,n)=>R(b(o)+"/items("+a+")",n),$=(o,a)=>rt(b(o)+"/items("+a+")");async function k(o,a,n,i){let v=a.indexOf(n),L=v+i;if(L<0||L>=a.length)return;let U=a.map(p=>p.SortOrder);if(U.some((p,C)=>p==null||U.indexOf(p)!==C))for(let p=0;p<a.length;p++)a[p].SortOrder=(p+1)*10,await d(o,a[p].Id,{SortOrder:a[p].SortOrder});let I=a[v],u=a[L];await d(o,I.Id,{SortOrder:u.SortOrder}),await d(o,u.Id,{SortOrder:I.SortOrder})}let f=document.createElement("div");f.id=t;let j=document.createElement("style");j.textContent=st,f.appendChild(j);let c=document.createElement("div");c.className="pr-app",f.appendChild(c),document.body.appendChild(f),lt(f);function O(o){let a=f.querySelector(".pr-status");a&&(a.textContent=o)}async function l(o,a){if(!e.busy){e.busy=!0,c.style.opacity="0.55",c.style.pointerEvents="none",O(o+"\u2026");try{await a(),O(o+" \u5B8C\u4E86")}catch(n){O("\u30A8\u30E9\u30FC: "+n.message),E("err",o+"\u306B\u5931\u6557\u3057\u307E\u3057\u305F \u2014 "+n.message)}finally{e.busy=!1,c.style.opacity="",c.style.pointerEvents=""}}}function M(){let o=i=>e.l2.filter(v=>v.Level1&&v.Level1.Id===i),a=e.l1.find(i=>i.Id===e.selectedL1),n=(i,v,L)=>`
      <div class="pr-row${i.Active===!1?" off":""}${L||""}" data-kind="${v}" data-id="${i.Id}">
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="up" aria-label="\u4E0A\u3078" title="\u4E0A\u3078">${w("chevron-up")}</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="down" aria-label="\u4E0B\u3078" title="\u4E0B\u3078">${w("chevron-down")}</button>
        <span class="pr-name" ${v==="l1"?'data-act="select"':""} title="${h(i.Title)}">${h(i.Title)}${v==="l1"?`<span class="pr-childcount">${o(i.Id).length}</span>`:""}</span>
        <label class="pr-active" title="\u6709\u52B9/\u7121\u52B9">
          <input type="checkbox" data-act="active" aria-label="\u6709\u52B9" ${i.Active!==!1?"checked":""}>
        </label>
        <button class="pr-btn pr-btn--icon pr-btn--icon-action" data-act="rename" aria-label="\u540D\u79F0\u5909\u66F4" title="\u540D\u79F0\u5909\u66F4">${w("edit-2")}</button>
        <button class="pr-btn pr-btn--icon pr-btn--icon-trash" data-act="del" aria-label="\u524A\u9664" title="\u524A\u9664">${w("trash-2")}</button>
      </div>`;return e.ready?`
      <div class="pr-cols">
        <div class="pr-col">
          <div class="pr-sub"><b>\u7B2C1\u968E\u5C64</b><span class="pr-count">${e.l1.length}\u4EF6</span></div>
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l1" placeholder="\u7B2C1\u968E\u5C64\u306E\u540D\u79F0\u3092\u5165\u529B">
            <button class="pr-btn pr-btn--primary" data-act="add-l1">${w("plus")}\u8FFD\u52A0</button>
          </div>
          <div class="pr-rows">${e.l1.map(i=>n(i,"l1",i.Id===e.selectedL1?" sel":"")).join("")||'<div class="pr-empty">\u672A\u767B\u9332</div>'}</div>
        </div>
        <div class="pr-col">
          <div class="pr-sub"><b>\u7B2C2\u968E\u5C64${a?" \u2014 "+h(a.Title):""}</b>
            <span class="pr-count">${a?o(a.Id).length+"\u4EF6":""}</span></div>
          ${a?`
          <div class="pr-toolbar">
            <input type="text" class="pr-input" id="pr-add-l2" placeholder="\u300C${h(a.Title)}\u300D\u914D\u4E0B\u306E\u540D\u79F0\u3092\u5165\u529B">
            <button class="pr-btn pr-btn--primary" data-act="add-l2">${w("plus")}\u8FFD\u52A0</button>
          </div>
          <div class="pr-rows">${o(a.Id).map(i=>n(i,"l2")).join("")||'<div class="pr-empty">\u672A\u767B\u9332</div>'}</div>`:'<div class="pr-empty">\u5DE6\u3067\u7B2C1\u968E\u5C64\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044</div>'}
        </div>
      </div>`:`
        <div class="pr-hero">
          <h4>\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093</h4>
          <p>\u3053\u306E\u30B5\u30A4\u30C8\u306B\u300C${h(x)}\u300D\u3068\u300C${h(g)}\u300D\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002</p>
          <button class="pr-btn pr-btn--primary" data-act="setup">${w("plus")}\u521D\u671F\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7</button>
        </div>`}function pt(){return`
      <div class="pr-hero">
        <h4>\u5229\u7528\u8005\u4E00\u89A7(\u6E96\u5099\u4E2D)</h4>
        <p>\u6A29\u9650\u767B\u9332\u30EA\u30B9\u30C8\u306E\u78BA\u8A8D\u30D3\u30E5\u30FC\u306F\u30D5\u30A7\u30FC\u30BA2\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059\u3002<br>\u307E\u305A\u306F\u300C\u30DE\u30B9\u30BF\u7BA1\u7406\u300D\u3067\u7D44\u7E54\u533A\u5206\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p>
      </div>`}function dt(){let o=window.__permregSource&&window.__permregSource.base||"\u76F4\u63A5\u5B9F\u884C(\u57CB\u3081\u8FBC\u307F/\u958B\u767A\u30B3\u30F3\u30BD\u30FC\u30EB)",a=localStorage.getItem(F)==="local",n=localStorage.getItem(Y)||V;return`
      <div class="pr-settings">
        <h4>\u8A2D\u5B9A</h4>
        <div class="pr-kv">\u30D0\u30FC\u30B8\u30E7\u30F3: <code>${h(H)}</code> / \u4ECA\u56DE\u306E\u8AAD\u8FBC\u5143: <code>${h(o)}</code></div>
        <div class="pr-field">
          <label>bundle \u306E\u914D\u4FE1\u5143(\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u6642\u306B\u3069\u3053\u304B\u3089\u672C\u4F53\u3092\u8AAD\u3080\u304B)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="sp" ${a?"":"checked"}>
            SharePoint (\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8/permreg/ \u306B\u914D\u7F6E\u3057\u305F dist)</label>
          <label class="pr-radio"><input type="radio" name="pr-src" value="local" ${a?"checked":""}>
            \u30ED\u30FC\u30AB\u30EB\u958B\u767A\u30B5\u30FC\u30D0(\u958B\u767A\u8005\u30E2\u30FC\u30C9)</label>
        </div>
        <div class="pr-field">
          <label>\u30ED\u30FC\u30AB\u30EB\u914D\u4FE1 URL(\u958B\u767A\u8005\u30E2\u30FC\u30C9\u6642)</label>
          <input type="text" class="pr-input" id="pr-dev-base" value="${h(n)}" placeholder="${h(V)}">
          <span class="pr-note">\u30EA\u30DD\u30B8\u30C8\u30EA\u3067 <code>npm run dev</code> \u3092\u8D77\u52D5\u3057\u3001\u30D3\u30EB\u30C9\u3057\u305F dist/ \u3092\u914D\u4FE1\u3057\u307E\u3059\u3002</span>
        </div>
        <div>
          <button class="pr-btn pr-btn--primary" data-act="save-settings">\u4FDD\u5B58</button>
        </div>
        <div class="pr-field">
          <span class="pr-note">\u8A2D\u5B9A\u306F\u6B21\u56DE\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u304B\u3089\u53CD\u6620\u3055\u308C\u307E\u3059(\u3053\u306E\u30D1\u30CD\u30EB\u306F\u518D\u8AAD\u8FBC\u3055\u308C\u307E\u305B\u3093)\u3002</span>
        </div>
      </div>`}function q(){let o={users:pt,master:M,settings:dt},a=(n,i,v)=>`
      <button class="pr-nav-item${e.view===n?" active":""}" data-act="nav" data-view="${n}">
        ${i}<small>${v}</small></button>`;c.innerHTML=`
      <div class="pr-topbar">
        <span class="pr-title">permreg<small>\u5229\u7528\u8005\u6A29\u9650\u767B\u9332 \u7BA1\u7406</small></span>
        <input type="text" class="pr-input" id="pr-weburl" style="flex:1" value="${h(Z())}"
          aria-label="SharePoint \u30B5\u30A4\u30C8URL" title="SharePoint \u30B5\u30A4\u30C8URL">
        <button class="pr-btn pr-btn--ghost" data-act="reload">${w("refresh-cw")}\u518D\u8AAD\u8FBC</button>
        <button class="pr-btn pr-btn--icon pr-btn--ghost" data-act="close" aria-label="\u9589\u3058\u308B" title="\u9589\u3058\u308B">${w("x")}</button>
      </div>
      <div class="pr-body">
        <nav class="pr-side" aria-label="\u30E1\u30CB\u30E5\u30FC">
          <div class="pr-side-head">\u30E1\u30CB\u30E5\u30FC</div>
          ${a("users","\u5229\u7528\u8005\u4E00\u89A7","\u767B\u9332\u72B6\u6CC1\u306E\u78BA\u8A8D\u30D3\u30E5\u30FC")}
          ${a("master","\u30DE\u30B9\u30BF\u7BA1\u7406","\u7D44\u7E54\u533A\u5206(\u7B2C1/\u7B2C2\u968E\u5C64)")}
          ${a("settings","\u8A2D\u5B9A","\u914D\u4FE1\u5143 / \u958B\u767A\u8005\u30E2\u30FC\u30C9")}
        </nav>
        <div class="pr-main">${o[e.view]()}</div>
      </div>
      <div class="pr-status">${e.ready?"\u6E96\u5099OK":"\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u672A\u4F5C\u6210"} / ${h(H)}</div>`}async function _(){await m(),e.ready&&await S(),q()}c.addEventListener("change",o=>{let a=o.target;if(a.id==="pr-weburl"){Q(a.value.trim()),localStorage.setItem(J,Z());return}if(a.dataset.act==="active"){let n=a.closest(".pr-row"),i=n.dataset.kind==="l1"?x:g;l("\u66F4\u65B0",async()=>{await d(i,+n.dataset.id,{Active:a.checked}),await _()})}}),c.addEventListener("keydown",o=>{o.key==="Enter"&&(o.target.id==="pr-add-l1"&&c.querySelector('[data-act="add-l1"]').click(),o.target.id==="pr-add-l2"&&c.querySelector('[data-act="add-l2"]').click())}),c.addEventListener("click",async o=>{let a=o.target.closest("[data-act]");if(!a)return;let n=a.dataset.act,i=a.closest(".pr-row"),v=i&&i.dataset.kind,L=i&&+i.dataset.id,U=v==="l1"?x:g,B=v==="l1"?e.l1:e.l2.filter(u=>u.Level1&&u.Level1.Id===e.selectedL1),I=B&&B.find(u=>u.Id===L);if(n==="close"){f.remove();return}if(n==="nav"){e.view=a.dataset.view,q();return}if(n==="reload"){l("\u518D\u8AAD\u8FBC",_);return}if(n==="setup"){l("\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7",async()=>{await it(O),await _(),E("ok","\u30DE\u30B9\u30BF\u30EA\u30B9\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F")});return}if(n==="select"){e.selectedL1=L,q();return}if(n==="save-settings"){let u=c.querySelector('input[name="pr-src"][value="local"]').checked,p=c.querySelector("#pr-dev-base").value.trim().replace(/\/+$/,"");u?(localStorage.setItem(F,"local"),localStorage.setItem(Y,p||V)):localStorage.removeItem(F),E("ok","\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u6B21\u56DE\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u30EC\u30C3\u30C8\u8D77\u52D5\u304B\u3089\u53CD\u6620\u3055\u308C\u307E\u3059");return}if(n==="add-l1"||n==="add-l2"){let p=c.querySelector(n==="add-l1"?"#pr-add-l1":"#pr-add-l2").value.trim();if(!p)return;let C=n==="add-l1"?e.l1:e.l2.filter(D=>D.Level1&&D.Level1.Id===e.selectedL1);if(C.some(D=>D.Title===p)){E("warn","\u300C"+p+"\u300D\u306F\u65E2\u306B\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059");return}l("\u8FFD\u52A0",async()=>{let D={Title:p,SortOrder:y(C),Active:!0};n==="add-l2"&&(D.Level1Id=e.selectedL1),await T(n==="add-l1"?x:g,D),await _(),E("ok","\u300C"+p+"\u300D\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F")});return}if(I)if(n==="rename"){let u=await et({title:"\u540D\u79F0\u5909\u66F4",inputValue:I.Title,okLabel:"\u4FDD\u5B58"});if(!u||u===I.Title)return;l("\u540D\u79F0\u5909\u66F4",async()=>{await d(U,L,{Title:u}),await _()})}else if(n==="del"){if(v==="l1"){let p=e.l2.filter(C=>C.Level1&&C.Level1.Id===L);if(p.length){E("warn","\u300C"+I.Title+"\u300D\u306B\u306F\u7B2C2\u968E\u5C64\u304C "+p.length+" \u4EF6\u3042\u308A\u307E\u3059\u3002\u5148\u306B\u7B2C2\u968E\u5C64\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044");return}}if(!await et({title:"\u524A\u9664\u306E\u78BA\u8A8D",message:"\u300C"+I.Title+"\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002",okLabel:"\u524A\u9664\u3059\u308B",danger:!0}))return;l("\u524A\u9664",async()=>{await $(U,L),await _(),E("ok","\u300C"+I.Title+"\u300D\u3092\u524A\u9664\u3057\u307E\u3057\u305F")})}else(n==="up"||n==="down")&&l("\u4E26\u3079\u66FF\u3048",async()=>{await k(U,B,I,n==="up"?-1:1),await _()})}),q(),l("\u8AAD\u8FBC",_),window.__permreg={state:e,build:H}})();})();
