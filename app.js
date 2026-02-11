let modus="";
let teamA="";
let teamB="";
let aktuellesSpiel=1;
let spiele=[];
let timer=0;
let timerInterval=null;
let status="spiel";

/* ---------- SIGNALTON ---------- */
function signalTonAbspielen(){
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
}

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

/* ---------- PAARUNGEN ---------- */
function getPaarungen(){

    if(modus==="single"){
        return [{a:teamA.toUpperCase(),b:teamB.toUpperCase()}];
    }

    if(aktuellesSpiel===2){
        return [
            {a:`${teamA.toUpperCase()}1`,b:`${teamB.toUpperCase()}2`},
            {a:`${teamA.toUpperCase()}2`,b:`${teamB.toUpperCase()}1`}
        ];
    }

    return [
        {a:`${teamA.toUpperCase()}1`,b:`${teamB.toUpperCase()}1`},
        {a:`${teamA.toUpperCase()}2`,b:`${teamB.toUpperCase()}2`}
    ];
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
let paarungen=getPaarungen();

let hinweis="";
if(aktuellesSpiel===3){
hinweis=`<div style="background:#ffeeba;padding:10px;margin:10px 0;font-weight:bold;">
Hinweis: Bitte 2–4 Spieler zwischen A1/A2 und B1/B2 tauschen!
</div>`;
}

let html=`<h1>Spiel ${aktuellesSpiel}</h1>
${hinweis}
<div style="background:#e3f2fd;padding:10px;margin:10px 0;font-weight:bold;">
Zwischenstand: ${teamA.toUpperCase()} ${zwischen.pa} : ${zwischen.pb} ${teamB.toUpperCase()}
</div>
<h2 id="zeit">${formatZeit(timer)}</h2>
<button onclick="startTimer()">Start</button>
<button onclick="pauseTimer()">Pause</button>
<button onclick="resetTimer()">Reset</button><hr>`;

spiele[aktuellesSpiel-1].felder.forEach((f,i)=>{

html+=`
<div style="margin-bottom:25px;padding:15px;border:1px solid #ccc;border-radius:12px;">
<h3>Feld ${i+1}</h3>

<div style="font-size:24px;font-weight:bold;margin-bottom:15px;text-align:center;">
${paarungen[i].a} --- ${f.a} | ${f.b} --- ${paarungen[i].b}
</div>

<div style="display:flex;justify-content:space-between;">
    <div style="text-align:center;">
        <button style="background:#2e7d32;color:white;font-size:28px;padding:15px;margin:10px;"
        onclick="plusA(${i})">+</button>
        <button style="background:#c62828;color:white;font-size:28px;padding:15px;margin:10px;"
        onclick="minusA(${i})">-</button>
    </div>

    <div style="text-align:center;">
        <button style="background:#2e7d32;color:white;font-size:28px;padding:15px;margin:10px;"
        onclick="plusB(${i})">+</button>
        <button style="background:#c62828;color:white;font-size:28px;padding:15px;margin:10px;"
        onclick="minusB(${i})">-</button>
    </div>
</div>
</div>
`;
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

function startTimer(){
if(timerInterval) return;
timerInterval=setInterval(()=>{
timer++;
document.getElementById("zeit").innerText=formatZeit(timer);
speichern();

if(timer>=10){ // TESTZEIT
clearInterval(timerInterval);
timerInterval=null;
signalTonAbspielen();
alert("Zeit erreicht!");
}
},1000);
}

function pauseTimer(){clearInterval(timerInterval);timerInterval=null;speichern();}
function resetTimer(){clearInterval(timerInterval);timerInterval=null;timer=0;speichern();ladeSpiel();}

/* ---------- NAV ---------- */
function vorherigesSpiel(){if(aktuellesSpiel>1){aktuellesSpiel--;ladeSpiel();}else zeigeTeamEingabe();}
function naechstesSpiel(){
timer=0;
clearInterval(timerInterval);
timerInterval=null;

if(aktuellesSpiel<3){
aktuellesSpiel++;
speichern();
ladeSpiel();
}else{
zeigeErgebnis();
}
}

/* ---------- PDF ---------- */
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
