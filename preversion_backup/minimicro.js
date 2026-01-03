/*** minimicro.js fuer minichat */

// Imports
import { API_PASSWORD, API_USER, USER_LANG, addMessage } from './minichat.js';
import * as TB from './minitools.js';

//--------- globals ------ 

// Locals
const VERSION = 'V0.0x / xx.xx.2025';
const COPYRIGHT = '(C)JoEmbedded.de';

// Intern
const microBtn = document.getElementById('btn-micro');
const microButtonGlyph = document.getElementById('micro-button-glyph');
const statusEl = document.getElementById('micro-status');

// Hidden wenn nicht Debug
const stdPlayer = document.querySelector(".stdplayer");
const dbgInfo = document.getElementById('dbginfo');

const thresholdSlider = document.getElementById('threshold');
const thresholdFeedback = document.getElementById('thresholdFeedback');
const maxpauseSlider = document.getElementById('maxpause');
const maxpauseFeedback = document.getElementById('maxpauseFeedback');

const canvas = document.querySelector(".visualizer");
const canvasCtx = canvas.getContext("2d");

const textEingabe = document.getElementById('text-eingabe');

let isMicroOn = false; // Flag absolut Micro

// Helpers fuer Microfondaten und Analyse
let analyser = null;
let stream = null;
let delayedStream = null;
let audioCtx = null;
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
const MICRO_INIT_MS = 100; // msec Mikrofon-(Re-)Initialisierung
const MIN_LEN_SPEECH_MS = 250; // msec min. Sprachdauer

let speechState = 0; // Sprach-Zustandsmaschine
let speechStateTime0; // Zeitstempel Sprachbeginn

let speechStartTime;
let speechTotalDur;
let audioChunks = [];

let isPlaying = false;
export function setIsPlaying(flag) {    // Externes Play stoppt Micro
    if (flag === true) {
        setStatus('Play...', 'skyblue');
        isPlaying = true;
    } else {
        setStatus('Play Ende...', 'gray');
        isPlaying = false;
    }
}
export function getIsPlaying() {
    return isPlaying;
}

let hasInput = 0;   // 1: Input vorhanden 2: verarbeitet

function addAudioChunk(data) {
    audioChunks.push(data);
    TB.terminalPrint('Audio chunk: ' + data.size + ' bytes, Total Chunks: ' + audioChunks.length);
}


async function startMicro() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        if (audioCtx.state !== "running") await audioCtx.resume();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048; // keine FFT, hier nur Zeitbereich
        dataArray = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        const delaySeconds = STREAM_DELAY_SEC
        const delayNode = audioCtx.createDelay(delaySeconds); // Def. ist 1
        delayNode.delayTime.value = delaySeconds; // sec
        const destination = audioCtx.createMediaStreamDestination();
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
        speechState = 0;
        speechStateTime0 = performance.now();
        audioChunks = [];

        frameMonitor();
    } catch (e) {
        console.error('ERROR:', e);
        setStatus('ERROR: ' + e.message, 'red');
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
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
}

function microBtnCLick() {
    if (!isMicroOn) {
        TB.frq_ping();
        startMicro();
        isMicroOn = true;
        isPlaying = false;
        hasInput = 0;
        microButtonGlyph.classList.remove('bi-mic-mute-fill');
        microButtonGlyph.classList.add('bi-mic-fill');
        setStatus('Init...', 'yellow');
    } else {
        isMicroOn = false;
        stopMicro();
        TB.frq_ping();
        microButtonGlyph.classList.remove('bi-mic-fill');
        microButtonGlyph.classList.add('bi-mic-mute-fill');

        setStatus('Micro AUS', 'silver');
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
async function processAudio(e) {
    if (isMicroOn && (speechTotalDur > (MIN_LEN_SPEECH_MS+maxPauseMs))) {
        hasInput = 1; // Ok
        setStatus('Verstehe...', 'skyblue');

        const blob = new Blob(audioChunks, { type: USE_MIME_BLOB });
        audioChunks = [];
        const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + USE_MIME_BLOB;
        TB.terminalPrint("Audio recorded: " + info);
        const audioURL = window.URL.createObjectURL(blob);
        stdPlayer.src = audioURL;
        stdPlayer.play();
        // await postAudio();
        setStatus('Antworte...', 'skyblue');

    } else audioChunks = []; // Verwerfen
}

// Sprach-Zustandsmaschine
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;
    dbgInfo.textContent = `State: ${speechState}  Dur: ${dur.toFixed(0)} msec isPlaying: ${isPlaying}`;
    if (speechState === 0) {    // Zustand 0: MICRO_INIT msec lang AVG anlernen
        if (dur > MICRO_INIT_MS && !isPlaying && !hasInput) {
            speechState = 1;
            setStatus('Bereit...', 'yellow');
        }
    } else if (speechState === 1) { // ** Zustand 1 **: Warten auf Sprache
        if (frameRms > thresholdRms && !isPlaying && !hasInput) { // Sprache erkannt
            if (mediaRecorder.state === "inactive") mediaRecorder.start();
            speechState = 2;

            speechStateTime0 = performance.now();
            speechStartTime = speechStateTime0; // Fuer Alles und Pausen
            setStatus('Spricht', 'lime');
        }
    } else if (speechState === 2) { // Zustand 2: Sprache laeuft
        if (frameRms < thresholdRms / 2) {   // Als Pause erkannt
            speechState = 3;
            speechStateTime0 = performance.now();
            setStatus('Sprachpause', 'lightgreen');
        } else {
            speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
            if (speechTotalDur > MAX_SPEACH_MS) { // Max. Dauer erreicht
                TB.terminalPrint(`Speech Max Length reached (${speechTotalDur} msec), stopping.`);
                speechStateTime0 = performance.now();
                speechState = 0;
                mediaRecorder.stop();
            }
        }
    } else if (speechState === 3) { // Zustand 3: In Sprachpause
        if (frameRms > thresholdRms) {
            speechState = 2;
            setStatus('Spricht weiter', 'lime');
        } else if (dur > maxPauseMs) { // Pause laenger als x sec => Ende
            speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
            mediaRecorder.stop();
            if (speechTotalDur > MIN_LEN_SPEECH_MS) {
                TB.terminalPrint(`Speech End (${speechTotalDur} msec)`);
            } else {
                TB.terminalPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
            }
            speechStateTime0 = performance.now();
            speechState = 0;
        }
    }
}

// === GUI-Elemente ===
// Animation-Frame, monitored Micro-Daten
let maxRms = 0;
function frameMonitor() {
    frameMoniId = requestAnimationFrame(frameMonitor);
    if (!isMicroOn) return;
    analyser.getByteTimeDomainData(dataArray);
    const frameRms = computeRMSFromTimeDomain(dataArray);
    maxRms *= 0.9;
    if (frameRms > maxRms) maxRms = frameRms;
    updateSpeechState(maxRms);
    bloomMicroButton(((maxRms / thresholdRms) - 0.5) * 3);
    // Zeichnen
    const w = canvas.width, h = canvas.height;
    // Hintergrund
    canvasCtx.fillStyle = 'silver';
    canvasCtx.fillRect(0, 0, w, h);
    const jusColor= maxRms < thresholdRms ? 'yellow' : 'lime';
    canvasCtx.fillStyle = jusColor;
    canvasCtx.fillRect(0, 0, maxRms * w * 3, h);
    canvasCtx.fillStyle = "black"  ;
    canvasCtx.fillRect(thresholdRms*w*3,0, 2, h);

}

// Kleine Status-SPAN
function setStatus(s, color = 'silver') {
    statusEl.textContent = s;
    statusEl.style.backgroundColor = color;
    microBtn.style.setProperty("--scolor", color);
}
export function getMicroInputStatus() {
    return hasInput;
}
export function resetMicroInputStatus() {
    hasInput = 0;
    setStatus('Bereit...', 'yellow');
}


// Bloom-Button-Rahmen
function bloomMicroButton(bloomTh) {
    const width = bloomTh < 0 ? 0 : bloomTh > 15 ? 15 : bloomTh;
    microBtn.style.setProperty("--spread", `${width}px`);
}

// Audio aus ELement Posten
export async function postAudio() {
    try {
        const audioSrc = stdPlayer?.src;
        if (!audioSrc) {
            TB.terminalPrint('ERROR: No audio src');
            return;
        }
        TB.frq_ping(880);

        //TB.terminalPrint('Fetching audio data from player src...');
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const audioBlob = await res.blob();
        //TB.terminalPrint(`Posting audio (${audioBlob.size} bytes, ${audioBlob.type})...`);

        const apiUrl = './api/oai_stt.php';
        const formData = new FormData();
        formData.append('apipw', API_PASSWORD);
        if (API_USER !== undefined) formData.append('user', API_USER);
        if (USER_LANG !== undefined) formData.append('lang', USER_LANG);
        formData.append('audio', audioBlob, 'recording' + useExtension);
        const postResponse = await fetch(apiUrl, { method: 'POST', body: formData });

        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            TB.terminalPrint(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${errorText}`);
            addMessage(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${errorText}`, 'bot error');
            hasInput = 0;
            return;
        }
        const text = await postResponse.json();
        const spoken = text.text || text;
        textEingabe.value = spoken;
        TB.terminalPrint('POST successful: ' + JSON.stringify(text));
        if (document.getElementById('autoPostChk').checked) {
            const event = new Event('click');
            document.getElementById('btn-senden').dispatchEvent(event);
        }
    } catch (e) {
        TB.terminalPrint('POST ERROR: ' + e.message);
        addMessage('POST ERROR: ' + e.message, 'bot error');
        hasInput = 0;
    }
}


//=== Init ===
try {
    TB.terminalPrint(`Version: ${VERSION}`);
    stdPlayer.addEventListener('play', () => {
        TB.frq_ping(880);
        setStatus('Play...', 'skyblue');
        isPlaying = true;
    });
    stdPlayer.addEventListener('ended', () => {
        TB.frq_ping(1760);
        setStatus('Play Ende...', 'gray');
        isPlaying = false;
    });

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
            setStatus('Micro OK', 'limegreen');
            microBtn.disabled = false;
            microBtn.addEventListener('click', microBtnCLick);
            thresholdSlider.disabled = false;
            maxpauseSlider.disabled = false;
        })
        .catch(() => {
            setStatus('Kein Zugriff', 'red');
        });
} catch (e) {
    TB.terminalPrint("ERROR: " + e.message);
}
console.log('Minimicro Version:', VERSION);

/***/
