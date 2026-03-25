let modus="";
let teamA="";
let teamB="";
let aktuellesSpiel=1;
let spiele=[];
let gestarteteSpiele=[false,false,false];
let timer=0;
let timerInterval=null;
let status="spiel";
let joinTime = Date.now();

let sessionId=null;
let rolle="master";
let qrModus = null; // "counter" oder "viewer"
let qrScreenAktiv = false;

let spielZeit = 600; // Standard: 10 Minuten

/* ---------- SESSION ---------- */
function erstelleSession(){

    // 🔥 Alte Session sauber zurücksetzen
    if(liveRef){
        liveRef.off();
        liveRef = null;
    }

    if(timerInterval){
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if(!teamA || !teamB){
        alert("Bitte zuerst Spieltag starten");
        return;
    }

    // Neue Session ID
    sessionId = Math.random().toString(36).substring(2,8);

    // 🔥 Session in Firebase erstellen
    db.ref("sessions/"+sessionId).set({
        spiele: spiele,
        teamA: teamA,
        teamB: teamB,
        aktuellesSpiel: aktuellesSpiel,
        gestarteteSpiele: gestarteteSpiele,
        status: "spiel",
        spielZeit: spielZeit
    });

    speichern();

    // Listener starten
    starteLiveListener();
    starteTimerListener();

    // QR anzeigen
    zeigeQRStartseite();

    alert("Live-Session gestartet: "+sessionId);
}
let liveRef = null;

function zeigeQRStartseite(){
    qrScreenAktiv = true;

    // Nur Master darf QR sehen
    if(rolle && rolle !== "master"){
        ladeSpiel();
        return;
    }

    let url = location.origin + location.pathname + "?session=" + sessionId;

    document.body.innerHTML = `
        <h1>Counter verbinden</h1>
        <div id="qrcode"></div>
        <br>
        <button onclick="qrScreenAktiv=false; ladeSpiel()">Weiter zum Spiel</button>
    `;

    new QRCode(document.getElementById("qrcode"), url);
}

function starteLiveListener(){

    if(!sessionId) return;

    if(liveRef){
        liveRef.off();   // alten Listener komplett entfernen
        liveRef = null;
    }

    liveRef = db.ref("sessions/"+sessionId);

    liveRef.on("value", (snapshot)=>{

        let data = snapshot.val();
        if(data.spielZeit) spielZeit = data.spielZeit;

        if(!data){
            
            document.body.innerHTML = `
            <h2>Session beendet</h2>
            <p>Bitte neuen QR-Code scannen.</p>
            `;

            if(liveRef){
            liveRef.off();
            liveRef = null;
          }

           sessionId = null;
           localStorage.clear();
           return;
         }
          if(data.status === "ergebnis"){
           zeigeErgebnis();
           return;
         }
          if(data.teamA) teamA = data.teamA;
          if(data.teamB) teamB = data.teamB;

          if(data.spiele) spiele = data.spiele;
          if(data.aktuellesSpiel !== undefined) aktuellesSpiel = data.aktuellesSpiel;
          if(data.gestarteteSpiele) gestarteteSpiele = data.gestarteteSpiele;

          if(data.status === "ergebnis"){
          zeigeErgebnis();
          return;
        }

        ladeSpiel();
    });
}

function starteTimerListener(){

    if(!sessionId) return;

    db.ref("sessions/"+sessionId+"/timer").on("value",(snap)=>{

        let data = snap.val();
        if(!data) return;

        // altes Interval stoppen
        if(timerInterval){
            clearInterval(timerInterval);
            timerInterval = null;
        }

        // Zeit setzen
        timer = data.value || 0;

        let el = document.getElementById("zeit");
        if(el){
            el.innerText = formatZeit(timer);

            if(spielZeit - timer <= 30){
                el.style.color = (timer%2===0) ? "red" : "black";
            } else {
                el.style.color = "black";
            }
        }

        // Wenn Timer läuft
        if(data.running){

            timerInterval = setInterval(()=>{

                if(data.start){
                timer = (data.value || spielZeit) - Math.floor((Date.now() - data.start)/1000);
                } else {
                timer = data.value || spielZeit;
                }

                let el = document.getElementById("zeit");
                if(el){
                    el.innerText = formatZeit(timer);

                    if(timer <= 60){
                        el.style.color = (timer%2===0) ? "red" : "black";
                    } else {
                        el.style.color = "black";
                    }
                }

            },1000);

        }

        // 🔥 WICHTIG: End-Signal hier global auslösen
        if(!data.running && timer <= 0){

            signalTonAbspielen();
            if(navigator.vibrate){
                navigator.vibrate([300,200,300]);
            }
        }

    });
}

function registriereGeraet(){

    if(!sessionId) return;

    const deviceId = localStorage.getItem("deviceId") 
        || Math.random().toString(36).substring(2,9);

    localStorage.setItem("deviceId", deviceId);

    const ref = db.ref("sessions/"+sessionId+"/devices/"+deviceId);

    ref.set({
        rolle: rolle,
        lastSeen: Date.now()
    });

    ref.onDisconnect().remove();
}
function pruefeSessionJoin(){

    const params = new URLSearchParams(window.location.search);
    const joinSession = params.get("session");
    const roleParam = params.get("role");

    if(joinSession){

        sessionId = joinSession;
        rolle = roleParam === "viewer" ? "viewer" : "counter";
        joinTime = Date.now();

        // URL Parameter entfernen (wichtig!)
        window.history.replaceState({}, document.title, window.location.pathname);

        speichern();

        registriereGeraet();
        starteTimerListener();
        starteLiveListener();

        document.body.innerHTML = "<h2>Verbunden... Lade Spiel...</h2>";
    }
}
function nurMaster(){

    if(rolle !== "master"){
        alert("Nur Mastergerät darf diese Aktion ausführen");
        return false;
    }
    return true;
}
function zeigeQRCode(){

    let qrModus = null;

function toggleQR(modus){

    if(!sessionId){
        alert("Erst Live-Session starten");
        return;
    }

    let bestehend = document.getElementById("qrContainer");

    // Toggle aus
    if(bestehend){
        bestehend.remove();
        qrModus = null;
        return;
    }

    qrModus = modus;

    let url = location.origin + location.pathname + "?session=" + sessionId;

    if(modus === "viewer"){
        url += "&role=viewer";
    }

    let div = document.createElement("div");
    div.id = "qrContainer";
    div.style.marginTop = "20px";

    document.body.appendChild(div);

    new QRCode(div, url);
}

    if(!sessionId){
        alert("Erst Live-Session starten");
        return;
    }

    let url = location.origin + location.pathname + "?session=" + sessionId;

    let qrDiv = document.getElementById("qrcode");
    if(!qrDiv){
        qrDiv=document.createElement("div");
        qrDiv.id="qrcode";
        document.body.appendChild(qrDiv);
    }else{
        qrDiv.innerHTML="";
    }

    new QRCode(qrDiv,url);
}

/* ---------- SIGNAL ---------- */
function signalTonAbspielen(){
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.4);
}

/* ---------- ZEITFORMAT ---------- */
function formatZeit(s){

    s = Math.max(0, s);   // 🔥 DAS HIER IST DER FIX

    let m=Math.floor(s/60);
    let sec=s%60;
    return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
}

/* ---------- SPEICHERN ---------- */
function speichern(){
localStorage.setItem("spieltagApp",
JSON.stringify({modus,teamA,teamB,aktuellesSpiel,spiele,gestarteteSpiele,status,sessionId,rolle,joinTime}));
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
sessionId=d.sessionId||null;
rolle=d.rolle||"master";
joinTime = d.joinTime || Date.now();
return true;
}

/* ---------- PAARUNGEN ---------- */
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

/* ---------- ZWISCHENSTAND ---------- */
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

/* ---------- SETUP ---------- */
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

<label>Spielzeit (in Minuten):</label>
<br>
<input id="spielZeitInput" type="number" value="10">

<br><br>

<button onclick="zeigeModusAuswahl()">Zurück</button>
<button onclick="startSpieltag()">Start</button>`;
}

function startSpieltag(){

    teamA=document.getElementById("teamA").value;
    teamB=document.getElementById("teamB").value;

    let zeitInput = document.getElementById("spielZeitInput");

    let minuten = 10;
    if(zeitInput){
    minuten = parseInt(zeitInput.value) || 10;
}

spielZeit = minuten * 60;

    spiele=[];
    gestarteteSpiele=[false,false,false];
    aktuellesSpiel=1;

    for(let i=0;i<3;i++){
        spiele.push(modus==="single"
            ? {felder:[{a:0,b:0}]}
            : {felder:[{a:0,b:0},{a:0,b:0}]});
    }

    speichern();
    erstelleSession();         
}
/*-----------Neu------*/
function setTestZeit(){

    if(!nurMaster()) return;

    spielZeit = 10;

    if(sessionId){
        db.ref("sessions/"+sessionId).update({
            spielZeit: spielZeit
        });
    }

    alert("Testzeit: 10 Sekunden aktiviert");
}

/* ---------- SPIEL ---------- */
function ladeSpiel(){

let paarungen=getPaarungen();
let z=berechneZwischenstand();
let hinweis = "";
let viewerInfo = "";

if(rolle === "viewer"){
    viewerInfo = `<div style="background:#eee;padding:10px;margin:10px;">👀 Zuschauer-Modus</div>`;
}

if(aktuellesSpiel === 3 && modus === "twin"){
    hinweis = `
        <div style="
            background:#ffeeba;
            padding:12px;
            margin:10px 0;
            font-weight:bold;
            border-radius:8px;
        ">
            ⚠️ Vor Spielbeginn 2–4 Spieler tauschen!
        </div>
    `;
}
let html=`
<h1>Spiel ${aktuellesSpiel}</h1>
${viewerInfo}

<div style="background:#e3f2fd;padding:10px;font-weight:bold;">
Zwischenstand: ${teamA} ${z.pa} : ${z.pb} ${teamB}
</div>

${rolle==="master" ? `
<div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin:10px;">
    
    <div style="display:flex;gap:8px;">
        <button onclick="startTimer()">Start</button>
        <button onclick="pauseTimer()">Pause</button>
        <button onclick="resetTimer()">Reset</button>
    </div>

    <button style="font-size:18px;padding:8px 14px;" onclick="setTestZeit()">10s Test</button>

</div>
` : ``}

<h2 id="zeit" style="text-align:center;">${formatZeit(timer)}</h2>
<hr>
`;

spiele[aktuellesSpiel-1].felder.forEach((f,i)=>{
html+=`
<div style="border:1px solid #ccc;padding:12px;margin:10px;">
<h3>Feld ${i+1}</h3>

<div style="font-size:22px;text-align:center;font-weight:bold;">
${paarungen[i].a} --- ${f.a} | ${f.b} --- ${paarungen[i].b}
</div>


${rolle !== "viewer" ? `
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
` : ``}
</div>`;
});

html+=`
${rolle==="master" ? `
    <button onclick="vorherigesSpiel()">Zurück</button>
    <button onclick="naechstesSpiel()">Weiter</button>
    <button onclick="toggleQR('counter')">QR Counter</button>
    <button onclick="toggleQR('viewer')">QR Zuschauer</button>
    <button onclick="zeigeDashboard()">Dashboard</button>
` : ``}
`;
document.body.innerHTML=html;
}

/* ---------- TORE ---------- */
function updateLiveSpiele(){

    if(sessionId && navigator.onLine){

        db.ref("sessions/"+sessionId).update({
            spiele: spiele
        });
    }
}

function plusA(i){
    if(!timerInterval && rolle !== "master") return;

    spiele[aktuellesSpiel-1].felder[i].a++;
    speichern();
    updateLiveSpiele();
}

function minusA(i){
    if(!timerInterval && rolle !== "master") return;

    if(spiele[aktuellesSpiel-1].felder[i].a>0)
        spiele[aktuellesSpiel-1].felder[i].a--;
    speichern();
    updateLiveSpiele();
}

function plusB(i){
    if(!timerInterval && rolle !== "master") return;

    spiele[aktuellesSpiel-1].felder[i].b++;
    speichern();
    updateLiveSpiele();
}

function minusB(i){
    if(!timerInterval && rolle !== "master") return;

    if(spiele[aktuellesSpiel-1].felder[i].b>0)
        spiele[aktuellesSpiel-1].felder[i].b--;
    speichern();
    updateLiveSpiele();
}

/* ---------- TIMER ---------- */
function startTimer(){

    if(!nurMaster()) return;
     if(timer <= 0 || timer > spielZeit){
        timer = spielZeit;
    }

    gestarteteSpiele[aktuellesSpiel-1]=true;

    if(sessionId){
        db.ref("sessions/"+sessionId).update({
            gestarteteSpiele: gestarteteSpiele
        });

        db.ref("sessions/"+sessionId+"/timer").set({
            start: Date.now(),
            running: true,
            value: timer
        });
    }

    clearInterval(timerInterval);

    timerInterval=setInterval(()=>{

        timer--;

        let el=document.getElementById("zeit");
        if(el){
            el.innerText=formatZeit(timer);

            if(timer <= 30){
                el.style.color=(timer%2===0)?"red":"black";
            }else{
                el.style.color="black";
            }
        }

        if(timer<=0){

    clearInterval(timerInterval);
    timerInterval=null;

    if(sessionId){
        db.ref("sessions/"+sessionId+"/timer").update({
            running:false,
            value: timer
        });
    }

    signalTonAbspielen();
    if(navigator.vibrate) navigator.vibrate([300,200,300]);
}

    },1000);
}

function pauseTimer(){

    if(!nurMaster()) return;

    clearInterval(timerInterval);
    timerInterval=null;

    if(sessionId){
        db.ref("sessions/"+sessionId+"/timer").update({
            running:false,
            value: timer
        });
    }
}
function resetTimer(){

    if(!nurMaster()) return;

    clearInterval(timerInterval);
    timerInterval=null;
    timer = spielZeit;
    if(sessionId){
    db.ref("sessions/"+sessionId+"/timer").set({
        start: Date.now(),
        running: false,
        value: 0
    });
}
    ladeSpiel();
}

/* ---------- NAV ---------- */
function vorherigesSpiel(){
    if(!nurMaster()) return;

    if(aktuellesSpiel>1){
        aktuellesSpiel--;
        timer=0;

        if(sessionId){
            db.ref("sessions/"+sessionId).update({
                aktuellesSpiel: aktuellesSpiel
            });
        }

        ladeSpiel();
    }else{
        zeigeTeamEingabe();
    }
}

function naechstesSpiel(){

    if(!nurMaster()) return;

    timer = 0;
    clearInterval(timerInterval);
    timerInterval = null;

    if(aktuellesSpiel < 3){

        aktuellesSpiel++;

        if(sessionId){
            db.ref("sessions/"+sessionId).update({
                aktuellesSpiel: aktuellesSpiel
            });
        }

        ladeSpiel();

    } else {

        if(sessionId){
            db.ref("sessions/"+sessionId).update({
                status: "ergebnis"
            });
        }

        zeigeErgebnis();
    }
}

/* ---------- ERGEBNIS ---------- */
function zeigeErgebnis(){

    status = "ergebnis";
    speichern();

    if(sessionId && rolle === "master"){
        db.ref("sessions/"+sessionId).update({
            status: "ergebnis"
        });
    }

    if(timerInterval){
        clearInterval(timerInterval);
        timerInterval = null;
    }

    let pa=0,pb=0;
    spiele.forEach(s=>s.felder.forEach(f=>{
        if(f.a>f.b) pa++;
        else if(f.b>f.a) pb++;
        else {pa++;pb++;}
    }));

    document.body.innerHTML = `
        <h1>Ergebnis</h1>

        <h2>${teamA}: ${pa}</h2>
        <h2>${teamB}: ${pb}</h2>

        <br>

        ${rolle==="master" ? `
            <button onclick="exportierePDF()">PDF</button>
            <button onclick="springeZuSpiel(3)">Zurück zu Spiel 3</button>
            <button onclick="neuerSpieltag()">Neuer Spieltag</button>
            <button onclick="beendeSession()">Spiel beendet – Verbindungen trennen</button>
        ` : `
            <div style="margin-top:20px;font-weight:bold;">
                Spiel beendet – Bitte auf Master warten
            </div>
        `}
    `;
}
async function exportierePDF(){
const { jsPDF } = window.jspdf;
const canvas = await html2canvas(document.body);
const img = canvas.toDataURL("image/png");
const pdf=new jsPDF();
pdf.addImage(img,"PNG",0,0);
pdf.save("spieltag.pdf");
}

function neuerSpieltag(){

    if(sessionId && rolle==="master"){
        db.ref("sessions/"+sessionId).remove();
    }

    if(liveRef){
        liveRef.off();
        liveRef = null;
    }

    clearInterval(timerInterval);
    timerInterval=null;

    localStorage.clear();

    sessionId=null;
    rolle="master";
    qrScreenAktiv=false;
    status="spiel";

    window.history.replaceState({}, document.title, window.location.pathname);

    location.reload();
}
function beendeSession(){

    if(!nurMaster()) return;

    if(sessionId){
        db.ref("sessions/"+sessionId).remove();
    }

    // ALLES zurücksetzen
    if(liveRef){
        liveRef.off();
        liveRef = null;
    }

    clearInterval(timerInterval);
    timerInterval = null;

    sessionId = null;
    rolle = "master";
    qrScreenAktiv = false;
    status = "spiel";

    localStorage.removeItem("spieltagApp");

    alert("Session beendet");

    location.reload();   // 🔥 sauberer Neustart
}
function zeigeDashboard(){

    if(!nurMaster()) return;

    db.ref("sessions/"+sessionId+"/devices").on("value",(snap)=>{

        let data = snap.val() || {};
        let html = `<h3>Verbundene Geräte: ${Object.keys(data).length}</h3>`;

        Object.entries(data).forEach(([id,info])=>{
            html += `<div>${id} - ${info.rolle}</div>`;
        });

        let box = document.getElementById("dashboard");
        if(!box){
            box = document.createElement("div");
            box.id = "dashboard";
            document.body.appendChild(box);
        }

        box.innerHTML = html;
    });
}
function springeZuSpiel(n){aktuellesSpiel=n;ladeSpiel();}

/* ---------- ONLINE / OFFLINE ---------- */
window.addEventListener("online", ()=>{

    alert("Internet wieder verbunden – Synchronisiere Daten");

    if(sessionId){
        starteLiveListener();

        db.ref("sessions/"+sessionId).update({
            spiele: spiele,
            aktuellesSpiel: aktuellesSpiel,
            gestarteteSpiele: gestarteteSpiele
        });
    }

});

/* ---------- START ---------- */
window.onload=function(){
    pruefeSessionJoin();
     if(laden() && sessionId){
     if(sessionId){
        starteLiveListener();
        starteTimerListener();
    }
    if(Date.now() - joinTime > 3*60*60*1000){
    alert("Session abgelaufen");
    neuerSpieltag();
    return;
}
if(status==="ergebnis") zeigeErgebnis();
else ladeSpiel();
}else{
   zeigeModusAuswahl();
}
}