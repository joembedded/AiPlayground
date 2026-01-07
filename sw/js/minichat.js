/* minichat.js - Minichat 
*
* Ziemlich vollständiges Fragment für ein Mini-Chatsystem mit Voice STT/TTS
* Hinweis: Die beiden Zustandsmaschinen sind numerisch codiert. 
* Das ist nicht unbedingt üblich, Aber für kleine Systeme ok.
* 
* Zum Debuggen dbgLevel auf 1 od. 2 setzen oder via '.debug N' Befehl
*/

//--------- globals ------ 
export const VERSION = 'V0.01 / 07.01.2026';
export const COPYRIGHT = '(C)JoEmbedded.de';
export let dbgLevel = 0;

// Session Credentials
export let apiSessionId = null; // 32 Zeichen SessionID
export let apiUser = null; // z.B. 'testuser'

export let userLanguage = null; // de-DE
export let speakVoice = null; // z.B 'narrator_f_jane'; 
export let isLoggedIn = false; // true wenn eingeloggt

// -------- ENDE globals ------

//=== MODMinitools ===
// Terminal-Emulation, braucht ein DIV mit class="terminal"
const TERMINAL_LINES = 25; // Default
let terminal_lines = TERMINAL_LINES; // Real, kann live angepasst werden
const terminalContent = ["'*** Terminal ***'"];
const terminalEl = document.getElementById('dbgTerminal');

export function terminalPrint(txt = '\u2424') { // NL-Symbol
    terminalContent.push(txt);
    while (terminalContent.length > terminal_lines) terminalContent.shift();
    terminalEl.innerText = terminalContent.join('\n');
    terminalEl.scrollTop = terminalEl.scrollHeight;
}
// TextContent direkt setzen
const dbgInfo = document.getElementById('dbginfo');
const dbgAudioStatus = document.getElementById('audioStatus');

// Ping-Helper- Erzeugt Kurze Pings 440Hz: Grundton A
const acx = new AudioContext();
export function frq_ping(frq = 440, dura = 0.2, vol = 0.07) {
    if (!acx) return;
    const oscillator = acx.createOscillator()
    oscillator.frequency.value = frq
    const volume = acx.createGain()
    volume.gain.value = vol // Damit Startet
    volume.gain.exponentialRampToValueAtTime(vol / 5, acx.currentTime + dura) // Ziel nach duration
    oscillator.connect(volume)
    volume.connect(acx.destination)
    oscillator.type = 'square'
    oscillator.start()
    oscillator.stop(acx.currentTime + dura) // 1 sec Duration
}

// Nuetzliches sleep in async functions
export async function jsSleepMs(ms = 1) {
    let np = new Promise(resolve => setTimeout(resolve, ms))
    return np
}
//=== ENDE MODMinitools ===

// === MODMainChat - START===
let helpTxts = [
    '(noHelp)'
];
let hlpIdx = 0;

let theNewMessage = null;   // Letzee/pending Message
async function sendeNachricht() {
    sendenBtnGlyph.classList.add('spinner');
    if (chatStateVar >= 4) {
        if (dbgLevel) terminalPrint('sendeNachricht: Abbruch, chatStateVar=' + chatStateVar);
        chatStateVar = 9; // Alles Abbrechen
        return; // Bereits senden in Arbeit, abbrechen
    }
    let text = textEingabe.value.trim();
    if (text.length === 0) {
        //text ='\u2424'; // NL-Symbol
        const help = helpTxts[hlpIdx];
        if (helpTxts.length) hlpIdx = (hlpIdx + 1) % helpTxts.length;
        addMessage(help, 'bot info');
        chatStateVar = 5; // Warte auf sendeNachricht
        speakText(help);
        // Keine Eingabe-Keine Zeile
        return;
    }
    // Systemkommandos
    if (text.startsWith('.debug')) {
        const debugValue = text.substring(6).trim();
        if (debugValue.length) dbgLevel = parseInt(debugValue);
        dbgDiv.hidden = !dbgLevel;
        chatStateVar = 5; // Warte auf sendeNachricht
        addMessage('.debug:' + dbgLevel, 'bot info');
        textEingabe.value = '';
        return;
    }

    addMessage(text, 'user'); // User-Meldung anzeigen
    theNewMessage = addMessage(' Warte...', 'bot spinner');
    chatStateVar = 4; // Warte auf Server-Antwort
    talkWithServer(text, theNewMessage); // async
    textEingabe.value = '';
}
// Background Monitor - alle ca. 100 msec
let chatStateVar = 0;     // 0: idle - darf extern mod. werden!
function periodical() {
    if (dbgLevel) dbgAudioStatus.textContent = `chatStateVar: ${chatStateVar} ${isLoggedIn ? '(logged in)' : '(not logged in)'}`;

    switch (chatStateVar) {
        case 0: // idle
            break;
        case 1: // Audio-Input im stdPlayer vorhanden - Start Transcribe!
            chatStateVar = 2;
            setChatStatus('Ich verstehe...', 'yellow');
            //frq_ping(1760, 0.1, 0.07); // Kurzer HPing
            postAudio();
            break;
        case 2: // idle warten waehrend transcribiert
            break;
        case 3: // 
            setChatStatus('Verstanden!', 'yellow');
            if (autoPostChk.checked) {
                sendeNachricht(); // impl setzt chatStateVar=4
            } else {
                chatStateVar = 10; // Gleich weiter
            }

            break;
        case 4: // Erwarte sendeNachricht - Antwort
            // todo
            break;

        case 5: // Erwarte sendeNachricht - Say 
            checkAndPlayAudio();
            break;

        case 9: // Alles Abbrechen während sendeNachricht
            setChatStatus('Stop...', 'orange');
            audioPlayer.pause();
            audioCache = [];
            chatStateVar = 10; // Gleich weiter
            isLoading = false;
            frq_ping(220, 0.1, 0.1);
            break;

        case 10: // **Erwarte sendeNachricht**
            setSendButtonGlyph('ready');
            setChatStatus('Hab alles gesagt', 'yellow');
            chatStateVar = 0; // Zuruecksetzen
            microStatus = 1; // Micro wieder bereit
            break;

        default:
            if (dbgLevel) terminalPrint('ERROR: chatStateVar:' + chatStateVar);
            setChatStatus('ERROR(internal):' + chatStateVar, 'red');
            chatStateVar = 0; // Zuruecksetzen
            microStatus = 1; // Micro wieder ggfs. bereit, falls vorhanden
            break;
    }
}
// === MODMainChat - END===

// === MODSay - START===

// Synthetisiert Saetze
let audioCache = [];
let isProcessing = false;
let isLoading = false;
let playAudioUrl = null;

// für GET <2000 Zeichen safe, <4000: 'okÄ, >4000 evtl. Probleme
const maxSentenceLength = 4000; // Maximale Satzlänge in Zeichen fuer die API
const splitShortSentencesFlag = false; // true

const audioPlayer = document.getElementById('audioPlayer');
// Abspielen sobald möglich
audioPlayer.oncanplay = function () {
    audioPlayer.play().catch(error => {
        if (dbgLevel) terminalPrint('ERROR(audioPlayerA): ' + error);
        setChatStatus('ERROR(audioPlayerA): ' + error, 'red');
        isLoading = false;
    });
}

// Alte URL freigeben wenn Audio beendet ist
audioPlayer.onended = function () {
    if (playAudioUrl) {
        URL.revokeObjectURL(playAudioUrl);
        playAudioUrl = null;
    }
    isLoading = false;
};
audioPlayer.onerror = function (error) {
    if (dbgLevel) terminalPrint('ERROR(audioPlayerB): ' + error);
    setChatStatus('ERROR(audioPlayerB): ' + error, 'red');
    isLoading = false;
}

// Prüfen und Audio abspielen
function checkAndPlayAudio() {
    // canplay feuert ab HAVE_FUTIRE_DATA
    const STATS = ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"];
    dbgAudioStatus.textContent = `State:${STATS[audioPlayer.readyState]} Paused:${audioPlayer.paused} Ended:${audioPlayer.ended} CacheLen:${audioCache.length}`;

    if (isLoading) return;
    // Wenn Audio-Element gerade spielt, warten
    if (!audioPlayer.paused && !audioPlayer.ended) {
        return;
    }
    // Wenn audioCache leer und Players Ready
    if (audioCache.length === 0) {
        if (audioPlayer.paused) chatStateVar = 10; // Fertig
        return;
    }

    // Nächstes Audio aus Cache holen und abspielen
    const audioBlob = audioCache.shift();
    playAudioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = playAudioUrl;
    audioPlayer.play().then(() => {
        if (dbgLevel) terminalPrint(`Play - verbleibende Dateien: ${audioCache.length}`);
    }).catch(err => {
        if (dbgLevel) terminalPrint('Fehler beim Abspielen: ' + err.message);
    });
};

// Text in Sätze zerlegen
function splitIntoSentences(text) {
    let currentSentence = '';
    const sentences = [];
    // Satz zur Liste hinzufügen mit Längenbegrenzung
    function addSentence(sentence) {
        sentence = sentence.trim();
        if (sentence.length > maxSentenceLength) { // Überlänge begrenzen
            sentence = sentence.substring(0, maxSentenceLength) + ' ...';
        }
        if (sentence.length > 0) sentences.push(sentence);
    }
    // Die eigentliche Zerlegung
    if (splitShortSentencesFlag) { // In kleine Saetze
        const END_CHARS = ['.', '!', '?', ':'];
        for (let i = 0; i < text.length; i++) {             // Sätze anhand von '.', '!', '?' oder ':' trennen
            currentSentence += text[i];
            if (END_CHARS.includes(text[i])) {
                addSentence(currentSentence.trim());
                currentSentence = '';
            }
        }
    } else { // in So viel wie möglich, aber Saetze
        const END_CHARS_PLUS = ['.', '!', '?', ':', ';', ',', ' '];
        while (text.length > maxSentenceLength) {
            let splitPos = -1;
            for (const char of END_CHARS_PLUS) {
                const pos = text.lastIndexOf(char, maxSentenceLength);
                if (pos > splitPos) {
                    splitPos = pos;
                    break;
                }
            }
            if (splitPos === -1) splitPos = maxSentenceLength; // Kein Satzende gefunden, harte Grenze
            let sentence = text.substring(0, splitPos + 1);
            addSentence(sentence.trim());
            text = text.substring(splitPos + 1).trim();
        }
    }
    // Restlichen Text hinzufügen, falls vorhanden
    addSentence(currentSentence.trim());
    if (text.length > 0) addSentence(text);
    return sentences;
}

// Audio für einen Satz abrufen 
// Fängt ggfs. SOFORT an zu spielen, wenn Player idle ist. Dazu Abküerzung vis <audio>.src verwenden
async function fetchAudioForSentence(sentence, voice) {
    if (dbgLevel) terminalPrint(`Satz: '${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}'`);
    const methodGET = (audioPlayer.paused == true) && (audioCache.length == 0) && (isLoading == false);

    const formData = new FormData();
    if (!methodGET) {
        formData.append('text', sentence);
        formData.append("voice", voice);
        formData.append('sessionid', apiSessionId);
        formData.append('user', apiUser);
        formData.append('stream', '1');
    } else {
        var url = `./api/oai_tts.php?`;
        url += `text=${encodeURIComponent(sentence)}`;
        url += `&voice=${encodeURIComponent(voice)}`;
        url += `&sessionid=${encodeURIComponent(apiSessionId)}&stream=1`;
        url += `&user=${encodeURIComponent(apiUser)}`;
        isLoading = true;
    }
    try {
        if (!isLoggedIn) throw new Error("Not logged in!");
        if (methodGET) {
            if (dbgLevel) terminalPrint(`Lade Audio via GET/src...`);
            audioPlayer.src = url;
            audioPlayer.load();
        } else {
            if (dbgLevel) terminalPrint(`Lade Audio via POST/cache...`);
            var response = await fetch("./api/oai_tts.php", { method: "POST", body: formData });
            const contentType = response.headers.get('content-type');

            // Prüfen ob Audio oder Fehler
            if (response.ok && contentType && contentType.includes('audio')) {
                const audioBlob = await response.blob();
                audioCache.push(audioBlob);
                if (dbgLevel) terminalPrint(`Audio für Satz geladen: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`);
            } else {
                // Fehler als Text oder JSON
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    if (dbgLevel) terminalPrint(`ERROR(JSON): ${JSON.stringify(errorJson)}`);
                } catch {
                    if (dbgLevel) terminalPrint(`ERROR(TEXT): ${errorText.substring(0, 100)}`);
                }
            }
        }
    } catch (error) {
        if (dbgLevel) terminalPrint(`ERROR(Server) Scentence:"${sentence.substring(0, 50)}...": ${error.message}`);
    }
}

// Hauptfunktion zum Verarbeiten des Textes
export async function speakText(inputText) {
    if (isProcessing) {
        return;
    }
    if (inputText.length === 0) {
        if (dbgLevel) terminalPrint('Kein Text eingegeben!');
        return;
    }
    isProcessing = true;
    setChatStatus('Ich rede...', 'skyblue');


    // Text normalisieren: Newlines und Tabs in Leerzeichen umwandeln
    const normalizedText = inputText.replace(/[\n\r\t]+/g, ' ');
    // Text in Sätze zerlegen
    const sentences = splitIntoSentences(normalizedText);
    if (dbgLevel) terminalPrint(`Text in ${sentences.length} Sätze zerlegt`);

    // Jeden Satz verarbeiten
    const selectedVoice = speakVoice;  // Damit nicht aenderbar within Funktion
    for (let i = 0; i < sentences.length; i++) {
        await fetchAudioForSentence(sentences[i], selectedVoice);
    }

    if (dbgLevel) terminalPrint('Alle Sätze verarbeitet');
    isProcessing = false;

}

// === MODSay - ENDE===

// ==== MODFetchAPI - START====
// Mit ChatServer reden/login - muss async sein, wg, fetch(), kann evtl. mitschreiben oder callback aufrufen oder beides..
// reguleren Chat mit Server
export async function talkWithServer(text, concerningMessage = null) {
    const payload = {
        sessionId: apiSessionId,
        user: apiUser,
        lang: userLanguage,
        text: text
    };
    try {
        if (!isLoggedIn) throw new Error("Not logged in!");
        const response = await fetch('./api/oai_chat.php', {  // './api/echo_sim.php'
            method: 'POST',
            body: new URLSearchParams(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (dbgLevel) terminalPrint(`POST failed: ${response.status} ${response.statusText}: ${errorText}`);
            if (concerningMessage) updateMessage(concerningMessage, `ERROR(ServerP3): ${response.status} ${response.statusText}: ${errorText}`, 'bot error');
            chatStateVar = -996;
            return;
        }
        const data = await response.json();
        if (data.success) {
            let text = '?';

            console.log('data:',data); // - Die Antwort der KI kann alles mögliche enthalten...
            try {
                text = (data?.result?.answer?.text ?? '(Keine Antwort)');
                if (data.result?.meta?.notes) {
                    // text += '\n(Auswertung: ' + data.result.meta.notes + ')';
                }
            } catch (e) { }
            console.log('Extracted text:',text);

            if (concerningMessage) updateMessage(concerningMessage, text, 'bot ok');
            speakText(text);    // Sprichs aus!
            chatStateVar = 5; // Fertig, nun audio setzt auch 10
        } else {
            if (concerningMessage) updateMessage(concerningMessage, 'ERROR: ' + (data.error || 'Unbekannter Fehler'), 'bot error');
            chatStateVar = -994;
        }
        if (dbgLevel) terminalPrint('POST returned: ' + JSON.stringify(text)); // Nur Text reicht
    } catch (e) {
        if (dbgLevel) terminalPrint('POST failed: ' + e.message);
        if (concerningMessage) updateMessage(concerningMessage, 'ERROR(ServerP4): ' + e.message, 'bot error');
        chatStateVar = -995;
    }
}

// Ausm STD-Player Audio holen und transkibe
export async function postAudio() {
    try {
        const audioSrc = stdPlayer?.src;
        if (!audioSrc) {
            if (dbgLevel) terminalPrint('ERROR: No audio src');
            chatStateVar = -999;
            return;
        }

        //if (DBG) terminalPrint('Fetching audio data from player src...');
        if (!isLoggedIn) throw new Error("Not logged in!");
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const audioBlob = await res.blob();
        //if (DBG) terminalPrint(`Posting audio (${audioBlob.size} bytes, ${audioBlob.type})...`);

        const apiUrl = './api/oai_stt.php';
        const formData = new FormData();
        formData.append('sessionId', apiSessionId);
        formData.append('user', apiUser);
        if (userLanguage !== undefined) formData.append('lang', userLanguage);
        formData.append('audio', audioBlob, 'recording' + (audioBlob.type.includes("ogg") ? ".ogg" : ".webm"));
        const postResponse = await fetch(apiUrl, { method: 'POST', body: formData });

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            if (dbgLevel) terminalPrint(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${errorText}`);
            addMessage(`ERROR(ServerP2): ${postResponse.status} ${postResponse.statusText}: ${errorText}`, 'bot error');
            chatStateVar = -998;
            return;
        }
        const text = await postResponse.json();
        const spoken = text.text || text;
        const oldText = textEingabe.value.trim();
        if (oldText.length > 0) {
            textEingabe.value = oldText + ' ' + spoken;
        } else {
            textEingabe.value = spoken;
        }
        if (dbgLevel) terminalPrint('POST successful: ' + JSON.stringify(text));
        chatStateVar = 3; // Fertig

    } catch (e) {
        if (dbgLevel) terminalPrint('POST failed: ' + e.message);
        addMessage('ERROR(ServerP1): ' + e.message, 'bot error');
        chatStateVar = -997;
    }
}
// ==== ENDE MODFetchAPI ====

// ==== MODMicofone - START====

// Intern
const microBtn = document.getElementById('btn-micro');
const microButtonGlyph = document.getElementById('micro-button-glyph');
// Fuer InputAudio
const stdPlayer = document.querySelector(".stdplayer");

const thresholdSlider = document.getElementById('threshold');
const thresholdFeedback = document.getElementById('thresholdFeedback');
const autoThreshChk = document.getElementById('autoThreshChk');
const maxpauseSlider = document.getElementById('maxpause');
const maxpauseFeedback = document.getElementById('maxpauseFeedback');

const microOnOff = document.getElementById('microOnOff');
const canvas = document.querySelector(".visualizer");
const canvasCtx = canvas.getContext("2d");

const autoPlayChk = document.getElementById('autoPlayChk');
const autoPostChk = document.getElementById('autoPostChk');

// Helpers fuer Microfondaten und Analyse
let analyser = null;
let stream = null;
let delayedStream = null;
let microAudioCtx = null;
let dataArray = null;
let frameMoniId = null;
let mediaRecorder = null;

// rms Statistik
let thresholdRms = 0.1; // 0.1: Laute umgebung - Ext. via Slider
let sliderThreshold = 0.1; // Was am Slider vorgegeben
let autoThreshEnable = false;
let maxPauseMs = 800; // >200 , msec max. Sprachpause - Ext. via Slider

const MAX_SPEECH_MS = 30000; // msec max. Sprachdauer
const STREAM_DELAY_SEC = 0.3; // sec Delay, ca. 150 msec Vorlauf mind. 
const MICRO_INIT_MS = 200; // msec Mikrofon-(Re-)Initialisierung
const MIN_LEN_SPEECH_MS = 250; // msec min. Sprachdauer

let speechStateTime0; // Zeitstempel Sprachbeginn

let speechStartTime;
let speechTotalDur;
let audioChunks = [];

let microStatus = 0; // Status-Maschine fuer Micro: 0: nicht verfuegbar, 1: bereit ...
let isMicroOn = false;
let isRecording = false;
// Init Micro

// StdPlayer ist Audio-Input-Player - DEBUG
stdPlayer.addEventListener('play', () => {
    setChatStatus('Replay...', 'skyblue');
});
stdPlayer.addEventListener('error', (e) => {
    setChatStatus('ERROR(Replay): ' + e.message, 'red');
});
stdPlayer.addEventListener('ended', () => {
    if (microStatus === 7) { // 7: Replay
        microStatus = 8;
    }
    setChatStatus('Replay Ende', 'skyblue');
});

function addAudioChunk(data) {
    audioChunks.push(data);
    if (dbgLevel) terminalPrint('Audio chunk: ' + data.size + ' bytes, Total Chunks: ' + audioChunks.length);
}

async function startMicro() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }); // mono nicht unb. bindend
        if (!microAudioCtx) microAudioCtx = new AudioContext();
        if (microAudioCtx.state !== "running") await microAudioCtx.resume();
        const source = microAudioCtx.createMediaStreamSource(stream);
        analyser = microAudioCtx.createAnalyser();
        analyser.fftSize = 2048; // keine FFT, hier nur Zeitbereich
        dataArray = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        const delaySeconds = STREAM_DELAY_SEC
        const delayNode = microAudioCtx.createDelay(delaySeconds); // Def. ist 1
        delayNode.delayTime.value = delaySeconds; // sec
        const destination = microAudioCtx.createMediaStreamDestination();
        source.connect(delayNode);

        delayNode.connect(destination); // Das Ziel ist der verzögerte Stream
        delayedStream = destination.stream;

        const options = {
            // Je nach Browser ist oft "audio/webm" (Opus) oder "audio/ogg" möglich
            mimeType:
                MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
                    MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
                        MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" :
                            undefined,
        }

        mediaRecorder = new MediaRecorder(delayedStream, options);
        mediaRecorder.ondataavailable = (e) => {
            addAudioChunk(e.data);
        };
        mediaRecorder.onstop = processAudio;

        speechStateTime0 = performance.now();
        audioChunks = [];

        frameMonitor(); // Starte AnimationFrame
    } catch (e) {
        console.error('ERROR:', e);
        setChatStatus('ERROR: ' + e.message, 'red');
    }
}
function stopMicro() {
    if (frameMoniId) cancelAnimationFrame(frameMoniId);
    frameMoniId = null;

    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder = null;
    }

    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        stream = null;
    }
    if (delayedStream) {
        const tracks = delayedStream.getTracks();
        tracks.forEach(track => track.stop());
        delayedStream = null;
    }
    if (microAudioCtx) {
        microAudioCtx.close();
        microAudioCtx = null;
    }
}

function microBtnCLick() {
    if (!isMicroOn) {
        frq_ping();
        startMicro();
        canvas.hidden = false;
        microOnOff.hidden = true;
        isMicroOn = true;
        isRecording = false
        microButtonGlyph.classList.remove('bi-mic-mute-fill');
        microButtonGlyph.classList.add('bi-mic-fill');
        microButtonGlyph.classList.add('jo-icon-ani-beat');
        setChatStatus('Mikro AN...', 'yellow');
    } else {
        microOnOff.hidden = false;
        isMicroOn = false;
        canvas.hidden = true;

        stopMicro();
        frq_ping();
        microButtonGlyph.classList.remove('jo-icon-ani-beat');
        microButtonGlyph.classList.remove('bi-mic-fill');
        microButtonGlyph.classList.add('bi-mic-mute-fill');
        setChatStatus('Mikro AUS', 'lime');
        bloomMicroButton(0);
    }
}

// RMS-Berechnung (aus dataArray, byteArray: 0..255, 128 ist "0")
function computeRMSFromTimeDomain(byteArray) {
    let sumSq = 0;
    const length = byteArray.length;
    for (let i = 0; i < length; i++) {
        const v = (byteArray[i] - 128) / 128; // -1..1
        sumSq += v * v;
    }
    return Math.sqrt(sumSq / length);
}

// Process Audio - Audio-Chunks zu einem Blob zusammenfassen, wenn nicht zu kurz
function processAudio(e) {
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
    const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + blob.type;
    if (dbgLevel) terminalPrint("Audio recorded: " + info);
    const procAudioURL = window.URL.createObjectURL(blob);
    audioChunks = [];
    if (microStatus === 5) microStatus = 6; // Verarbeitet!
    stdPlayer.src = procAudioURL; // Das ist auch der temporaere Zwischenspeicher
}

// Sprach-Zustandsmaschine
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;

    if (dbgLevel) dbgInfo.textContent = `microStatus: ${microStatus}  Dur: ${dur.toFixed(0)} msec`;
    if (isMenuVisible) {
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
        }
        microStatus = 1;
        setChatStatus('Menue...', 'yellow');
        return;
    }

    switch (microStatus) {
        case 1: // Zustand 1: MICRO_INIT msec lang AVG anlernen
            if (dur > MICRO_INIT_MS) {
                microStatus = 2;
                setChatStatus('Ich höre...', 'yellow');
            }
            break;

        case 2: // Zustand 2: Warten auf Sprache
            if (frameRms > thresholdRms) { // Sprache erkannt
                if (mediaRecorder.state === "inactive") {
                    mediaRecorder.start();
                    isRecording = true;
                }
                microStatus = 3;
                speechStateTime0 = performance.now();
                speechStartTime = speechStateTime0; // Fuer Alles und Pausen
                setChatStatus('Ich höre zu!', 'lime');
            }
            break;

        case 3: // Zustand 3: Sprache laeuft
            if (frameRms < thresholdRms / 2) {   // Als Pause erkannt
                microStatus = 4;
                speechStateTime0 = performance.now();
                // setChatStatus('Sprachpause', 'lime');
            } else {
                speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
                if (speechTotalDur > MAX_SPEECH_MS) { // Max. Dauer erreicht
                    mediaRecorder.stop();
                    isRecording = false;
                    speechStateTime0 = performance.now();
                    microStatus = 5;
                }
            }
            break;

        case 4: // Zustand 4: In Sprachpause
            if (frameRms > thresholdRms) {
                microStatus = 3;
                //setChatStatus('Spricht weiter', 'lime');
            } else if (dur > maxPauseMs) { // Pause laenger als x sec => Ende
                speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
                mediaRecorder.stop();
                isRecording = false;
                speechStateTime0 = performance.now();
                microStatus = 5;
            }
            break;

        case 5: // Zustand 5: Nachbearbeitung
            // Warten auf Prozessierung
            break;

        case 6: // Zustand 6: Warten auf Restart
            if (speechTotalDur > MIN_LEN_SPEECH_MS) {
                if (speechTotalDur > MAX_SPEECH_MS) { // Max. Dauer erreicht
                    if (dbgLevel) terminalPrint(`Speech Max Length reached (${speechTotalDur} msec), stopping.`);
                } else {
                    if (dbgLevel) terminalPrint(`Speech End (${speechTotalDur} msec)`);
                }
                setChatStatus('Sprache beendet', 'yellow');
                if (dbgLevel > 1) { // OPtional immer abspielen zum Testen
                    microStatus = 7;
                    stdPlayer.play(); // Zum Testen immer abspielen            
                } else microStatus = 8; // Direkt fertig
            } else {
                if (dbgLevel) terminalPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
                microStatus = 0; // Zuruecksetzen
            }
            break;

        case 7: // Zustand 7: evt. Replay abwarten
            break;

        case 8: // Zustand 8: FERTIG, uebergeben
            // Single-Shot - Muss laufen bis zum Ende
            microStatus = 9;
            chatStateVar = 1; // Starte Transcribe
            if (!autoPlayChk.checked) {
                isMicroOn = true; // Sicher auf AUS
                microBtnCLick();
            }
            break;
        case 9: // Warten bis quittiert von Periodical
            break;
    }
}

// === GUI-Elemente ===

// Bloom-Button-Rahmen
function bloomMicroButton(bloomTh) {
    const width = bloomTh < 0 ? 0 : bloomTh > 15 ? 15 : bloomTh;
    microBtn.style.setProperty("--spread", `${width}px`);
}

// Animation-Frame, monitored Micro-Daten
let maxRms = 0;
let minRms = thresholdRms;
function frameMonitor() {
    if (!isMicroOn) return;
    frameMoniId = requestAnimationFrame(frameMonitor);
    analyser.getByteTimeDomainData(dataArray);
    const frameRms = computeRMSFromTimeDomain(dataArray);
    maxRms *= 0.9;
    if (frameRms > maxRms) maxRms = frameRms;
    minRms = 0.998 * minRms + 0.002 * sliderThreshold;
    if (frameRms < minRms) minRms = frameRms;
    if (autoThreshEnable) thresholdRms = minRms * 5 + 0.05; // Etwas Puffer
    updateSpeechState(maxRms);
    bloomMicroButton(((maxRms / thresholdRms) - 0.5) * 3);
    if (isMenuVisible) {
        // Zeichnen, falls sichtbar
        const w = canvas.width, h = canvas.height;
        // Hintergrund
        canvasCtx.fillStyle = 'silver';
        canvasCtx.fillRect(0, 0, w, h);
        const jusColor = maxRms < thresholdRms ? 'yellow' : 'lime';
        canvasCtx.fillStyle = jusColor;
        canvasCtx.fillRect(0, 0, maxRms * w * 3, h);
        canvasCtx.fillStyle = "black";
        canvasCtx.fillRect(thresholdRms * w * 3, 0, 2, h);
    }
}

function maxpauseMove() {
    maxpauseFeedback.textContent = maxpauseSlider.value;
    maxPauseMs = parseInt(maxpauseSlider.value);
}
function thresholdMove() {
    const h = parseFloat(thresholdSlider.value);
    sliderThreshold = (h * h * h / 300) + 0.025; // Quadratisch
    minRms = sliderThreshold;
    thresholdRms = sliderThreshold;
    thresholdFeedback.textContent = sliderThreshold.toFixed(3);
}
function autoThreshChkChange() {
    autoThreshEnable = autoThreshChk.checked;
    thresholdMove();
}
autoThreshChk.addEventListener('change', autoThreshChkChange);
thresholdSlider.addEventListener('input', thresholdMove);
maxpauseSlider.addEventListener('input', maxpauseMove);
maxpauseMove();
thresholdMove();
autoThreshEnable = autoThreshChk.checked;

microBtn.addEventListener('click', microBtnCLick);
navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
    .then(() => {
        canvas.hidden = true;
        microStatus = 1;
        microBtn.disabled = false;

        thresholdSlider.disabled = false;
        maxpauseSlider.disabled = false;
        autoThreshChk.disabled = false;
        setChatStatus('Mikro bereit', 'lime');
    })
    .catch(() => {
        setChatStatus('Mikro gesperrt', 'red');
        microStatus = 0;
    });
// === ENDE MODMicofone ====

// ==== MODUserInterface ====
const chatVerlauf = document.getElementById('chat-verlauf');
const textEingabe = document.getElementById('text-eingabe');
const sendenBtn = document.getElementById('btn-senden');
const sendenBtnGlyph = document.getElementById('senden-button-glyph');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('chat-status');
const dbgDiv = document.querySelector('.dbg');

// Erstmal alle entfernen, dann bei Bedarf setzen
export function setSendButtonGlyph(id) {
    sendenBtnGlyph.classList.remove('bi', 'bi-box-arrow-right', 'spinner');
    switch (id) {
        case 'sending':
            sendenBtnGlyph.classList.add('bi', 'spinner');
            break;
        case 'ready':
        default:
            sendenBtnGlyph.classList.add('bi', 'bi-box-arrow-right');
    }
}

export function setChatStatus(s, color = 'silver') {
    statusEl.textContent = s;
    statusEl.style.backgroundColor = color;
    microBtn.style.setProperty("--scolor", color);
}

// Eine Nachricht im regulaeren User-Fenster mit Klasse zufügen
// Verzierungsmoeglichkeiten 'user'/'bot' + opt. 'ok', 'info', 'error' als string
export function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatVerlauf.appendChild(messageDiv);
    setTimeout(() => {
        chatVerlauf.scrollTop = chatVerlauf.scrollHeight;
    }, 100);
    frq_ping(1760, 0.1, 0.07); // Kurzer HPing
    return messageDiv;
}
// Fuer nachtraegliche Aenderung
function updateMessage(messageDiv, text, type) {
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    setTimeout(() => {
        chatVerlauf.scrollTop = chatVerlauf.scrollHeight;
    }, 100);

}

sendenBtn.addEventListener('click', sendeNachricht);

textEingabe.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendeNachricht();
    }
});

// Helper fuer Menusichtbarkeit
let isMenuVisible = false;
function menuManage(flag) {
    if (!flag) {
        // Unsichtbar
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    } else {
        // Sichtbar
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
    frq_ping(880, 0.1, 0.07); // Kurzer HPing
    isMenuVisible = flag;
}

menuToggle.addEventListener('click', () => {
    menuManage(true); // AUF
});
overlay.addEventListener('click', () => {
    menuManage(false);   // ZU   
});
document.getElementById('sidebar-close').addEventListener('click', () => {
    menuManage(false); // ZU
});
if (dbgLevel) {
    dbgDiv.hidden = false;
    terminalPrint(''); // Initial anzeigen
}

setInterval(periodical, 100); // 100 msec-Timer starten

// === ENDE MODUserInterface ===

// === MODLogin Start ===
// Wenn test=true: Session testen
const userNameDisplay = document.getElementById('userName');
const infoDialog = document.getElementById('infoDialog');
document.getElementById("infoVersion").textContent = VERSION;
document.getElementById('infoCloseBtn').addEventListener('click', () => {
    infoDialog.close();
});
document.getElementById('menuInfo').addEventListener('click', async (e) => {
    e.preventDefault();
    infoDialog.showModal();
});
document.getElementById('loginInfoLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('infoDialog').showModal();
});

document.getElementById('menuLogout').addEventListener('click', async () => {
    await login('logout', apiUser, '', apiSessionId); // Logout
    location.reload(); // Seite neu laden
});

export async function login(cmd = '', luser = '', lpassword = '', lsessionId = '', statusElement = null) {
    const payload = {
        user: luser,
        password: lpassword,
        sessionId: lsessionId,
        cmd: cmd
    };
    try {
        // Login, Logtest, Logout
        const response = await fetch('./api/login.php', {
            method: 'POST',
            body: new URLSearchParams(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (dbgLevel) terminalPrint(`POST failed: ${response.status} ${response.statusText}: ${errorText}`);
            if (statusElement) statusElement.textContent = `Login failed: ${response.status} ${response.statusText}: ${errorText}`;
            return false;
        }
        const data = await response.json();
        if (data.success && luser === data.user) {
            apiSessionId = data.sessionId;
            apiUser = data.user;
            userNameDisplay.textContent = apiUser;
            userLanguage = data.userLang;
            speakVoice = data.speakVoice;
            const nHelpTexts = data.helpTexts;
            helpTxts = nHelpTexts;
            // OK
            isLoggedIn = true;
            sendenBtn.disabled = false;

            return true;
        }
        if (dbgLevel) terminalPrint('POST returned: ' + JSON.stringify(data));
    } catch (e) {
        if (dbgLevel) terminalPrint('POST failed: ' + e.message);
    }
    return false;
}

const credentialsDialog = document.getElementById('credentials');
document.getElementById('btn-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const user = document.getElementById('input-user').value.trim();
    const password = document.getElementById('input-password').value.trim();
    const loginStatus = document.getElementById('login-error');
    if (user.length < 6 || password.length < 8) {
        loginStatus.textContent = 'Benutzername mindestens 6 Zeichen,Passwort mindestens 8 Zeichen!';
        frq_ping(220, 0.5, 0.2);
        return;
    }
    loginStatus.textContent = 'Anmeldung läuft...';
    const logres = await login('login', user, password, '', loginStatus);
    if (logres === true) { // Full Login
        loginStatus.textContent = 'Anmeldung OK!';
        saveCredentialsToLocalStorage(user, apiSessionId);
        frq_ping(880, 0.1, 0.07); // Kurzer HPing
        await jsSleepMs(300);
        credentialsDialog.close();
    } else {
        loginStatus.textContent = 'Anmeldung fehlgeschlagen!';
        frq_ping(220, 0.5, 0.2);
    }
});
// Never Password
export function deleteCredentialsFromLocalStorage() {
    localStorage.removeItem('loginmonitor-username');
    localStorage.removeItem('loginmonitor-sessionid');
}
export function saveCredentialsToLocalStorage(username = '', sessionId = '') {
    if (username.length) localStorage.setItem('loginmonitor-username', username);
    if (sessionId.length) localStorage.setItem('loginmonitor-sessionid', sessionId);
}
export function getCredentialsFromLocalStorage() {
    const username = localStorage.getItem('loginmonitor-username') || '';
    const sessionId = localStorage.getItem('loginmonitor-sessionid') || '';
    return { username, sessionId };
}

export async function mainLogin(cred) {
    if (cred.username.length > 0 && cred.sessionId.length > 0) {
        const res = await login('logrem', cred.username, '', cred.sessionId, null); // Test-Login
        if (res === true) {
            return; // Alles ok
        }
    }
    credentialsDialog.showModal();
}

const cred = getCredentialsFromLocalStorage();
document.getElementById('input-user').value = cred.username;


mainLogin(cred);
// === ENDE MODLogin ===

console.log('Minichat:', VERSION);
