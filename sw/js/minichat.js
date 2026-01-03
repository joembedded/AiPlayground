/* minichat.js - Minichat 
* Aufbau: 
* Globaler Teil
* Module MODname mit ihren lokalen Daten
* Event-Handler
* Initialisierung
*/

//--------- globals ------ 
export const VERSION = 'V0.0x / xx.xx.2025';
export const COPYRIGHT = '(C)JoEmbedded.de';
export const DBG = true

// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***
export const API_PASSWORD = 'Leg1310LX'; //  
export const API_USER = 'Juergen'; // Test special chars
export const USER_LANG = 'de-DE';
export const SPEAK_VOICE = 'narrator_f_jane'; // Standard Stimme
// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***

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

// Ping-Helper- Erzeugt Kurze Pings
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
const helpTxts = [
    'Hallo. Wie kann ich helfen?',
    'Kann ich behilflich sein?',
    'Womit kann ich helfen?',
    'Hallo! Was kann ich tun?',
    'Kann ich behilflich sein?',
    'Fragen? Ich helfe gerne.',
    'Was kann ich tun?',
    'Worum geht es?',
];
let hlpIdx = 0;

let theNewMessage = null;   // Letzee/pending Message
async function sendeNachricht() {
    if (chatStateVar >= 4) {
        if (DBG) terminalPrint('sendeNachricht: Abbruch, chatStateVar=' + chatStateVar);
        return; // Bereits senden in Arbeit
    }
    let text = textEingabe.value.trim();
    if (text.length === 0) {
        //text ='\u2424'; // NL-Symbol
        const help = helpTxts[hlpIdx];
        hlpIdx = (hlpIdx + 1) % helpTxts.length;
        addMessage(help, 'bot info');
        chatStateVar = 5; // Warte auf sendeNachricht
        speakText(help);
        // Keine Eingabe-Keine Zeile
        return;
    }

    addMessage(text, 'user'); // User-Meldung anzeigen
    theNewMessage = addMessage(' Warte...', 'bot spinner');
    chatStateVar = 4; // Warte auf Server-Antwort
    talkWithServer(text);
    textEingabe.value = '';
}
// Background Monitor - alle ca. 100 msec
let chatStateVar = 0;     // 0: idle - darf extern mod. werden!
function periodical() {
    if (DBG) dbgAudioStatus.textContent = `chatStateVar: ${chatStateVar}`;

    switch (chatStateVar) {
        case 0: // idle
            break;
        case 1: // Audio-Input im stdPlayer vorhanden - Start Transcribe!
            chatStateVar = 2;
            setChatStatus('Ich verstehe...', 'yellow');
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

        case 10: // **Erwarte sendeNachricht**
            setChatStatus('Hab alles gesagt', 'yellow');
            chatStateVar = 0; // Zuruecksetzen
            microStatus = 1; // Micro wieder bereit
            break;

        default:
            if (DBG) terminalPrint('ERROR: chatStateVar:' + chatStateVar);
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
let audioUrl = null;
let pollInterval;
// für GET <2000 Zeichen safe, <4000: 'okÄ, >4000 evtl. Probleme
const maxSentenceLength = 4000; // Maximale Satzlänge in Zeichen fuer die API
const splitShortSentencesFlag = false; // true


const audioPlayer = document.getElementById('audioPlayer');
// Abspielen sobald möglich
audioPlayer.oncanplay = function () {
    audioPlayer.play().catch(error => {
        if (DBG) terminalPrint('ERROR(audioPlayer): ' + error);
        setChatStatus('ERROR(audioPlayer): ' + error, 'red');
    });
}
// Alte URL freigeben wenn Audio beendet ist
audioPlayer.onended = function () {
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        audioUrl = null;
    }
    isLoading = false;
};


// Prüfen und Audio abspielen
function checkAndPlayAudio() {
    // canplay feuert ab HAVE_FUTIRE_DATA
    const STATS = ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"];
    audioStatus.textContent = `State:${STATS[audioPlayer.readyState]} Paused:${audioPlayer.paused} Ended:${audioPlayer.ended} CacheLen:${audioCache.length}`;

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
    audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    audioPlayer.play().then(() => {
        if (DBG) terminalPrint(`Play - verbleibende Dateien: ${audioCache.length}`);
    }).catch(err => {
        if (DBG) terminalPrint('Fehler beim Abspielen: ' + err.message);
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
async function fetchAudioForSentence(sentence, voice) {
    if (DBG) terminalPrint(`Satz: '${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}'`);
    const methodGET = (audioPlayer.paused == true) && (audioCache.length == 0) && (isLoading == false);

    const formData = new FormData();
    if (!methodGET) {
        formData.append('text', sentence);
        formData.append("voice", voice);
        formData.append('apipw', API_PASSWORD);
        if (API_USER !== undefined) formData.append('user', API_USER);
        formData.append('stream', '1');
    } else {
        var url = `./api/oai_tts.php?text=${encodeURIComponent(sentence)}&voice=${encodeURIComponent(voice)}&apipw=${encodeURIComponent(API_PASSWORD)}&stream=1`;
        if (API_USER !== undefined) url += `&user=${encodeURIComponent(API_USER)}`;

        isLoading = true;
    }
    try {
        if (methodGET) {
            if (DBG) terminalPrint(`Lade Audio via GET/src...`);
            audioPlayer.src = url;
            audioPlayer.load();
        } else {
            if (DBG) terminalPrint(`Lade Audio via POST/cache...`);
            var response = await fetch("./api/oai_tts.php", { method: "POST", body: formData });
            const contentType = response.headers.get('content-type');

            // Prüfen ob Audio oder Fehler
            if (response.ok && contentType && contentType.includes('audio')) {
                const audioBlob = await response.blob();
                audioCache.push(audioBlob);
                if (DBG) terminalPrint(`Audio für Satz geladen: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`);
            } else {
                // Fehler als Text oder JSON
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    if (DBG) terminalPrint(`ERROR(JSON): ${JSON.stringify(errorJson)}`);
                } catch {
                    if (DBG) terminalPrint(`ERROR(TEXT): ${errorText.substring(0, 100)}`);
                }
            }
        }
    } catch (error) {
        if (DBG) terminalPrint(`ERROR(Server) Scentence:"${sentence.substring(0, 50)}...": ${error.message}`);
    }
}

// Hauptfunktion zum Verarbeiten des Textes
export async function speakText(inputText) {
    if (isProcessing) {
        return;
    }
    if (inputText.length === 0) {
        if (DBG) terminalPrint('Kein Text eingegeben!');
        return;
    }
    isProcessing = true;
    setChatStatus('Ich rede...', 'skyblue');


    // Text normalisieren: Newlines und Tabs in Leerzeichen umwandeln
    const normalizedText = inputText.replace(/[\n\r\t]+/g, ' ');
    // Text in Sätze zerlegen
    const sentences = splitIntoSentences(normalizedText);
    if (DBG) terminalPrint(`Text in ${sentences.length} Sätze zerlegt`);

    // Jeden Satz verarbeiten
    const selectedVoice = SPEAK_VOICE;  // Damit nicht aenderbar within Funktion
    for (let i = 0; i < sentences.length; i++) {
        await fetchAudioForSentence(sentences[i], selectedVoice);
    }


    if (DBG) terminalPrint('Alle Sätze verarbeitet');
    isProcessing = false;
    document.getElementById('btn-senden').disabled = false;
}

// === MODSay - ENDE===

// ==== MODFetchAPI - START====
// Mit ChatServer reden
export async function talkWithServer(text) {
    const payload = {
        apipw: API_PASSWORD,
        user: API_USER,
        lang: USER_LANG,
        text: text
    };
    try {
        const response = await fetch('./api/echo_sim.php', {
            method: 'POST',
            body: new URLSearchParams(payload)
        });


        if (!response.ok) {
            const errorText = await response.text();
            if (DBG) terminalPrint(`POST failed: ${response.status} ${response.statusText}: ${errorText}`);
            updateMessage(theNewMessage, `ERROR(ServerP3): ${response.status} ${response.statusText}: ${errorText}`, 'bot error');
            chatStateVar = -996;
            return;
        }
        const data = await response.json();
        if (data.success) {
            const text = data?.text?.length ? data.text : '(leere Antwort)';
            updateMessage(theNewMessage, text, 'bot ok');
            speakText(text);    // Sprichs aus!
        } else {
            updateMessage(theNewMessage, 'ERROR: ' + (data.error || 'Unbekannter Fehler'), 'bot error');
        }
        if (DBG) terminalPrint('POST successful: ' + JSON.stringify(text));
        chatStateVar = 5; // Fertig, nun audio setzt auch 10

    } catch (e) {
        if (DBG) terminalPrint('POST failed: ' + e.message);
        updateMessage(theNewMessage, 'ERROR(ServerP4): ' + e.message, 'bot error');
        chatStateVar = -995;
    }

}

// Ausm STD-Player Audio holen und transkibe
export async function postAudio() {
    try {
        const audioSrc = stdPlayer?.src;
        if (!audioSrc) {
            if (DBG) terminalPrint('ERROR: No audio src');
            chatStateVar = -999;
            return;
        }
        if (DBG) frq_ping(880);

        //if (DBG) terminalPrint('Fetching audio data from player src...');
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const audioBlob = await res.blob();
        //if (DBG) terminalPrint(`Posting audio (${audioBlob.size} bytes, ${audioBlob.type})...`);

        const apiUrl = './api/oai_stt.php';
        const formData = new FormData();
        formData.append('apipw', API_PASSWORD);
        if (API_USER !== undefined) formData.append('user', API_USER);
        if (USER_LANG !== undefined) formData.append('lang', USER_LANG);
        formData.append('audio', audioBlob, 'recording' + USE_EXTENSION);
        const postResponse = await fetch(apiUrl, { method: 'POST', body: formData });

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            if (DBG) terminalPrint(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${errorText}`);
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
        if (DBG) terminalPrint('POST successful: ' + JSON.stringify(text));
        chatStateVar = 3; // Fertig

    } catch (e) {
        if (DBG) terminalPrint('POST failed: ' + e.message);
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
const maxpauseSlider = document.getElementById('maxpause');
const maxpauseFeedback = document.getElementById('maxpauseFeedback');

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

// MimeType fuer MediaRecorder ist optional, aber...
const USE_MIME_STREAM = 'audio/webm; codecs=opus';
const USE_MIME_BLOB = 'audio/ogg; codecs=opus';
const USE_EXTENSION = '.webm'; // 


// rms Statistik
let thresholdRms = 0.1; // 0.1: Laute umgebung - Ext. via Slider
let maxPauseMs = 1000; // >200 , msec max. Sprachpause - Ext. via Slider

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
    if (DBG) terminalPrint('Audio chunk: ' + data.size + ' bytes, Total Chunks: ' + audioChunks.length);
}


async function startMicro() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        const options = {};
        if (typeof USE_MIME_STREAM !== 'undefined') {
            options.mimeType = USE_MIME_STREAM;
            if (USE_MIME_STREAM && !MediaRecorder.isTypeSupported(USE_MIME_STREAM)) throw new Error(`MIME-Type not supported: ${USE_MIME_STREAM}`);
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
        isMicroOn = true;
        microButtonGlyph.classList.remove('bi-mic-mute-fill');
        microButtonGlyph.classList.add('bi-mic-fill');
        setChatStatus('Mikro AN...', 'yellow');
    } else {
        isMicroOn = false;
        canvas.hidden = true;

        stopMicro();
        frq_ping();
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
    const blob = new Blob(audioChunks, { type: USE_MIME_BLOB });
    const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + USE_MIME_BLOB;
    if (DBG) terminalPrint("Audio recorded: " + info);
    const audioURL = window.URL.createObjectURL(blob);
    audioChunks = [];
    if (microStatus === 5) microStatus = 6; // Verarbeitet!
    stdPlayer.src = audioURL; // Das ist auch der temporaere Zwischenspeicher
}

// Sprach-Zustandsmaschine
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;

    if (DBG) dbgInfo.textContent = `microStatus: ${microStatus}  Dur: ${dur.toFixed(0)} msec`;

    switch (microStatus) {
        case 1: // Zustand 1: MICRO_INIT msec lang AVG anlernen
            if (dur > MICRO_INIT_MS) {
                microStatus = 2;
                setChatStatus('Ich höre...', 'yellow');
            }
            break;

        case 2: // Zustand 2: Warten auf Sprache
            if (frameRms > thresholdRms) { // Sprache erkannt
                if (mediaRecorder.state === "inactive") mediaRecorder.start();
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
                    if (DBG) terminalPrint(`Speech Max Length reached (${speechTotalDur} msec), stopping.`);
                } else {
                    if (DBG) terminalPrint(`Speech End (${speechTotalDur} msec)`);
                }
                setChatStatus('Sprache beendet', 'yellow');
                if (DBG && 0) { // OPtional immer abspielen zum Testen
                    microStatus = 7;
                    stdPlayer.play(); // Zum Testen immer abspielen            
                } else microStatus = 8; // Direkt fertig
            } else {
                if (DBG) terminalPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
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
function frameMonitor() {
    if (!isMicroOn) return;
    frameMoniId = requestAnimationFrame(frameMonitor);
    analyser.getByteTimeDomainData(dataArray);
    const frameRms = computeRMSFromTimeDomain(dataArray);
    maxRms *= 0.95;
    if (frameRms > maxRms) maxRms = frameRms;
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
    thresholdRms = (h * h * h / 300) + 0.025; // Quadratisch
    thresholdFeedback.textContent = thresholdRms.toFixed(3);
}
thresholdSlider.addEventListener('input', thresholdMove);
maxpauseSlider.addEventListener('input', maxpauseMove);
maxpauseMove();
thresholdMove();

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
        canvas.hidden = true;
        microStatus = 1;
        microBtn.disabled = false;
        microBtn.addEventListener('click', microBtnCLick);

        thresholdSlider.disabled = false;
        maxpauseSlider.disabled = false;
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
const btnSenden = document.getElementById('btn-senden');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('chat-status');

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
    frq_ping(1760, 0.1, 0.07); // Kurzer Ping
    return messageDiv;
}
// Fuer nachtraegliche Aenderung
function updateMessage(messageDiv, text, type) {
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
}

btnSenden.addEventListener('click', sendeNachricht);

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
    frq_ping(1760, 0.1, 0.07); // Kurzer Ping
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
if (DBG) {
    document.querySelector('.dbg').hidden = false;
    terminalPrint(''); // Initial anzeigen
}


setInterval(periodical, 100); // 100 msec-Timer starten

// === ENDE MODUserInterface ===

console.log('Minichat:', VERSION);
