let modus="";
let teamA="";
let teamB="";
let aktuellesSpiel=1;
let spiele=[];
let gestarteteSpiele=[false,false,false];
let timer=0;
let timerInterval=null;
let status="spiel";

const TESTZEIT = 10;

/* SIGNAL */
function signalTonAbspielen(){
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.4);
}

/* SPEICHERN */
function speichern(){
localStorage.setItem("spieltagApp",
JSON.stringify({modus,teamA,teamB,aktuellesSpiel,spiele,gestarteteSpiele,status}));
}

function laden(){
let d=JSON.parse(localStorage.getItem("spieltagApp"));
if(!d) return false;
modus=d.modus;
teamA=d.teamA;
teamB=d.teamB;
aktuellesSpiel=d.aktuellesSpiel;
spiele=d.spiele;
gestarteteSpiele=d.gestarteteSpiele||[false,false,false];
status=d.status;
return true;
}

/* PAARUNGEN */
function getPaarungen(){

if(modus==="single"){
return [{a:teamA,b:teamB}];
}

if(aktuellesSpiel===2){
return [
{a:teamA+"-1",b:teamB+"-2"},
{a:teamA+"-2",b:teamB+"-1"}
];
}

return [
{a:teamA+"-1",b:teamB+"-1"},
{a:teamA+"-2",b:teamB+"-2"}
];
}

/* ZWISCHENSTAND */
function berechneZwischenstand(){
let pa=0,pb=0;
spiele.forEach((s,i)=>{
if(!gestarteteSpiele[i]) return;
s.felder.forEach(f=>{
if(f.a>f.b) pa++;
else if(f.b>f.a) pb++;
else {pa++;pb++;}
});
});
return {pa,pb};
}

/* SETUP */
function setModus(m){modus=m;zeigeTeamEingabe();}

function zeigeModusAuswahl(){
document.body.innerHTML=`
<h1>Modus wählen</h1>
<button onclick="setModus('single')">Single</button>
<button onclick="setModus('twin')">Twin</button>`;
}

function zeigeTeamEingabe(){
document.body.innerHTML=`
<h1>Teams</h1>
<input id="teamA" placeholder="Team A">
<input id="teamB" placeholder="Team B">
<br><br>
<button onclick="zeigeModusAuswahl()">Zurück</button>
<button onclick="startSpieltag()">Start</button>`;
}

function startSpieltag(){
teamA=document.getElementById("teamA").value;
teamB=document.getElementById("teamB").value;
spiele=[];
gestarteteSpiele=[false,false,false];
aktuellesSpiel=1;

for(let i=0;i<3;i++){
spiele.push(modus==="single"?{felder:[{a:0,b:0}]}:{felder:[{a:0,b:0},{a:0,b:0}]});
}
speichern();
ladeSpiel();
}

/* SPIEL */
function ladeSpiel(){

let paarungen=getPaarungen();
let z=berechneZwischenstand();

let hinweis="";
if(aktuellesSpiel===3 && modus==="twin"){
hinweis=`<div style="background:#ffeeba;padding:10px;font-weight:bold;">
Vor Spielbeginn 2-4 Spieler tauschen!
</div>`;
}

let html=`
<h1>Spiel ${aktuellesSpiel}</h1>
${hinweis}

<div style="background:#e3f2fd;padding:10px;font-weight:bold;">
Zwischenstand: ${teamA} ${z.pa} : ${z.pb} ${teamB}
</div>

<div style="display:flex;gap:8px;justify-content:center;margin:10px;">
<button onclick="startTimer()">Start</button>
<button onclick="pauseTimer()">Pause</button>
<button onclick="resetTimer()">Reset</button>
</div>

<h2 id="zeit" style="text-align:center;">${timer}</h2>
<hr>
`;

spiele[aktuellesSpiel-1].felder.forEach((f,i)=>{
html+=`
<div style="border:1px solid #ccc;padding:12px;margin:10px;">
<h3>Feld ${i+1}</h3>

<div style="font-size:22px;text-align:center;font-weight:bold;">
${paarungen[i].a} --- ${f.a} | ${f.b} --- ${paarungen[i].b}
</div>

<div style="display:flex;justify-content:space-between;">
<div>
<button style="background:green;color:white;font-size:26px;margin:6px;" onclick="plusA(${i})">+</button>
<button style="background:red;color:white;font-size:26px;margin:6px;" onclick="minusA(${i})">-</button>
</div>
<div>
<button style="background:green;color:white;font-size:26px;margin:6px;" onclick="plusB(${i})">+</button>
<button style="background:red;color:white;font-size:26px;margin:6px;" onclick="minusB(${i})">-</button>
</div>
</div>
</div>`;
});

html+=`
<button onclick="vorherigesSpiel()">Zurück</button>
<button onclick="naechstesSpiel()">Weiter</button>`;

document.body.innerHTML=html;
}

/* TORE */
function plusA(i){spiele[aktuellesSpiel-1].felder[i].a++;speichern();ladeSpiel();}
function minusA(i){if(spiele[aktuellesSpiel-1].felder[i].a>0)spiele[aktuellesSpiel-1].felder[i].a--;speichern();ladeSpiel();}
function plusB(i){spiele[aktuellesSpiel-1].felder[i].b++;speichern();ladeSpiel();}
function minusB(i){if(spiele[aktuellesSpiel-1].felder[i].b>0)spiele[aktuellesSpiel-1].felder[i].b--;speichern();ladeSpiel();}

/* TIMER */
function startTimer(){
gestarteteSpiele[aktuellesSpiel-1]=true;
if(timerInterval) return;

timerInterval=setInterval(()=>{
timer++;

let el=document.getElementById("zeit");
el.innerText=timer;

if(timer>=TESTZEIT-30){
el.style.color=(timer%2===0)?"red":"black";
}else{
el.style.color="black";
}

if(timer>=TESTZEIT){
clearInterval(timerInterval);
timerInterval=null;
signalTonAbspielen();
if(navigator.vibrate) navigator.vibrate([300,200,300]);
}
},1000);
}

function pauseTimer(){clearInterval(timerInterval);timerInterval=null;}
function resetTimer(){clearInterval(timerInterval);timerInterval=null;timer=0;ladeSpiel();}

/* NAV */
function vorherigesSpiel(){

    if(aktuellesSpiel > 1){
        aktuellesSpiel--;
        timer = 0;
        ladeSpiel();
    }else{
        zeigeTeamEingabe();   // zurück zur Team-Auswahl
    }

}
function naechstesSpiel(){
timer=0;
clearInterval(timerInterval);
timerInterval=null;
if(aktuellesSpiel<3){aktuellesSpiel++;ladeSpiel();}
else zeigeErgebnis();
}

/* ERGEBNIS */
function zeigeErgebnis(){
let pa=0,pb=0;
spiele.forEach(s=>s.felder.forEach(f=>{
if(f.a>f.b) pa++;
else if(f.b>f.a) pb++;
else {pa++;pb++;}
}));

document.body.innerHTML=`
<h1>Ergebnis</h1>
<h2>${teamA}: ${pa}</h2>
<h2>${teamB}: ${pb}</h2>
<button onclick="exportierePDF()">PDF</button>
<button onclick="springeZuSpiel(3)">Zurück</button>
<button onclick="neuerSpieltag()">Neuer Spieltag</button>`;
}

async function exportierePDF(){
const { jsPDF } = window.jspdf;
const canvas = await html2canvas(document.body);
const img = canvas.toDataURL("image/png");
const pdf=new jsPDF();
pdf.addImage(img,"PNG",0,0);
pdf.save("spieltag.pdf");
}

function neuerSpieltag(){localStorage.clear();location.reload();}
function springeZuSpiel(n){aktuellesSpiel=n;ladeSpiel();}

/* START */
window.onload=function(){
if(laden()){
if(status==="ergebnis") zeigeErgebnis();
else ladeSpiel();
}else{
zeigeModusAuswahl();
}
}