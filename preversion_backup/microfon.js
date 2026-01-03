/*** microfon.js */

// Imports


//--------- globals ------ 
export const VERSION = 'V0.0x / xx.xx.2025';
export const COPYRIGHT = '(C)JoEmbedded.de';

// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***
const API_PASSWORD = 'Leg1310LX'; //  
const API_USER = 'Juergen'; // Test special chars
const USER_LANG = 'de-DE';
// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***

// Intern
const microBtn = document.querySelector(".micro");
const statusEl = document.getElementById('status');
const canvas = document.querySelector(".visualizer");
const canvasCtx = canvas.getContext("2d");
const stdPlayer = document.querySelector(".stdplayer");
const postBtn = document.querySelector(".postbtn");
const dbgInfo = document.getElementById('dbginfo');

const thresholdSlider = document.getElementById('threshold');
const thresholdFeedback = document.getElementById('thresholdFeedback');
const maxpauseSlider = document.getElementById('maxpause');
const maxpauseFeedback = document.getElementById('maxpauseFeedback');


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
//const useMimeStream =  'audio/webm; codecs=opus' oder 'audio/mp4'; 
// ...fuer den Audio-BLOB nötig. Dateigroessen sind fast identisch:
//const useMimeBlob =  'audio/ogg; codecs=opus';
const useMimeBlob = 'audio/mpeg';

// rms Statistik
let thresholdRms = 0.1; // 0.1: Laute umgebung - Ext. via Slider
let maxPauseMs = 1000; // >200 , msec max. Sprachpause - Ext. via Slider
const maxlenMs = 30000; // msec max. Sprachdauer

const MICRO_INIT = 100; // msec Mikrofon-(Re-)Initialisierung
const MIN_LEN = (200 + maxPauseMs); // msec min. Sprachdauer
let speechState = 0; // Sprach-Zustandsmaschine
let speechStateTime0; // Zeitstempel Sprachbeginn

let speechStartTime;
let speechTotalDur;
let audioChunks = [];

let isPlaying = false;

function addAudioChunk(data) {
    audioChunks.push(data);
    terminalPrint('Audio chunk: ' + data.size + ' bytes, Total Chunks: ' + audioChunks.length);
}

async function jsSleepMs(ms = 1) { // Helper
    let np = new Promise(resolve => setTimeout(resolve, ms))
    return np
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

        const delaySeconds = 0.2; // sec Delay, ca. 150 msec Vorlauf mind. 
        const delayNode = audioCtx.createDelay(delaySeconds); // Def. ist 1
        delayNode.delayTime.value = delaySeconds; // sec
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(delayNode);

        delayNode.connect(destination); // Das Ziel ist der verzögerte Stream
        delayedStream = destination.stream;

        const options = {};
        if (typeof useMimeStream !== 'undefined') {
            options.mimeType = useMimeStream;
            if (useMimeStream && !MediaRecorder.isTypeSupported(useMimeStream)) throw new Error(`MIME-Type not supported: ${useMimeStream}`);
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
        frq_ping();
        startMicro();
        isMicroOn = true;
        isPlaying = false;

        microBtn.textContent = 'Micro ist AN';
        setStatus('Micro init...', 'yellow');
    } else {
        isMicroOn = false;
        stopMicro();
        frq_ping();
        microBtn.textContent = 'Micro ist AUS';
        setStatus('Microphone off', 'silver');
        bloomMicroButton(0);
    }
}

// Ping-Helper
let acx = null;
function frq_ping(frq = 440, dura = 0.2, vol = 0.07) { // Helper, extern available
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

// Process Audio - Audio-Chunks zu einem Blob zusammenfassen, wenn nicht zu kurz
function processAudio(e) {
    if (isMicroOn && (speechTotalDur > MIN_LEN)) {
        const blob = new Blob(audioChunks, { type: useMimeBlob });
        audioChunks = [];
        const info = "Len: " + blob.size + " bytes (" + speechTotalDur + " msec) " + useMimeBlob;
        terminalPrint("Audio recorded: " + info);
        const audioURL = window.URL.createObjectURL(blob);
        stdPlayer.src = audioURL;
        stdPlayer.play();
    } else audioChunks = []; // Verwerfen
}

// Sprach-Zustandsmaschine
function updateSpeechState(frameRms) {
    const dur = performance.now() - speechStateTime0;
    dbgInfo.textContent = `State: ${speechState}  Dur: ${dur.toFixed(0)} msec isPlaying: ${isPlaying}`;
    if (speechState === 0) {    // Zustand 0: MICRO_INIT msec lang AVG anlernen
        if (dur > MICRO_INIT && !isPlaying) {
            speechState = 1;
            setStatus('Listening...', 'yellow');
        }
    } else if (speechState === 1) { // ** Zustand 1 **: Warten auf Sprache
        if (frameRms > thresholdRms && !isPlaying) { // Sprache erkannt
            if (mediaRecorder.state === "inactive") mediaRecorder.start();
            speechState = 2;

            speechStateTime0 = performance.now();
            speechStartTime = speechStateTime0; // Fuer Alles und Pausen
            setStatus('Speech Start', 'lime');
        }
    } else if (speechState === 2) { // Zustand 2: Sprache laeuft
        if (frameRms < thresholdRms / 2) {   // Als Pause erkannt
            speechState = 3;
            speechStateTime0 = performance.now();
            setStatus('Speech Pause', 'lightgreen');
        } else {
            speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
            if (speechTotalDur > maxlenMs) { // Max. Dauer erreicht
                terminalPrint(`Speech Max Length reached (${speechTotalDur} msec), stopping.`);
                speechStateTime0 = performance.now();
                speechState = 0;
                mediaRecorder.stop();
            }
        }
    } else if (speechState === 3) { // Zustand 3: In Sprachpause
        if (frameRms > thresholdRms) {
            speechState = 2;
            setStatus('Speech Resume', 'lime');
        } else if (dur > maxPauseMs) { // Pause laenger als x sec => Ende
            speechTotalDur = (performance.now() - speechStartTime).toFixed(0);
            mediaRecorder.stop();
            if (speechTotalDur > MIN_LEN) {
                terminalPrint(`Speech End (${speechTotalDur} msec)`);
            } else {
                terminalPrint(`Speech too short (${speechTotalDur} msec), discarded.`);
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
    canvasCtx.fillStyle = '#fafafa';
    canvasCtx.fillRect(0, 0, w, h);

    canvasCtx.fillStyle = 'lime';
    canvasCtx.fillRect(10, 0, maxRms * w * 3, 10);
    canvasCtx.fillStyle = 'grey';
    canvasCtx.fillRect(10, 15, thresholdRms * w * 3, 10);

    // Text
    canvasCtx.fillStyle = 'black';
    canvasCtx.font = '14px system-ui';
    canvasCtx.fillText(`RMS:${maxRms.toFixed(3)}  AVG:${thresholdRms.toFixed(3)}`, 10, 40);

}

// Kleine Status-SPAN
function setStatus(s, color = 'silver') {
    statusEl.textContent = s;
    statusEl.style.backgroundColor = color;
    microBtn.style.setProperty("--scolor", color);
}

// Bloom-Button-Rahmen
function bloomMicroButton(bloomTh) {
    const width = bloomTh < 0 ? 0 : bloomTh > 15 ? 15 : bloomTh;
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
        formData.append('apipw', API_PASSWORD);
        if (API_USER !== undefined) formData.append('user', API_USER);
        if (USER_LANG !== undefined) formData.append('lang', USER_LANG);
        formData.append('audio', audioBlob, 'recording.webm');
        if (document.querySelector('.dbgpost').checked) {
            formData.append('dbgpost', '1');
        }
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
            setStatus('Microphon access allowed', 'lightgreen');
            microBtn.disabled = false;
            microBtn.addEventListener('click', microBtnCLick);
            thresholdSlider.disabled = false;
            maxpauseSlider.disabled = false;
        })
        .catch(() => {
            setStatus('Microphone access denied', 'red');
        });
} catch (e) {
    terminalPrint("ERROR: " + e.message);
}

/***/
