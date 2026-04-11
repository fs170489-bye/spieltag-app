let modus="";
let teamA="";
let teamB="";
let aktuellesSpiel=1;
let spiele=[];
let gestarteteSpiele=[false,false,false];
let timer=0;
let timerInterval=null;
let originalSpielZeit = 600;
let spielZeit = 600; // Standard: 10 Minuten
let status="spiel";
let joinTime = Date.now();
let sessionId=null;
let rolle="master";
let qrModus = null; // "counter" oder "viewer"
let qrScreenAktiv = false;
let counterGesperrt = false;
let counterGesperrtListe = {};
let deviceId = localStorage.getItem("deviceId") || null;
let wakeLock = null;
let keepAliveInterval = null;
let teamCache = [];

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
        spielZeit: spielZeit,
        counterGesperrt: false
    });
    db.ref("sessions/"+sessionId+"/timer").set({
    start: Date.now(),
    running: false,
    value: spielZeit
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

    if(!sessionId){
    alert("Keine Session aktiv");
    return;
}

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
        <button onclick="ladeSpiel()">Weiter zum Spiel</button>
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
        if(!data){
        return;
       }
        // 🔥 WENN ICH GEKICKT BIN → APP STOPPEN
       if(data && data.kicked && deviceId && data.kicked[deviceId]){

        alert("Du wurdest vom Spiel entfernt");

        sessionId = null;
        localStorage.clear();

       location.reload();
       return;
       }

        let viewerCount = 0;

       if(data && data.devices){

    let now = Date.now();

    viewerCount = Object.values(data.devices)
        .filter(d => 
            d.rolle === "viewer" &&
            (now - (d.lastSeen || 0)) < 25000 // 🔥 max 15 Sekunden alt
        ).length;
}
        window.viewerCount = viewerCount;

        if(data.spielZeit) spielZeit = data.spielZeit;

          if(data.status === "ergebnis"){
           zeigeErgebnis();
           return;
         }
          if(data.teamA) teamA = data.teamA;
          if(data.teamB) teamB = data.teamB;

          if(data.spiele) spiele = data.spiele;
          if(data.aktuellesSpiel !== undefined){

          if(aktuellesSpiel !== data.aktuellesSpiel){

          aktuellesSpiel = data.aktuellesSpiel;

          // 🔥 WICHTIG: Timer reset bei Spielwechsel
          timer = spielZeit;

         // 🔥 ganz wichtig: alte Anzeige killen
         if(timerInterval){
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }
}
          if(data.gestarteteSpiele) gestarteteSpiele = data.gestarteteSpiele;

         counterGesperrtListe = data.counterGesperrtListe || {};

        ladeSpiel();
    });
}

function starteTimerListener(){

    if(!sessionId) return;

    db.ref("sessions/"+sessionId+"/timer").on("value",(snap)=>{

        let data = snap.val();
         if(!data){
         return; // 🔥 Timer existiert noch nicht → völlig normal!
         }

        // 🔥 Schutz: wenn Spiel gewechselt wurde → Timer sauber setzen
        if(timer > spielZeit){
        timer = spielZeit;
        }

        // altes Interval stoppen
        if(timerInterval){
            clearInterval(timerInterval);
            timerInterval = null;
        }

        // Zeit setzen
        timer = data.value ?? spielZeit;

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
                timer = data.value - Math.floor((Date.now() - data.start)/1000);
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
        if(!data.running && timer <= 0 && rolle !== "viewer"){

            signalTonAbspielen();
            if(navigator.vibrate && rolle !== "viewer"){
                navigator.vibrate([300,200,300]);
            }
        }

    });
}

function registriereGeraet(){

    if(!sessionId) return;

    deviceId = localStorage.getItem("deviceId") 
        || Math.random().toString(36).substring(2,9);

    localStorage.setItem("deviceId", deviceId);

    const ref = db.ref("sessions/"+sessionId+"/devices/"+deviceId);

    ref.set({
        rolle: rolle,
        lastSeen: Date.now()
    });

    // 🔥 KEEP ALIVE (ALLE 10 SEKUNDEN)
    if(keepAliveInterval) clearInterval(keepAliveInterval);

    keepAliveInterval = setInterval(()=>{
    ref.update({
        lastSeen: Date.now()
    });
    }, 10000);
 
    ref.onDisconnect().remove();
 }
function pruefeSessionJoin(){

    const params = new URLSearchParams(window.location.search);
    const joinSession = params.get("session");
    const roleParam = params.get("role");

    if(joinSession){

    db.ref("sessions/"+joinSession+"/devices").once("value").then(snap=>{

    let data = snap.val() || {};

    let viewerCount = Object.values(data)
        .filter(d => d.rolle === "viewer").length;

  if(viewerCount >= 50){
    alert("Maximale Zuschauer erreicht");
    throw new Error("Limit erreicht"); // 🔥 STOPPT ALLES
}

    // ✅ NUR WENN OK → JOIN STARTEN
    sessionId = joinSession;
    rolle = roleParam === "viewer" ? "viewer" : "counter";
    joinTime = Date.now();

    window.history.replaceState({}, document.title, window.location.pathname);

    speichern();

    registriereGeraet();
    starteTimerListener();
    starteLiveListener();

    setTimeout(()=>{
        starteLiveListener();
        starteTimerListener();
        ladeSpiel();
    }, 500);

    document.body.innerHTML = "<h2>Verbunden... Lade Spiel...</h2>";
    });
 }
}
function nurMaster(){

    if(rolle !== "master"){
        alert("Nur Mastergerät darf diese Aktion ausführen");
        return false;
    }
    return true;
}

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

    div.style.textAlign = "center";
    document.body.appendChild(div);

    new QRCode(div, url);
    let info = document.createElement("div");
    info.innerText = modus === "viewer"
    ? "Zuschauer einladen"
    : "Counter verbinden";

    info.style.marginTop = "10px";
    div.appendChild(info);
}

/* ---------- SIGNAL ---------- */
function signalTonAbspielen(){
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.4);
}

async function keepScreenOn(){
    try{
        wakeLock = await navigator.wakeLock.request('screen');

        wakeLock.addEventListener('release', () => {
            console.log("WakeLock verloren → neu anfordern");
            keepScreenOn();
        });

    }catch(e){
        console.log("WakeLock nicht verfügbar");
    }
}

/* ---------- ZEITFORMAT ---------- */
function formatZeit(s){

    s = Math.max(0, s);   // 🔥 DAS HIER IST DER FIX

    let m=Math.floor(s/60);
    let sec=s%60;
    return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
}

function splitTeamName(name){

    if(name.length <= 12){
        return {
            top: name,
            bottom: ""
        };
    }

    return {
        top: name.substring(0,12),
        bottom: name.substring(12)
    };
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

let lastA = localStorage.getItem("lastTeamA") || "";
let lastB = localStorage.getItem("lastTeamB") || "";

document.body.innerHTML=`
<h1>Teams</h1>

<input id="teamA" value="${lastA}" placeholder="Team A" oninput="zeigeVorschlaege(this, 'A')">
<div id="suggestA"></div>

<input id="teamB" value="${lastB}" placeholder="Team B" oninput="zeigeVorschlaege(this, 'B')">
<div id="suggestB"></div>

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

    localStorage.setItem("lastTeamA", teamA);
    localStorage.setItem("lastTeamB", teamB);

    // 🔥 TEAMLISTE GLOBAL SPEICHERN
    db.ref("teams").once("value").then(snap=>{

    let list = snap.val() || [];

    if(teamA && !list.includes(teamA)) list.push(teamA);
    if(teamB && !list.includes(teamB)) list.push(teamB);

    db.ref("teams").set(list);
});

    // 🔥 TEAMLISTE SPEICHERN (NEU)
   let teams = JSON.parse(localStorage.getItem("teamListe") || "[]");

   if(teamA && !teams.includes(teamA)) teams.push(teamA);
   if(teamB && !teams.includes(teamB)) teams.push(teamB);

   localStorage.setItem("teamListe", JSON.stringify(teams));

    let zeitInput = document.getElementById("spielZeitInput");

    let minuten = 10;
    if(zeitInput){
    minuten = parseInt(zeitInput.value) || 10;
}
     spielZeit = minuten * 60;
     originalSpielZeit = spielZeit; // 🔥 NACH setzen!

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
    keepScreenOn();   // 🔥 HIER  
   
}
/*-----------Neu------*/
function setTestZeit(){

    if(!nurMaster()) return;

    if(spielZeit === 10){
        spielZeit = originalSpielZeit;
        alert("Normale Zeit aktiv");
    } else {
        spielZeit = 10;
        alert("Testzeit aktiv");
    }

    if(sessionId){
        db.ref("sessions/"+sessionId).update({
            spielZeit: spielZeit
        });

        // 🔥 TIMER RESET (WICHTIG!)
        db.ref("sessions/"+sessionId+"/timer").set({
            start: Date.now(),
            running: false,
            value: spielZeit
        });
    }
}

/* ---------- SPIEL ---------- */
function ladeSpiel(){
    document.body.style.fontFamily = "system-ui";
    document.body.style.background = "#f5f5f5";

let paarungen=getPaarungen();
let z=berechneZwischenstand();
let hinweis = "";
let viewerInfo = "";

if(modus === "twin" && aktuellesSpiel === 3){
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

if(rolle === "viewer"){
    viewerInfo = `<div style="background:#eee;padding:10px;margin:10px;">👀 Zuschauer-Modus</div>`;
} else if(counterGesperrtListe && counterGesperrtListe["ALL"] && rolle === "counter"){
    viewerInfo = `<div style="background:#ffcccc;padding:10px;margin:10px;">🔒 Counter gesperrt</div>`;
}

let html=`
<h1>Spiel ${aktuellesSpiel}</h1>
${viewerInfo}
${hinweis}

${rolle==="master" ? `
<div style="text-align:right;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;">

    <button onclick="setTestZeit()" style="font-size:12px;padding:4px 6px;">
        10s
    </button>

    <button onclick="resetTimer()" style="font-size:12px;padding:4px 6px;">
        Reset
    </button>

</div>
` : ``}

<div style="
    background:white;
    border-radius:14px;
    padding:14px;
    margin:10px 0;
    box-shadow:0 2px 8px rgba(0,0,0,0.1);
">

<div style="font-size:12px;color:#666;margin-bottom:6px;">
    Spiel ${aktuellesSpiel} – Tendenzwertung
</div>

<div style="font-weight:bold;">

    <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
    ">

        <!-- LINKS -->
        <div style="
            flex:1;
            text-align:left;
            word-break:break-word;
        ">
            ${teamA}
        </div>

        <!-- SCORE -->
        <div style="
            width:30px;
            text-align:center;
        ">
            ${z.pa}
        </div>

    </div>

    <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin-top:4px;
    ">

        <!-- LINKS -->
        <div style="
            flex:1;
            text-align:left;
            word-break:break-word;
        ">
            ${teamB}
        </div>

        <!-- SCORE -->
        <div style="
            width:30px;
            text-align:center;
        ">
            ${z.pb}
        </div>

    </div>

</div>

${rolle==="master" ? `
<div style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin:10px 0;
">

    <button onclick="toggleTimer()" id="timerBtnMain" style="flex:1;">
        Start
    </button>

    <div id="zeit" style="font-size:26px;font-weight:bold;text-align:center;flex:1;">
        ${formatZeit(timer)}
    </div>

    <div style="font-weight:bold;flex:1;text-align:right;">
        👀 ${(window.viewerCount ?? 0)}
    </div>

</div>
` : `
<div style="
    display:flex;
    justify-content:center;
    margin:10px 0;
">

    <div id="zeit" style="font-size:26px;font-weight:bold;">
        ${formatZeit(timer)}
    </div>

</div>
`}
`;

spiele[aktuellesSpiel-1].felder.forEach((f,i)=>{

html+=`
<div style="
    background:white;
    border-radius:12px;
    padding:12px;
    margin:10px 0;
    box-shadow:0 2px 6px rgba(0,0,0,0.1);
">

<h3>Feld ${i+1}</h3>

<div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin:10px 0;
">

    <div style="flex:1;text-align:left;font-weight:bold;">
        ${paarungen[i].a}
    </div>

    <div style="min-width:70px;text-align:center;font-size:24px;font-weight:bold;">
        ${f.a} : ${f.b}
    </div>

    <div style="flex:1;text-align:right;font-weight:bold;">
        ${paarungen[i].b}
    </div>

</div>

${rolle !== "viewer" && deviceId && !(counterGesperrtListe?.[deviceId]) ? `
<div style="display:flex;justify-content:space-between;margin-top:10px;">

    <div style="display:flex;gap:6px;">
        <button style="background:red;color:white;padding:8px;" onclick="minusA(${i})">-</button>
        <button style="background:green;color:white;padding:14px 18px;font-size:22px;" onclick="plusA(${i})">+</button>
    </div>

    <div style="display:flex;gap:6px;">
        <button style="background:green;color:white;padding:14px 18px;font-size:22px;" onclick="plusB(${i})">+</button>
        <button style="background:red;color:white;padding:8px;" onclick="minusB(${i})">-</button>
    </div>

</div>
` : ``}

</div>
`;
});

html+=`
${rolle==="master" ? `
    <button onclick="vorherigesSpiel()">Zurück</button>
    <button onclick="naechstesSpiel()">Weiter</button>
    <button onclick="toggleQR('counter')">QR Counter</button>
    <button onclick="toggleQR('viewer')">QR Zuschauer</button>
    <button onclick="zeigeDashboard()">Dashboard</button>
    <button onclick="toggleCounterSperre()">
        ${counterGesperrtListe && counterGesperrtListe["ALL"] 
            ? "Counter freigeben" 
            : "Counter sperren"}
    </button>
` : (rolle==="viewer" ? `
    <button onclick="toggleQR('viewer')">Zuschauer teilen</button>
` : ``)}
`;

document.body.innerHTML = html;
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
    // 🔒 Counter gesperrt?
    if(counterGesperrtListe && counterGesperrtListe["ALL"] && rolle === "counter") return;
    if(!timerInterval && rolle !== "master") return;

    spiele[aktuellesSpiel-1].felder[i].a++;
    speichern();
    updateLiveSpiele();
}

function minusA(i){
    // 🔒 Counter gesperrt?
    if(counterGesperrtListe && counterGesperrtListe["ALL"] && rolle === "counter") return;
    if(!timerInterval && rolle !== "master") return;

    if(spiele[aktuellesSpiel-1].felder[i].a>0)
        spiele[aktuellesSpiel-1].felder[i].a--;
    speichern();
    updateLiveSpiele();
}

function plusB(i){
    // 🔒 Counter gesperrt?
    if(counterGesperrtListe && counterGesperrtListe["ALL"] && rolle === "counter") return;
    if(!timerInterval && rolle !== "master") return;

    spiele[aktuellesSpiel-1].felder[i].b++;
    speichern();
    updateLiveSpiele();
}

function minusB(i){
    // 🔒 Counter gesperrt?
    if(counterGesperrtListe && counterGesperrtListe["ALL"] && rolle === "counter") return;
    if(!timerInterval && rolle !== "master") return;

    if(spiele[aktuellesSpiel-1].felder[i].b>0)
        spiele[aktuellesSpiel-1].felder[i].b--;
    speichern();
    updateLiveSpiele();
}

function toggleTimer(){

    if(!nurMaster()) return;

    let running = timerInterval !== null;

    if(running){
        pauseTimer();
        let btn = document.getElementById("timerBtnMain");
        if(btn) btn.innerText = "Start";
    } else {
        startTimer();
        let btn = document.getElementById("timerBtnMain");
        if(btn) btn.innerText = "Pause";
    }
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

            if(timer <= 60 && timer > 0){
             el.style.color = (timer%2===0) ? "red" : "black";
              } else if(timer <= 0){
               el.style.color = "red";
             } else {
             el.style.color = "black";
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

        let el=document.getElementById("zeit");
       if(el){
        el.style.color = "red";
        el.style.fontSize = "32px"; // 🔥 BONUS HIER
       }

        signalTonAbspielen();
        if(navigator.vibrate && rolle !== "viewer"){
        navigator.vibrate([300,200,300]);
     }
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
        value: spielZeit
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

    timer = spielZeit;
    clearInterval(timerInterval);
    timerInterval = null;

        // 🔥 NEU: Timer global resetten
    if(sessionId){
        db.ref("sessions/"+sessionId+"/timer").set({
            start: Date.now(),
            running: false,
            value: spielZeit
        });
    }

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

    if(window.dashboardRef){
        window.dashboardRef.off(); // 🔥 WICHTIG
    }

    window.dashboardRef = db.ref("sessions/"+sessionId+"/devices");

    window.dashboardRef.on("value",(snap)=>{

        let data = snap.val() || {};
        let html = `<h3>Counter Geräte</h3>`;

        Object.entries(data).forEach(([id,info])=>{

            if(info.rolle === "counter" && (Date.now() - (info.lastSeen || 0)) < 25000){

                html += `
                <div style="margin:5px 0;">
                    ${id}
                    <button onclick="kickCounter('${id}')">❌</button>
                </div>
                `;
            }
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

function kickCounter(id){

    if(!nurMaster()) return;

    if(sessionId){

        // 🔥 Gerät als gekickt markieren
        db.ref("sessions/"+sessionId+"/kicked/"+id).set(true);

        // optional aus Liste entfernen
        db.ref("sessions/"+sessionId+"/devices/"+id).remove();
    }
}

function toggleCounterSperre(){

    if(!nurMaster()) return;

    let gesperrt = counterGesperrtListe && counterGesperrtListe["ALL"];

    if(gesperrt){

        // 🔓 ENTSPERREN
        counterGesperrtListe = {};

        if(sessionId){
            db.ref("sessions/"+sessionId+"/counterGesperrtListe").remove();
        }

    } else {

        // 🔒 SPERREN
        counterGesperrtListe = {"ALL": true};

        if(sessionId){
            db.ref("sessions/"+sessionId).update({
                counterGesperrtListe: counterGesperrtListe
            });
        }
    }

    ladeSpiel(); // UI sofort aktualisieren
}

function springeZuSpiel(n){

    aktuellesSpiel = n;
    status = "spiel";

    if(sessionId){
        db.ref("sessions/"+sessionId).update({
            status: "spiel"
        });
    }

    ladeSpiel();
}

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

// 🔥 APP KOMMT AUS STANDBY ZURÜCK
document.addEventListener("visibilitychange", () => {

    if(document.visibilityState === "visible"){

        console.log("Resync + Rejoin...");

        if(sessionId){

            registriereGeraet();   // 🔥 DAS IST DER FIX

            starteLiveListener();
            starteTimerListener();

            ladeSpiel();           // 🔥 GANZ WICHTIG
        }
    }
});

// 🔥 HIER UNTEN EINFÜGEN
window.addEventListener("focus", () => {
    if(sessionId){
        registriereGeraet();   // 🔥 auch hier
        starteLiveListener();
        starteTimerListener();
    }
});

// 🔥 AUTOCOMPLETE FUNKTION
function zeigeVorschlaege(input, typ){

    let wert = input.value.toLowerCase();
    let box = document.getElementById("suggest"+typ);

    if(!wert){
        box.innerHTML = "";
        return;
    }

    db.ref("teams").once("value").then(snap=>{

        let teams = snap.val() || [];

        let gefiltert = teams.filter(t => 
            t.toLowerCase().includes(wert)
        );

        box.innerHTML = gefiltert.map(t => `
            <div style="
                padding:5px;
                border-bottom:1px solid #ccc;
                cursor:pointer;
            " onclick="waehleTeam('${t}', '${typ}')">
                ${t}
            </div>
        `).join("");
    });
}

// 🔥 AUSWAHL FUNKTION
function waehleTeam(name, typ){

    let input = document.getElementById("team"+typ);
    let box = document.getElementById("suggest"+typ);

    input.value = name;
    box.innerHTML = "";
}