/*** main.js 
*/

// Imports


//--------- globals ------ 
export const VERSION = 'V0.0x / xx.xx.2025';
export const COPYRIGHT = '(C)JoEmbedded.de';

// Intern
const microBtn = document.querySelector(".micro");
const statusEl = document.getElementById('status');
const canvas = document.querySelector(".visualizer");
const canvasCtx = canvas.getContext("2d");
const stdPlayer = document.querySelector(".stdplayer");
const postBtn = document.querySelector(".postbtn");

let isMicroOn = false; // Flag absolut Micro

// Helpers fuer Microfondaten und Analyse
let analyser = null;
let stream = null;
let audioCtx = null;
let dataArray = null;
let frameMoniId = null;
let mediaRecorder = null;
const useMime = 'audio/webm;codecs=opus';
// rms Statistik

let thresholdFact = 4.0; // Wenn frameRMS > x * average => Speec
let averageRms = 0; // Anfangswert

const MICRO_INIT = 250; // msec Mikrofon-Initialisierung
const MAX_PAUSE = 750; // msec max. Sprachpause
const MIN_LEN = (200 + MAX_PAUSE); // msec min. Sprachdauer
let speechState = 0; // Sprach-Zustandsmaschine
let speechStateTime0; // Zeitstempel Sprachbeginn

let recordAudio = false;
let speechStartTime;
let speechTotalDur;
let audioChunks = [];
let isPlaying = false;
let lastPauseIdx = -1;

// Problematik der Pre-Junks:
//  Chunk 0 enthält wichtige Informationen und darf nicht gelöscht werden.
// Ohne Pre-Junks (= 0) evtl. Probleme bei 1. Silbe. Bei 2 sind recht genau 200 msec Trailer
const PRE_CHUNKS = 2; //n Chunks vor Sprache merken

function addAudioChunk(data) {
    if (!recordAudio) {
        if (audioChunks.length > PRE_CHUNKS) audioChunks.splice(1, 1);
    }
    audioChunks.push(data);
    //console.log('Audio chunk:', data.size, 'bytes', "Total Chunks:", audioChunks.length);
}

async function startMicro() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: useMime });
        mediaRecorder.ondataavailable = (e) => {
            addAudioChunk(e.data);
        };
        mediaRecorder.onstop = processAudio;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048; // keine FFT, hier nur Zeitbereich
        dataArray = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
        speechState = 0;
        speechStateTime0 = performance.now();
        averageRms = 0;
        recordAudio = false;
        audioChunks = [];
        if (PRE_CHUNKS) mediaRecorder.start(100);
        frameMonitor();
    } catch (e) {
        console.error('ERROR:', e);
        setStatus('ERROR: ' + e.message, 'red');
    }
}
function stopMicro() {
    if (frameMoniId) cancelAnimationFrame(frameMoniId);
    frameMoniId = null;

    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        stream = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder = null;
    }
}

function microBtnCLick() {
    if (!isMicroOn) {
        frq_ping();
        startMicro();
        isMicroOn = true;
        microBtn.textContent = 'Micro ist AN';
        setStatus('Micro init...', 'yellow');
    } else {
        isMicroOn = false;
        stopMicro();
        frq_ping();
        microBtn.textContent = 'Micro ist AUS';
        setStatus('Microphone off', 'silver');
    }
}

// Ping-Helper
let acx = null;
function frq_ping(frq = 440, dura = 0.1, vol = 0.05) { // Helper, extern available
    if (!acx) acx = new AudioContext()
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

// Process Audio - Audio-Chunks zu einem Blob zusammenfassen und senden
function processAudio(e) {
    if (isMicroOn) {
        const maxChunks = Math.max(lastPauseIdx +1 , PRE_CHUNKS * 2); // Pause hinten kappen
        const blobChunks = audioChunks.slice(0, maxChunks);
        const blob = new Blob(blobChunks, { type: useMime });
        audioChunks = [];
        const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + useMime;
        terminalPrint("Audio recorded: " + info);
        const audioURL = window.URL.createObjectURL(blob);

        stdPlayer.src = audioURL;
        stdPlayer.play();
    }
}

// Sprach-Zustandsmaschine
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;
    const threshold = averageRms * thresholdFact;

    if (speechState === 0) {    // Zustand 0: MICRO_INIT msec lang AVG anlernen
        if (averageRms < frameRms) averageRms = frameRms;
        if (dur > MICRO_INIT) {
            speechState = 1;
            setStatus('Listening...', 'yellow');
        }
    } else if (speechState === 1) { // ** Zustand 1 **: Warten auf Sprache
        if (frameRms > threshold && !isPlaying) { // Sprache erkannt
            if (!PRE_CHUNKS && mediaRecorder.state === "inactive") mediaRecorder.start();
            speechState = 2;
            recordAudio = true;
            speechStateTime0 = performance.now();
            speechStartTime = speechStateTime0; // Fuer Alles und Pausen
            setStatus('Speech Start', 'lightgreen');
        }
    } else if (speechState === 2) { // Zustand 2: Sprache laeuft
        if (frameRms < threshold / 2) {   // Als Pause erkannt
            speechState = 3;
            speechStateTime0 = performance.now();
            lastPauseIdx = audioChunks.length;  // Merke Index der Pause
            setStatus('Speech Pause', 'orange');
        }
    } else if (speechState === 3) { // Zustand 3: In Sprachpause
        if (frameRms > threshold) {
            speechState = 2;
            setStatus('Speech Resume', 'lightgreen');
        } else if (dur > MAX_PAUSE) { // Pause laenger als x sec => Ende
            speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
            if (speechTotalDur > MIN_LEN) {
                //terminalPrint(`Speech End (${speechTotalDur} msec)`);
                mediaRecorder.stop();
            } else {
                terminalPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
            }
            speechStateTime0 = performance.now();
            speechState = 0;
            recordAudio = false;
            if (PRE_CHUNKS && mediaRecorder.state === "inactive") mediaRecorder.start(100);
        }
    }
}

// === GUI-Elemente ===
// Animation-Frame, monitored Micro-Daten
function frameMonitor() {
    frameMoniId = requestAnimationFrame(frameMonitor);
    if (!isMicroOn) return;
    analyser.getByteTimeDomainData(dataArray);
    const frameRms = computeRMSFromTimeDomain(dataArray);
    if (!recordAudio) averageRms = (averageRms * 0.99) + (frameRms * 0.01);
    updateSpeechState(frameRms);

    bloomMicroButton(((frameRms / averageRms + 0.01) - 2) * 3);
    // Zeichnen
    const w = canvas.width, h = canvas.height;
    // Hintergrund
    canvasCtx.fillStyle = '#fafafa';
    canvasCtx.fillRect(0, 0, w, h);

    canvasCtx.fillStyle = 'lime';
    canvasCtx.fillRect(10, 0, frameRms * w * 3, 10);
    canvasCtx.fillStyle = 'grey';
    canvasCtx.fillRect(10, 15, averageRms * w * 3, 10);

    // Text
    canvasCtx.fillStyle = 'black';
    canvasCtx.font = '14px system-ui';
    canvasCtx.fillText(`RMS:${frameRms.toFixed(3)}  AVG:${averageRms.toFixed(3)}`, 10, 40);

}

// Kleine Status-SPAN
function setStatus(s, color = 'silver') {
    statusEl.textContent = s;
    statusEl.style.backgroundColor = color;
    microBtn.style.setProperty("--scolor", color);
}

// Bloom-Button-Rahmen
function bloomMicroButton(bloomTh) {
    const width = bloomTh < 0 ? 0 : bloomTh > 20 ? 20 : bloomTh;
    microBtn.style.setProperty("--spread", `${width}px`);
}

// Audio aus ELement Posten
async function postAudio() {
    try {
        const audioSrc = stdPlayer?.src;
        if (!audioSrc) {
            terminalPrint('ERROR: No audio src');
            return;
        }

        //terminalPrint('Fetching audio data from player src...');
        const res = await fetch(audioSrc);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const audioBlob = await res.blob();
        //terminalPrint(`Posting audio (${audioBlob.size} bytes, ${audioBlob.type})...`);

        const apiUrl = './api/oai_stt.php';
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const postResponse = await fetch(apiUrl, { method: 'POST', body: formData });

        const text = await postResponse.text();
        if (!postResponse.ok) {
            terminalPrint(`POST failed: ${postResponse.status} ${postResponse.statusText}: ${text}`);
            return;
        }

        terminalPrint('POST successful: ' + text);
    } catch (e) {
        terminalPrint('POST ERROR: ' + e.message);
    }
}

// =======Terminal-Emulation=======
const TERMINAL_LINES = 25; // Default
let terminal_lines = TERMINAL_LINES; // Real
let terminalContent = [];
const terminalEl = document.querySelector(".terminal");

function terminalPrint(txt) {
    if (txt !== undefined) terminalContent.push(txt);
    else terminalContent[0] = '*** Terminal ***';
    while (terminalContent.length > terminal_lines) terminalContent.shift();
    terminalEl.innerText = terminalContent.join('\n');
}

//=== Init ===
try {
    terminalPrint(`Version: ${VERSION}`);
    stdPlayer.addEventListener('play', () => {
        frq_ping(880);
        setStatus('Playing...', 'skyblue');
        isPlaying = true;
    });
    stdPlayer.addEventListener('ended', () => {
        frq_ping(1760);
        setStatus('Play ended...', 'gray');
        isPlaying = false;
    });
    postBtn.addEventListener('click', postAudio);
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            setStatus('Microphon access allowed', 'lightgreen');
            microBtn.disabled = false;
            microBtn.addEventListener('click', microBtnCLick);

        })
        .catch(() => {
            setStatus('Microphone access denied', 'red');
        });
} catch (e) {
    terminalPrint("ERROR: " + e.message);
}

/***/
