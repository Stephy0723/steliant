/* ================= Arranque ================= */
rebuildIndex();shell();
$("#menuBtn").addEventListener("click",openDrawer);
$("#drClose").addEventListener("click",closeDrawer);
$("#scrim").addEventListener("click",closeDrawer);
$("#themeBtn").addEventListener("click",e=>setTheme(isDark()?"light":"dark",e));
$("#themeSeg").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(b)setTheme(b.dataset.t,e)});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",paintTheme);
paintTheme();
const start=parse(location.hash);
go(valid(start)?start:"inicio",false);
initData();paintPanelLink();
try{history.replaceState({r:route},"","#"+route)}catch(e){}
const sp=$("#splash");
if(reduce){sp.remove()}else{const hide=()=>{sp.classList.add("done");setTimeout(()=>sp.remove(),1000)};sp.addEventListener("click",hide);setTimeout(hide,1500)}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(moveInd);
setTimeout(moveInd,300);
