(function(){
if (window.__maiaKit) return; window.__maiaKit = true;
var P = {
home:"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
chat:"M4 5h16v11H9l-5 4z",
scan:"M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
chart:"M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
calendar:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
bell:"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
users:"M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6",
settings:"M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
mic:"M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
camera:"M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
send:"M4 12 20 4l-6 16-3-7z",
back:"M15 5l-7 7 7 7",
chevron:"M9 5l7 7-7 7",
down:"M5 9l7 7 7-7",
up:"M5 15l7-7 7 7",
check:"M5 12.5l4.5 4.5L19 7.5",
x:"M6 6l12 12M18 6 6 18",
plus:"M12 5v14M5 12h14",
search:"M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
filter:"M4 5h16l-6 8v6l-4-2v-4z",
flame:"M12 21c-4 0-7-2.7-7-6.5 0-3.5 3-5.5 4-9 2 1.5 3 3.5 3 5.5 1-1 1.5-2 1.5-3.5 2.5 2 4.5 4.5 4.5 7 0 3.8-2 6.5-6 6.5z",
target:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
clock:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
book:"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
file:"M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
image:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
play:"M8 5v14l11-7z",
pause:"M8 5v14M16 5v14",
lock:"M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
mail:"M3 6h18v12H3zM3 7l9 6 9-6",
globe:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
shield:"M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z",
download:"M12 4v11M7 10l5 5 5-5M5 20h14",
upload:"M12 20V9M7 14l5-5 5 5M5 4h14",
grid:"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
list:"M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
edit:"M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
trash:"M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
eye:"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
alert:"M12 3 2 20h20zM12 10v4M12 17h.01",
info:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
star:"M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
logout:"M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
card:"M3 6h18v12H3zM3 10h18M7 15h3",
building:"M4 21V5l8-3 8 3v16M4 21h16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01",
briefcase:"M3 8h18v12H3zM9 8V5h6v3M3 13h18",
heart:"M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
menu:"M4 7h16M4 12h16M4 17h16",
refresh:"M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
palette:"M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8zM7.5 11h.01M9.5 7h.01M14.5 7h.01",
database:"M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
layers:"M12 3 2 8l10 5 10-5zM2 12.5l10 5 10-5M2 16.5l10 5 10-5",
euro:"M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9",
trend:"M3 17l6-6 4 4 8-8M15 7h6v6",
sun:"M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
bulb:"M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
flag:"M5 21V4M5 4h12l-2 4 2 4H5",
more:"M5 12h.01M12 12h.01M19 12h.01",
external:"M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
clip:"M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7",
phone:"M7 3h10v18H7zM11 18h2",
monitor:"M3 4h18v12H3zM8 20h8M12 16v4",
copy:"M8 8h12v12H8zM4 16V4h12",
help:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01",
wave:"M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2",
moon:"M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
arrow:"M5 12h14M13 6l6 6-6 6",
video:"M3 6h13v12H3zM16 10l5-3v10l-5-3",
sort:"M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4",
maths:"M4 7h7M7.5 3.5v7M14 5l5 5M19 5l-5 5M4 16h7M14 15h5M14 19h5",
physique:"M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10",
svt:"M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8",
francais:"M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v14",
anglais:"M3 18l4.5-12L12 18M4.5 14h6M17.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM20 11v7",
histoire:"M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"
};
function scallop(){var pts=[],n=12;for(var i=0;i<n*2;i++){var a=Math.PI*i/n-Math.PI/2,r=i%2?10.2:11.6;pts.push((12+r*Math.cos(a)).toFixed(2)+","+(12+r*Math.sin(a)).toFixed(2));}return pts.join(" ");}
var SC=scallop();
class UiIcon extends HTMLElement{
 static get observedAttributes(){return["name","size","stroke","color"];}
 connectedCallback(){this.r();} attributeChangedCallback(){this.r();}
 r(){var n=this.getAttribute("name")||"info",s=this.getAttribute("size")||"20",w=this.getAttribute("stroke")||"1.5",c=this.getAttribute("color")||"currentColor";
  this.style.display="inline-flex";this.style.flex="none";this.style.lineHeight="0";
  if(n==="verified"){this.R().innerHTML='<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24"><polygon points="'+SC+'" fill="#1D8CF0" stroke="#1D8CF0" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.6 12.3l3 3 5.8-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';return;}
  if(n==="logo"){this.R().innerHTML='<svg width="'+s+'" height="'+s+'" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#14325C"/><path d="M9 21.5V11l7 7.5 7-7.5v10.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23.5" cy="7.5" r="2.2" fill="#1D8CF0"/></svg>';return;}
  this.R().innerHTML='<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"><path d="'+(P[n]||P.info)+'"/></svg>';}
}
HTMLElement.prototype.R=function(){return this.shadowRoot||this.attachShadow({mode:"open"});};
customElements.define("ui-icon",UiIcon);
var katexState=0,waiters=[];
function loadKatex(cb){if(window.katex)return cb();waiters.push(cb);if(katexState)return;katexState=1;
 var l=document.createElement("link");l.rel="stylesheet";l.href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";document.head.appendChild(l);
 var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";s.onload=function(){waiters.forEach(function(f){f()});waiters=[];};document.head.appendChild(s);}
class UiMath extends HTMLElement{
 static get observedAttributes(){return["tex","display"];}
 connectedCallback(){this.r();} attributeChangedCallback(){this.r();}
 r(){var t=this.getAttribute("tex")||"",d=this.hasAttribute("display"),root=this.R();if(!root.firstChild){root.innerHTML='<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><span></span>';}var el=root.lastChild;if(!window.katex)el.textContent=t.replace(/\\[a-z]+/gi,"").replace(/[{}]/g,"");
  loadKatex(function(){try{window.katex.render(t,el,{displayMode:d,throwOnError:false});}catch(e){el.textContent=t;}});}
}
customElements.define("ui-math",UiMath);
var N="#14325C",A="#2F6FB5",L="#EDF3FA",G="#6E6E6E",O="#E58A3C";
var ILL={
pythagore:'<svg viewBox="30 -10 270 270" width="100%"><g font-family="Poppins" font-size="14"><rect x="60" y="90" width="60" height="60" fill="#fff" stroke="'+A+'" stroke-width="1.5" stroke-dasharray="4 3"/><rect x="120" y="150" width="90" height="90" fill="#fff" stroke="'+A+'" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M120 90 L210 150 L270 60 L180 0 Z" fill="#fff" stroke="'+A+'" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M120 150 L210 150 L120 90 Z" fill="'+L+'" stroke="'+N+'" stroke-width="2" stroke-linejoin="round"/><path d="M120 138 h12 v12" fill="none" stroke="'+N+'" stroke-width="1.5"/><text x="90" y="125" fill="'+A+'" text-anchor="middle">a²</text><text x="165" y="200" fill="'+A+'" text-anchor="middle">b²</text><text x="195" y="80" fill="'+A+'" text-anchor="middle">c²</text><text x="112" y="125" fill="'+N+'" text-anchor="end" font-weight="500">a</text><text x="165" y="166" fill="'+N+'" text-anchor="middle" font-weight="500">b</text><text x="170" y="115" fill="'+N+'" font-weight="500">c</text></g></svg>',
equation:'<svg viewBox="0 0 320 200" width="100%"><g font-family="Poppins"><path d="M160 40 v120 M110 170 h100" stroke="'+N+'" stroke-width="2" stroke-linecap="round"/><path d="M60 60 h200" stroke="'+N+'" stroke-width="2" stroke-linecap="round"/><circle cx="160" cy="60" r="5" fill="'+N+'"/><path d="M60 60 l-25 50 h50z M260 60 l-25 50 h50z" fill="'+L+'" stroke="'+A+'" stroke-width="1.5" stroke-linejoin="round"/><rect x="38" y="84" width="18" height="18" rx="3" fill="'+N+'"/><rect x="60" y="84" width="18" height="18" rx="3" fill="'+N+'"/><text x="47" y="97" fill="#fff" font-size="11" text-anchor="middle">x</text><text x="69" y="97" fill="#fff" font-size="11" text-anchor="middle">x</text><circle cx="89" cy="93" r="6" fill="#fff" stroke="'+A+'" stroke-width="1.5"/><g fill="#fff" stroke="'+A+'" stroke-width="1.5"><circle cx="238" cy="99" r="6"/><circle cx="252" cy="99" r="6"/><circle cx="266" cy="99" r="6"/><circle cx="280" cy="99" r="6"/><circle cx="245" cy="87" r="6"/><circle cx="259" cy="87" r="6"/><circle cx="273" cy="87" r="6"/></g><text x="160" y="195" font-size="13" fill="'+G+'" text-anchor="middle">2x + 1 = 7</text></g></svg>',
fraction:'<svg viewBox="0 0 320 180" width="100%"><g font-family="Poppins"><circle cx="90" cy="85" r="60" fill="#fff" stroke="'+N+'" stroke-width="2"/><path d="M90 85 L90 25 A60 60 0 1 1 30 85 Z" fill="'+L+'" stroke="'+A+'" stroke-width="1.5"/><path d="M90 25 v120 M30 85 h120" stroke="'+N+'" stroke-width="1.5"/><text x="230" y="80" font-size="34" fill="'+N+'" text-anchor="middle" font-weight="500">3</text><path d="M205 92 h50" stroke="'+N+'" stroke-width="2"/><text x="230" y="128" font-size="34" fill="'+N+'" text-anchor="middle" font-weight="500">4</text><text x="160" y="172" font-size="12" fill="'+G+'" text-anchor="middle">3 parts colorées sur 4 parts égales</text></g></svg>',
lineaire:'<svg viewBox="0 0 320 220" width="100%"><g font-family="Poppins" font-size="11" fill="'+G+'"><g stroke="#E3E8EF"><path d="M40 20v170M80 20v170M120 20v170M160 20v170M200 20v170M240 20v170M280 20v170M30 30h260M30 70h260M30 110h260M30 150h260M30 190h260"/></g><path d="M30 150 h270 M80 200 V15" stroke="'+N+'" stroke-width="1.5"/><path d="M40 230 L230 -5" stroke="'+A+'" stroke-width="2.5" stroke-linecap="round" clip-path="inset(0)"/><circle cx="80" cy="150" r="4" fill="'+N+'"/><circle cx="120" cy="110" r="4" fill="'+A+'"/><circle cx="160" cy="70" r="4" fill="'+A+'"/><text x="170" y="66" fill="'+A+'">f(2) = 4</text><text x="210" y="30" fill="'+A+'" font-size="13" font-weight="500">f(x) = 2x</text><text x="86" y="165">0</text><text x="116" y="165">1</text><text x="156" y="165">2</text></g></svg>',
circuit:'<svg viewBox="0 0 320 200" width="100%"><g font-family="Poppins" font-size="12" fill="'+G+'"><path d="M60 50 h200 v110 h-200z" fill="none" stroke="'+N+'" stroke-width="2"/><rect x="130" y="40" width="60" height="20" fill="#fff" stroke="'+A+'" stroke-width="2"/><text x="160" y="32" text-anchor="middle" fill="'+N+'">R = 100 Ω</text><path d="M52 95 h16 M56 110 h8" stroke="'+N+'" stroke-width="3"/><rect x="50" y="92" width="20" height="24" fill="#fff" stroke="none"/><path d="M48 98 h24 M54 108 h12" stroke="'+N+'" stroke-width="3"/><text x="82" y="108" fill="'+N+'">U = 6 V</text><circle cx="260" cy="105" r="16" fill="#fff" stroke="'+A+'" stroke-width="2"/><text x="260" y="110" text-anchor="middle" fill="'+A+'" font-weight="500">A</text><text x="160" y="190" text-anchor="middle">I = U / R = 0,06 A</text></g></svg>'
};
class UiIllus extends HTMLElement{
 static get observedAttributes(){return["name"];}
 connectedCallback(){this.r();} attributeChangedCallback(){this.r();}
 r(){this.style.display="block";this.R().innerHTML=ILL[this.getAttribute("name")]||"";}
}
customElements.define("ui-illus",UiIllus);
})();
