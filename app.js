let modus="";
let teamA="";
let teamB="";
let aktuellesSpiel=1;
let spiele=[];
let timer=0;
let timerInterval=null;
let status="spiel";

/* ---------- SPEICHERN ---------- */
function speichern(){
    const daten={modus,teamA,teamB,aktuellesSpiel,spiele,timer,status};
    localStorage.setItem("spieltagApp",JSON.stringify(daten));
}

function laden(){
    const daten=JSON.parse(localStorage.getItem("spieltagApp"));
    if(!daten) return false;

    modus=daten.modus;
    teamA=daten.teamA;
    teamB=daten.teamB;
    aktuellesSpiel=daten.aktuellesSpiel;
    spiele=daten.spiele;
    timer=daten.timer;
    status=daten.status;

    return true;
}

/* ---------- SETUP ---------- */
function setModus(a){modus=a;zeigeTeamEingabe();}

function zeigeModusAuswahl(){
document.body.innerHTML=`
<h1>Spieltag starten</h1>
<button onclick="setModus('single')">Singlemodus</button>
<button onclick="setModus('twin')">Twinmodus</button>`;
}

function zeigeTeamEingabe(){
document.body.innerHTML=`
<h1>Teams eingeben</h1>
<input id="teamA" placeholder="Team A" value="${teamA}">
<input id="teamB" placeholder="Team B" value="${teamB}">
<br><br>
<button onclick="zeigeModusAuswahl()">Zurück</button>
<button onclick="startSpieltag()">Spieltag starten</button>`;
}

function startSpieltag(){
teamA=document.getElementById("teamA").value;
teamB=document.getElementById("teamB").value;
aktuellesSpiel=1;
spiele=[];

for(let i=0;i<3;i++){
spiele.push(modus==="single"?{felder:[{a:0,b:0}]}:{felder:[{a:0,b:0},{a:0,b:0}]});
}

speichern();
ladeSpiel();
}

/* ---------- ZWISCHENSTAND ---------- */
function berechneZwischenstand(){
let pa=0,pb=0;
spiele.forEach(s=>s.felder.forEach(f=>{
if(f.a>f.b)pa++;else if(f.b>f.a)pb++;else if(f.a||f.b){pa++;pb++;}
}));
return{pa,pb};
}

/* ---------- SPIEL ---------- */
function ladeSpiel(){

let zwischen=berechneZwischenstand();

let tabs=`<div>
<button onclick="springeZuSpiel(1)">Spiel 1</button>
<button onclick="springeZuSpiel(2)">Spiel 2</button>
<button onclick="springeZuSpiel(3)">Spiel 3</button>
</div>`;

let html=`<h1>Spiel ${aktuellesSpiel}</h1>
${tabs}
<div style="background:#e3f2fd;padding:10px;margin:10px 0;font-weight:bold;">
Zwischenstand: ${teamA.toUpperCase()} ${zwischen.pa} : ${zwischen.pb} ${teamB.toUpperCase()}
</div>
<h2 id="zeit">${formatZeit(timer)}</h2>
<button onclick="startTimer()">Start</button>
<button onclick="pauseTimer()">Pause</button>
<button onclick="resetTimer()">Reset</button><hr>`;

spiele[aktuellesSpiel-1].felder.forEach((f,i)=>{
html+=`
<h3>Feld ${i+1}</h3>
<h2>${teamA}</h2>
<button onclick="minusA(${i})">-</button> ${f.a}
<button onclick="plusA(${i})">+</button>
<h2>${teamB}</h2>
<button onclick="minusB(${i})">-</button> ${f.b}
<button onclick="plusB(${i})">+</button><hr>`;
});

html+=`
<button onclick="vorherigesSpiel()">Zurück</button>
<button onclick="naechstesSpiel()">Weiter</button>`;

document.body.innerHTML=html;
}

/* ---------- TORE ---------- */
function plusA(f){spiele[aktuellesSpiel-1].felder[f].a++;speichern();ladeSpiel();}
function minusA(f){if(spiele[aktuellesSpiel-1].felder[f].a>0)spiele[aktuellesSpiel-1].felder[f].a--;speichern();ladeSpiel();}
function plusB(f){spiele[aktuellesSpiel-1].felder[f].b++;speichern();ladeSpiel();}
function minusB(f){if(spiele[aktuellesSpiel-1].felder[f].b>0)spiele[aktuellesSpiel-1].felder[f].b--;speichern();ladeSpiel();}

/* ---------- TIMER ---------- */
function formatZeit(s){return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function startTimer(){if(timerInterval)return;timerInterval=setInterval(()=>{timer++;document.getElementById("zeit").innerText=formatZeit(timer);speichern();if(timer>=1200){clearInterval(timerInterval);alert("20 Minuten erreicht!");}},1000);}
function pauseTimer(){clearInterval(timerInterval);timerInterval=null;speichern();}
function resetTimer(){clearInterval(timerInterval);timerInterval=null;timer=0;speichern();ladeSpiel();}

/* ---------- NAV ---------- */
function springeZuSpiel(n){aktuellesSpiel=n;speichern();ladeSpiel();}
function vorherigesSpiel(){if(aktuellesSpiel>1){aktuellesSpiel--;ladeSpiel();}else zeigeTeamEingabe();}
function naechstesSpiel(){timer=0;clearInterval(timerInterval);if(aktuellesSpiel<3){aktuellesSpiel++;speichern();ladeSpiel();}else zeigeErgebnis();}

/* ---------- PDF EXPORT ---------- */
async function exportierePDF(){
const { jsPDF } = window.jspdf;
const canvas = await html2canvas(document.body);
const img = canvas.toDataURL("image/png");
const pdf = new jsPDF({orientation:"portrait",unit:"px",format:[canvas.width,canvas.height]});
pdf.addImage(img,"PNG",0,0);
pdf.save("spieltag.pdf");
}

/* ---------- ERGEBNIS ---------- */
function zeigeErgebnis(){
let pa=0,pb=0;
spiele.forEach(s=>s.felder.forEach(f=>{
if(f.a>f.b)pa++;else if(f.b>f.a)pb++;else{pa++;pb++;}
}));
status="ergebnis";
speichern();
document.body.innerHTML=`
<h1>Spieltag Ergebnis</h1>
<h2>${teamA}: ${pa}</h2>
<h2>${teamB}: ${pb}</h2>
<button onclick="exportierePDF()">PDF speichern</button>
<button onclick="springeZuSpiel(3)">Zurück zu Spiel 3</button>
<button onclick="neuerSpieltag()">Neuer Spieltag</button>`;
}

function neuerSpieltag(){localStorage.removeItem("spieltagApp");location.reload();}

/* ---------- START ---------- */
window.onload=function(){
if(laden()){
if(status==="ergebnis") zeigeErgebnis();
else ladeSpiel();
}else{
zeigeModusAuswahl();
}
}