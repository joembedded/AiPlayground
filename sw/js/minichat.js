/* minichat.js - Minichat 
*
* Ziemlich vollständiges Fragment für ein Mini-Chatsystem mit Voice STT/TTS
* Hinweis: Die beiden Zustandsmaschinen sind numerisch codiert. 
* Das ist nicht unbedingt üblich, Aber für kleine Systeme ok.
*
* Muss als modul (defered oder am Ende des <body>) eingebunden werden. 
* Daher die beiden "export" Anweisungen (nur in modul-Dateien erlaubt).
* 
* Zum Debuggen dbgLevel:
* Level per '.debug N' Befehl, N: 0-3
* 0: Kein Debug
* 1: Meta-Daten angeben, kein Terminal
* 2: Terminal-Ausgabe aktivieren
* 3: Nur Samplen und ggfs. abspielen (zum Testen des Input, MIN_LEN_SPEECH_MS)
*/

//--------- globals ------ 
import * as I18 from './intmain_i18n.js'

export const VERSION = 'V0.06 / 17.01.2026';
export const COPYRIGHT = '(C) JoEmbedded.de';
let dbgLevel = 1;   // 0: Kein Debug, 1: Meta-Daten, 2: Terminal, 3: Terminal+Micro nur abspielen, sonst nix

// Session Credentials
let apiSessionId = ''; // 32 Zeichen SessionID
let apiUser = ''; // z.B. 'testuser'
let apiTempPassword = ''; // Nur temporär im Login

let userCredits = 0; // Verfügbare Credits
let userCredits0 = 0; // Initiale Credits

let userLanguage = null; // de-DE
let speakVoice = null; // z.B 'narrator_f_jane'; 
let persona = null; // Persona-Name für KI z.B. vilo
let introText = null; // Intro-Text der Persona

let personaCommand = ''; // Zusätzliche Persona-Kommandos
let voiceCommand = ''; // Zusätzliche Voice-Kommandos

let isLoggedIn = false; // true wenn eingeloggt

// -------- ENDE globals ------
// Language Wrapper
function ll(txt) {
    return I18.ll(txt)
}


//=== MODMinitools ===
// Terminal-Emulation, braucht ein DIV mit class="terminal"
const TERMINAL_LINES = 25; // Default
let terminal_lines = TERMINAL_LINES; // Real, kann live angepasst werden
const terminalContent = ["'*** Terminal ***'"];
const terminalEl = document.getElementById('dbgTerminal');

function terminalPrint(txt = '\u2424') { // NL-Symbol
    terminalContent.push(txt);
    while (terminalContent.length > terminal_lines) terminalContent.shift();
    terminalEl.innerText = terminalContent.join('\n');
    terminalEl.scrollTop = terminalEl.scrollHeight;
}

function safePlay(audioEl) {
    audioEl?.play?.().catch(() => { });
}

function dbgPrint(txt) {
    if (dbgLevel > 1) terminalPrint(txt);
}
// TextContent direkt setzen
const dbgInfo = document.getElementById('dbginfo');
const dbgAudioStatus = document.getElementById('audioStatus');

const dbgTokens = document.getElementById('tokens-value');

function setCreditsDisplay() {
    dbgTokens.textContent = userCredits0 - userCredits; // Zaehlt alle
}
// Nuetzliches sleep in async functions
async function jsSleepMs(ms = 1) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//=== ENDE MODMinitools ===

// === MODMainChat - START===
let helpTxts = [
    '(noHelp)'
];
let hlpIdx = 0;

let theNewMessage = null;   // Letzee/pending Message

// Hier werden die letzten Nachrichten gespeichert, bzw. null. Interessant vor Allem META
let lastServerText = null;
let lastServerMeta = null;

async function sendeNachricht() {
    microStatus= 9; // Micro aus während blabla
    safePlay(audioFxClick);

    setSendButtonGlyph('sending');
    if (chatStateVar >= 4) {
        dbgPrint('sendeNachricht: Abbruch, chatStateVar=' + chatStateVar);
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
        speakText(help, true); // Konserventexte speichern
        // Keine Eingabe-Keine Zeile
        return;
    }
    // Systemkommandos
    if (text.startsWith('.debug')) {
        const debugValue = text.substring(6).trim();
        if(debugValue=='notFound') I18.notFound();
        else if (debugValue.length) dbgLevel = parseInt(debugValue);
        dbgDiv.hidden = (dbgLevel < 2);
        chatStateVar = 5; // Warte auf sendeNachricht
        addMessage('.debug:' + dbgLevel, 'bot info');
        textEingabe.value = '';
        return;
    }
    if (text.startsWith('.vcmd')) { // '.' only removes
        const vcmdValue = text.substring(5).trim();
        if (vcmdValue.length) voiceCommand = (vcmdValue == '.') ? '' : vcmdValue;
        chatStateVar = 5; // Warte auf sendeNachricht
        addMessage('.vcmd: ' + voiceCommand, 'bot info');
        textEingabe.value = '';
        return;
    }
    if (text.startsWith('.pcmd')) { // '.' only removes
        const pcmdValue = text.substring(5).trim();
        if (pcmdValue.length) personaCommand = (pcmdValue == '.') ? '' : pcmdValue;
        chatStateVar = 5; // Warte auf sendeNachricht
        addMessage('.pcmd: ' + personaCommand, 'bot info');
        textEingabe.value = '';
        return;
    }

    if (userCredits <= 0) {
        addMessage(ll('No more credits!'), 'bot error');
        chatStateVar = 5; // Warte auf sendeNachricht
        textEingabe.value = '';
        return;
    }

    addMessage(text, 'user'); // User-Meldung anzeigen
    theNewMessage = addMessage(` ${ll('Wait')}...`, 'bot spinner');
    chatStateVar = 4; // Warte auf Server-Antwort
    talkWithServer(text, persona, theNewMessage); // async
    textEingabe.value = '';
}
// Background Monitor - alle ca. 100 msec
let chatStateVar = 0;     // 0: idle - darf extern mod. werden!
function periodical() {
    if (dbgLevel > 1) dbgAudioStatus.textContent = `chatStateVar: ${chatStateVar} ${isLoggedIn ? '(logged in)' : '(not logged in)'} Credits: ${userCredits}`;

    switch (chatStateVar) {
        case 0: // idle
            break;
        case 1: // Audio-Input im stdPlayer vorhanden - Start Transcribe!
            chatStateVar = 2;
            setChatStatus(ll('Understand...'), 'yellow');
            postAudio();
            break;
        case 2: // idle warten waehrend transcribiert
            break;
        case 3: // 
            setChatStatus(ll('Understood!'), 'yellow');
            if (autoPostChk.checked) {
                sendeNachricht(); // impl setzt chatStateVar=4
            } else {
                chatStateVar = 10; // Gleich weiter
            }
            break;
        case 4: // Erwarte sendeNachricht - Antwort
            // todo
            break;

        case 5: // Erwarte sendeNachricht - Plop & Say 
            chatStateVar = 6;
            safePlay(audioFxPlop);
        // intentional fallthrough
        case 6: // Verarbeitet
            checkAndPlayAudio();
            break;

        case 9: // Alles Abbrechen während sendeNachricht
            setChatStatus(ll('Stop...'), 'orange');
            audioPlayer.pause();
            audioCache = [];
            chatStateVar = 10; // Gleich weiter
            isLoading = false;
            // ERROR - frq_ping(220, 0.1, 0.1);
            break;

        case 10: // **Erwarte sendeNachricht**
            safePlay(audioFxClick);
            setSendButtonGlyph('ready');
            setChatStatus(ll('I have said all.'), 'yellow');
            chatStateVar = 0; // Zuruecksetzen
            microStatus = 1; // Micro wieder bereit
            break;

        default:
            dbgPrint('ERROR: chatStateVar:' + chatStateVar);
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
        dbgPrint('ERROR(audioPlayerA): ' + error);
        setChatStatus('ERROR(audioPlayerA): ' + error, 'red');
        isLoading = false;
    });
}

// Alte URL freigeben wenn Audio beendet ist. Problem z.B. Failure bie falschem Audio-Format
audioPlayer.onended = function () {
    if (playAudioUrl) {
        URL.revokeObjectURL(playAudioUrl);
        playAudioUrl = null;
    }
    isLoading = false;
};
audioPlayer.onerror = function (error) {
    const errorMsg = error?.currentTarget?.error?.message ?? 'Unknown';
    dbgPrint('ERROR(audioPlayerB): ' + errorMsg);
    setChatStatus('ERROR(audioPlayerB): ' + errorMsg, 'red');
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
        dbgPrint(`Play - verbleibende Dateien: ${audioCache.length}`);
    }).catch(err => {
        dbgPrint('Fehler beim Abspielen: ' + err.message);
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
async function fetchAudioForSentence(sentence, voice, cache = false) {
    dbgPrint(`Satz: '${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}'`);
    const methodGET = (audioPlayer.paused === true) && (audioCache.length === 0) && (isLoading === false);

    const formData = new FormData();
    let url = null;
    if (!methodGET) {
        formData.append('text', sentence);
        formData.append("voice", voice);
        formData.append('sessionId', apiSessionId);
        formData.append('user', apiUser);
        formData.append('stream', '1');
        if (cache) formData.append('cache', '1');
        if (voiceCommand.length) formData.append('vcmd', voiceCommand);
    } else {
        url = `./api/oai_tts.php?`;
        url += `text=${encodeURIComponent(sentence)}`;
        url += `&voice=${encodeURIComponent(voice)}`;
        url += `&sessionId=${encodeURIComponent(apiSessionId)}&stream=1`;
        url += `&user=${encodeURIComponent(apiUser)}`;
        if (voiceCommand.length) url += `&vcmd=${encodeURIComponent(voiceCommand)}`;
        if (cache) url += `&cache=1`;
        isLoading = true;
    }
    try {
        if (!isLoggedIn) throw new Error("Not logged in!");
        if (methodGET) {
            dbgPrint(`Lade Audio via GET/src...`);
            audioPlayer.src = url;
            audioPlayer.load();
        } else {
            dbgPrint(`Lade Audio via POST/cache...`);
            const response = await fetch("./api/oai_tts.php", { method: "POST", body: formData });
            const contentType = response.headers.get('content-type');

            // Prüfen ob Audio oder Fehler
            if (response.ok && contentType && contentType.includes('audio')) {
                const audioBlob = await response.blob();
                audioCache.push(audioBlob);
                dbgPrint(`Audio für Satz geladen: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`);
            } else {
                // Fehler als Text oder JSON
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    dbgPrint(`ERROR(JSON): ${JSON.stringify(errorJson)}`);
                } catch {
                    dbgPrint(`ERROR(TEXT): ${errorText.substring(0, 100)}`);
                }
            }
        }
    } catch (error) {
        if (methodGET) isLoading = false;
        dbgPrint(`ERROR(Server) Scentence:"${sentence.substring(0, 50)}...": ${error.message}`);
    }
}

// Hauptfunktion zum Verarbeiten des Textes
async function speakText(inputText, cache = false) {
    if (isProcessing) {
        return;
    }
    if (inputText.length === 0) {
        dbgPrint('Kein Text eingegeben!');
        return;
    }
    isProcessing = true;
    setChatStatus(ll("I am talking"), 'skyblue');

    try {
        // Text normalisieren: Newlines und Tabs in Leerzeichen umwandeln
        const normalizedText = inputText.replace(/[\n\r\t]+/g, ' ');
        // Text in Sätze zerlegen
        const sentences = splitIntoSentences(normalizedText);
        dbgPrint(`Text in ${sentences.length} Sätze zerlegt`);

        // Jeden Satz verarbeiten
        const selectedVoice = speakVoice;  // Damit nicht aenderbar within Funktion
        for (let i = 0; i < sentences.length; i++) {
            await fetchAudioForSentence(sentences[i], selectedVoice, cache);
        }

        dbgPrint('Alle Sätze verarbeitet');
    } finally {
        isProcessing = false;
    }

}

// === MODSay - ENDE===

// ==== MODFetchAPI - START====
// Mit ChatServer reden/login - muss async sein, wg, fetch(), kann evtl. mitschreiben oder callback aufrufen oder beides..
// reguleren Chat mit Server
async function talkWithServer(text, persona, concerningMessage = null) {
    // Quasi Global für interne Verwendung
    lastServerText = null;
    lastServerMeta = null;

    const payload = {
        sessionId: apiSessionId,
        user: apiUser,
        lang: userLanguage,
        text: text,
        persona: persona
    };
    if (personaCommand.length) payload.pcmd = personaCommand; // Ggfs. Persona Command
    try {
        if (!isLoggedIn) throw new Error("Not logged in!");
        const response = await fetch('./api/oai_chat.php', {  // './api/echo_sim.php'
            method: 'POST',
            body: new URLSearchParams(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            dbgPrint(`POST failed: ${response.status} ${response.statusText}: ${errorText}`);
            if (concerningMessage) updateMessage(concerningMessage, `ERROR(ServerP3): ${response.status} ${response.statusText}: ${errorText}`, 'bot error');
            chatStateVar = -996;
            return;
        }
        const data = await response.json(); // Das ist noch nicht richtig schön, besser .text() -> JSON.parse() mit try/catch
        if (data.success) {
            let answerText = '?';
            // console.log('data:',data); // - Die Antwort der KI kann alles mögliche enthalten...
            try {
                answerText = (data?.result?.answer?.text ?? '(Keine Antwort)');
                lastServerText = answerText;
                if (data.result?.meta) {
                    lastServerMeta = data.result.meta;
                }
                if (data.credits !== undefined) {
                    userCredits = data.credits; // Update Credits
                }
                setCreditsDisplay();
            } catch (e) { }

            if (concerningMessage) {
                let plopText = answerText;
                if (dbgLevel && lastServerMeta) {
                    // JSON etwas kompakt formatieren
                    const metaString = JSON.stringify(lastServerMeta, null, 2).replace(/,\s*(?:\r?\n)/g, ", ").replace(/ {2,}/g, " ");
                    plopText += '<br><small><pre style="color: #00A; white-space: pre-wrap;">' + metaString + '</pre></small>';
                }
                updateMessage(concerningMessage, plopText, 'bot ok');
            }
            if (userCredits <= 0) {
                addMessage(ll('No more credits!'), 'bot error');
                concerningMessage = null;
                chatStateVar = -993;
            } else {
                speakText(answerText, false);    // Sprichs aus! (Ohne Cache)
                chatStateVar = 5; // Fertig, nun audio setzt auch 10
            }
        } else {
            if (concerningMessage) updateMessage(concerningMessage, 'ERROR: ' + (data.error || 'Unbekannter Fehler'), 'bot error');
            chatStateVar = -994;
        }
        dbgPrint('POST returned: ' + JSON.stringify(lastServerText)); // Nur Text reicht
    } catch (e) {
        dbgPrint('POST failed: ' + e.message);
        if (concerningMessage) updateMessage(concerningMessage, 'ERROR(ServerP4): ' + e.message, 'bot error');
        chatStateVar = -995;
    }
}

// Ausm STD-Player Audio holen und transkibe
async function postAudio() {
    try {
        if (userCredits <= 0) {
            addMessage(ll('No more credits!'), 'bot error');
            chatStateVar = -992;
            return;
        }

        const audioSrc = stdPlayer?.src;
        if (!audioSrc) {
            dbgPrint('ERROR: No audio src');
            chatStateVar = -999;
            return;
        }

        //if (dbgLevel>1) terminalPrint('Fetching audio data from player src...');
        if (!isLoggedIn) throw new Error("Not logged in!");
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const audioBlob = await res.blob();
        //if (dbgLevel>1) terminalPrint(`Posting audio (${audioBlob.size} bytes, ${audioBlob.type})...`);

        const apiUrl = './api/oai_stt.php';
        const formData = new FormData();
        formData.append('sessionId', apiSessionId);
        formData.append('user', apiUser);
        if (userLanguage !== undefined) formData.append('lang', userLanguage);
        formData.append('audio', audioBlob, 'recording' + (audioBlob.type.includes("ogg") ? ".ogg" : ".webm"));
        const postResponse = await fetch(apiUrl, { method: 'POST', body: formData });

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            dbgPrint(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${errorText}`);
            addMessage(`ERROR(ServerP2): ${postResponse.status} ${postResponse.statusText}: ${errorText}`, 'bot error');
            chatStateVar = -998;
            return;
        }
        const text = await postResponse.json(); // Das ist noch nicht richtig schön, besser .text() -> JSON.parse() mit try/catch
        const spoken = text.text;

        if (text.credits !== undefined) {
            userCredits = text.credits; // Update Credits
        }
        setCreditsDisplay();


        const oldText = textEingabe.value.trim();
        if (oldText.length > 0) {
            textEingabe.value = oldText + ' ' + spoken;
        } else {
            textEingabe.value = spoken;
        }
        dbgPrint('POST successful: ' + JSON.stringify(text));
        chatStateVar = 3; // Fertig

    } catch (e) {
        dbgPrint('POST failed: ' + e.message);
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
const MICRO_INIT_MS = 100; // msec Mikrofon-(Re-)Initialisierung
const MIN_LEN_SPEECH_MS = 1400; // msec min. Sprachdauer (heuristisch, inkl. Pausen)

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
    setChatStatus('Replay End', 'skyblue');
});

function addAudioChunk(data) {
    audioChunks.push(data);
    dbgPrint('Audio chunk: ' + data.size + ' bytes, Total Chunks: ' + audioChunks.length);
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

        const delaySeconds = STREAM_DELAY_SEC;
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
    safePlay(audioFxClick);

    if (!isMicroOn) {
        audioPlayer.pause();
        setSendButtonGlyph('ready');
        isLoading = false;

        startMicro();
        canvas.hidden = false;
        microOnOff.hidden = true;
        isMicroOn = true;
        isRecording = false;
        textEingabe.placeholder = ll('Speak or type your message...'); // Micro einschalten oder tippe deine Nachricht...
        microButtonGlyph.classList.remove('bi-mic-mute-fill');
        microButtonGlyph.classList.add('bi-mic-fill');
        microButtonGlyph.classList.add('jo-icon-ani-beat');
        setChatStatus(ll('Micro ON...'), 'yellow');
    } else {
        microOnOff.hidden = false;
        isMicroOn = false;
        canvas.hidden = true;

        stopMicro();
        textEingabe.placeholder = ll('Switch Micro on or type your message...'); // 'Sprich oder tippe deine Nachricht...';
        microButtonGlyph.classList.remove('jo-icon-ani-beat');
        microButtonGlyph.classList.remove('bi-mic-fill');
        microButtonGlyph.classList.add('bi-mic-mute-fill');
        setChatStatus(ll('Micro OFF'), 'lime');
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
    const mimeType = e?.target?.mimeType || mediaRecorder?.mimeType || "audio/webm";
    const blob = new Blob(audioChunks, { type: mimeType });
    const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + blob.type;
    dbgPrint("Audio recorded: " + info);
    const procAudioURL = window.URL.createObjectURL(blob);
    audioChunks = [];
    if (microStatus === 5) microStatus = 6; // Verarbeitet!
    stdPlayer.src = procAudioURL; // Das ist auch der temporaere Zwischenspeicher
}

// Sprach-Zustandsmaschine
let totalRms = 0;   // Statistik (dbgLevel 3) Bisher noch nicht verwendet
let frameCount = 0;
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;
    frameCount++;   // Statistik mitfuehren
    totalRms += frameRms; // integriere RMS

    if (dbgLevel > 1) dbgInfo.textContent = `microStatus: ${microStatus}  Dur: ${dur.toFixed(0)} msec`;
    if (isMenuVisible) {
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
        }
        microStatus = 1;
        setChatStatus(ll('Menu...'), 'yellow');
        return;
    }

    switch (microStatus) {
        case 1: // Zustand 1: MICRO_INIT msec lang AVG anlernen
            if (dur > MICRO_INIT_MS) {
                microStatus = 2;
                setChatStatus(ll('I am listening...'), 'yellow');
            }
            break;

        case 2: // Zustand 2: Warten auf Sprache
            if (frameRms > thresholdRms) { // Sprache erkannt
                if (mediaRecorder.state === "inactive") {
                    mediaRecorder.start();
                    isRecording = true;
                    frameCount = 0;
                    totalRms = frameRms;
                }
                microStatus = 3;
                speechStateTime0 = performance.now();
                speechStartTime = speechStateTime0; // Fuer Alles und Pausen
                setChatStatus(ll('I am listening...'), 'lime');
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
                    dbgPrint(`Speech Max Length reached (${speechTotalDur} msec), stopping.`);
                } else {
                    dbgPrint(`Speech End (${speechTotalDur} msec)`);
                }
                setChatStatus(ll('I have said all.'), 'yellow');
                dbgPrint(`Stats: Frames:${frameCount}/${speechTotalDur} ms, T.RMS:${totalRms.toFixed(4)}, Avg RMS:${(totalRms / frameCount).toFixed(4)}, T./RMS:${(totalRms / thresholdRms).toFixed(4)}`);
                if (dbgLevel > 2) { // OPtional immer abspielen zum Testen
                    microStatus = 7;
                    stdPlayer.play(); // Zum Testen immer abspielen            
                    if (dbgLevel > 2) {
                        microStatus = 1; // Zuruecksetzen
                    }
                } else microStatus = 8; // Direkt fertig
            } else {
                dbgPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
                microStatus = 1; // Zuruecksetzen
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
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
        }
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
    minRms = 0.999 * minRms + 0.001 * sliderThreshold;
    if (frameRms < minRms) minRms = frameRms;
    if (autoThreshEnable) thresholdRms = minRms * 5 + 0.025; // Etwas Puffer
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
        setChatStatus(ll('Micro ready'), 'lime');
        textEingabe.placeholder = ll('Switch Micro on or type your message...'); // 'Sprich oder tippe deine Nachricht...';

    })
    .catch(() => {
        setChatStatus(ll('Micro locked'), 'red');
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

const audioFxClick = new Audio('./static/soundfx/click.opus');
const audioFxPlop = new Audio('./static/soundfx/msg_pop.opus');

// Wake Lock: Keep screen ON - request fails usually system-related, such as low battery.
async function requestWakeLock() {
    try {
      /*const wakeLock =*/ await navigator.wakeLock.request("screen");
    } catch (err) {
        addMessage(`WARNING: Screen-Lock: ${err.message}`, 'bot error');
    }
}

// Erstmal alle entfernen, dann bei Bedarf setzen
function setSendButtonGlyph(id) {
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

function setChatStatus(s, color = 'silver') {
    statusEl.textContent = s;
    statusEl.style.backgroundColor = color;
    microBtn.style.setProperty("--scolor", color);
}

// Eine Nachricht im regulaeren User-Fenster mit Klasse zufügen
// Verzierungsmoeglichkeiten 'user'/'bot' + opt. 'ok', 'info', 'error' als string
function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = text;

    chatVerlauf.appendChild(messageDiv);
    setTimeout(() => {
        chatVerlauf.scrollTop = chatVerlauf.scrollHeight;
    }, 100);

    return messageDiv;
}
// Fuer nachtraegliche Aenderung
function updateMessage(messageDiv, text, type) {
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = text;
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
    safePlay(audioFxClick);
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
if (dbgLevel > 1) {
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
    removeCredentials();
    location.reload(); // Seite neu laden
});

function removeCredentials() {
    localStorage.removeItem('minichat-username');
    localStorage.removeItem('minichat-sessionid');
    sessionStorage.removeItem('minichat-temp-password');
}

function saveCredentialsToLocalStorage() {
    localStorage.setItem('minichat-username', apiUser);
    localStorage.setItem('minichat-sessionid', apiSessionId);
}
function getCredentialsFromLocalStorage() {
    const username = (localStorage.getItem('minichat-username') || '').trim();
    const sessionId = (localStorage.getItem('minichat-sessionid') || '').trim();
    if (username.length > 5) apiUser = username; // Mind 6 Zeichen USER
    if (sessionId.length === 32) apiSessionId = sessionId; // SesssionID 16 Bytes
    const password = (sessionStorage.getItem('minichat-temp-password') || '').trim();
    if(password.length >=8) apiTempPassword = password; // Mind 8 Zeichen PASS
}

async function login(cmd = '', luser = '', lpassword = '', lsessionId = '', statusElement = null) {
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
            dbgPrint(`POST failed: ${response.status} ${response.statusText}: ${errorText}`);
            if (statusElement) statusElement.textContent = `Login failed: ${response.status} ${response.statusText}: ${errorText}`;
            return false;
        }
        const data = await response.json(); // Das ist noch nicht richtig schön, besser .text() -> JSON.parse() mit try/catch
        if (data.success && luser === data.user) {
            if (data.role) {
                addMessage(`Invalid User '${data.user}' (Role: ${data.role})`, 'user error');
                await jsSleepMs(1000);
                return false;
            }
            apiSessionId = data.sessionId;
            if (apiUser !== data.user) { throw new Error('apiUser/data.user'); }
            userNameDisplay.textContent = apiUser;
            userLanguage = data.userLang;
            speakVoice = data.speakVoice;
            const nHelpTexts = data.helpTexts;
            if (nHelpTexts?.length > 0) helpTxts = nHelpTexts;
            persona = data.persona;
            if (data.intro?.length) introText = data.intro;
            userCredits = data.creditsAvailable;
            userCredits0 = userCredits;

            setCreditsDisplay();
            // OK
            isLoggedIn = true;
            sendenBtn.disabled = false;

            return true;
        }
        dbgPrint('POST returned: ' + JSON.stringify(data));
    } catch (e) {
        dbgPrint('POST failed: ' + e.message);
    }
    return false;
}

let try2Login = false;
const loginStatus = document.getElementById('login-error');
const credentialsDialog = document.getElementById('credentials');

document.getElementById('btn-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const hApiUser = document.getElementById('input-user').value.trim();
    const hApiTempPassword = document.getElementById('input-password').value.trim();
    if (hApiUser.length < 6 || hApiTempPassword.length < 8) {
        loginStatus.textContent = 'Benutzername mindestens 6 Zeichen, Passwort mindestens 8 Zeichen!';
        return;
    }
    apiUser = hApiUser;
    apiTempPassword = hApiTempPassword;
    try2Login = true;
});

async function mainLogin() {
    let logcnt = 0;
    let res = false;
    if (apiUser.length >= 6 && apiSessionId.length === 32) {
        res = await login('logrem', apiUser, '', apiSessionId, null); // Test-Login: true: ALles OK
    }
    if(res === false) { 
        // Input-Werte setzen
        document.getElementById('input-user').value = apiUser;
        document.getElementById('input-password').value = apiTempPassword;
        if(apiTempPassword.length>=6) try2Login=true;
        credentialsDialog.onclose = () => {
            if (!isLoggedIn) {  // Dislog hat seltsames Auto-Close Verhalten
                credentialsDialog.showModal(); // Nochmal zeigen
            }   
        };
        credentialsDialog.showModal();
        // Warten bis Login erfolgreich
        for (; ;) {
            if (try2Login === true && apiUser.length >= 6 && apiTempPassword.length >= 8) {
                loginStatus.textContent = 'Anmeldung läuft...';
                res = await login('login', apiUser, apiTempPassword, '', null); // Voller Login
                if (res === true) break;
                loginStatus.textContent = `Login fehlgeschlagen! (${++logcnt})`;
                try2Login = false; // Zurücksetzen für erneuten Versuch
            }
            await jsSleepMs(100);
        }
        credentialsDialog.close();
    }
    saveCredentialsToLocalStorage();
    requestWakeLock(); // Screen ON
    //addMessage(`Verfügbare Credits: ${userCredits<0?'0':userCredits}`, 'bot info');
    I18.i18localize(userLanguage);  
    if (introText) {
        addMessage(introText, 'bot info');
        // Remove all emojis, clip at '<', normalize whitespace
        const pureIntro = introText
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, '')
            .split('<')[0]
            .replace(/\s+/g, ' ')
            .trim();
        helpTxts.unshift(pureIntro);
    }
}

// I.d.R: Session gespeichert
I18.i18localize(navigator.language || navigator.userLanguage);
getCredentialsFromLocalStorage();
mainLogin();

// === ENDE MODLogin ===

console.log('MiniChat:', VERSION);
