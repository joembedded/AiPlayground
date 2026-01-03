/*** minispeak.js fuer minichat */

// Imports
import { API_PASSWORD, API_USER, USER_LANG, SPEAK_VOICE, addMessage } from './minichat.js';
import * as TB from './minitools.js';
import * as MICRO from './minimicro.js';

//--------- globals ------ 

// Locals
const VERSION = 'V0.0x / xx.xx.2025';
const COPYRIGHT = '(C)JoEmbedded.de';

let audioCache = [];
let isProcessing = false;
let isLoading = false;
let audioUrl = null;
let pollInterval;
// für GET <2000 Zeichen safe, <4000: 'okÄ, >4000 evtl. Probleme
const maxSentenceLength = 4000; // Maximale Satzlänge in Zeichen fuer die API
const splitShortSentencesFlag = false; // true


const audioStatus = document.getElementById('audioStatus');
const audioPlayer = document.getElementById('audioPlayer');
// Abspielen sobald möglich
audioPlayer.oncanplay = function () {
    audioPlayer.play().catch(error => {
        addOutput('Autoplay prevented: ' + error);
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


// Poll-Funktion starten
function startPolling() {
    if (!pollInterval) {
        pollInterval = setInterval(checkAndPlayAudio, 100);
    }
}

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
        if(MICRO.getIsPlaying()===true) {
            MICRO.setIsPlaying(false); // Externes Play stoppen
        }
        if(MICRO.getMicroInputStatus()===1){    // Das Passt noch nicht ganz
            MICRO.resetMicroInputStatus();
        }
        return;
    }

    // Nächstes Audio aus Cache holen und abspielen
    const audioBlob = audioCache.shift();
    audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    audioPlayer.play().then(() => {
        addOutput(`Play - verbleibende Dateien: ${audioCache.length}`, 'success');
    }).catch(err => {
        addOutput('Fehler beim Abspielen: ' + err.message, 'error');
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

// Ausgabe hinzufügen
function addOutput(message, type = 'info') {
    TB.terminalPrint(message);
}


// Audio für einen Satz abrufen
async function fetchAudioForSentence(sentence, voice) {
    addOutput(`Satz: '${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}' wird verarbeitet...`, 'info');

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
            addOutput(`Lade Audio via GET/src...`, 'info');
            audioPlayer.src = url;
            audioPlayer.load();
        } else {
            addOutput(`Lade Audio via POST/cache...`, 'info');
            var response = await fetch("./api/oai_tts.php", { method: "POST", body: formData });
            const contentType = response.headers.get('content-type');

            // Prüfen ob Audio oder Fehler
            if (response.ok && contentType && contentType.includes('audio')) {
                const audioBlob = await response.blob();
                audioCache.push(audioBlob);
                addOutput(`Audio für Satz geladen: "${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}"`, 'success');
            } else {
                // Fehler als Text oder JSON
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    addOutput(`ERROR(JSON): ${JSON.stringify(errorJson)}`, 'error');
                } catch {
                    addOutput(`ERROR(TEXT): ${errorText.substring(0, 100)}`, 'error');
                }
            }
        }
    } catch (error) {
        addOutput(`ERROR(Server) Scentence:"${sentence.substring(0, 50)}...": ${error.message}`, 'error');
    }
}

// Hauptfunktion zum Verarbeiten des Textes
export async function speakText(inputText) {
    if (isProcessing) {
        return;
    }
    const autoSpeakCheckbox = document.getElementById('autoPlayChk');
    if(!autoSpeakCheckbox.checked) return; 

    //const inputText = document.getElementById('input').value.trim();

    if (inputText.length === 0) {
        addOutput('Kein Text eingegeben!', 'error');
        return;
    }

    isProcessing = true;
    document.getElementById('btn-senden').disabled = true;


    // Text normalisieren: Newlines und Tabs in Leerzeichen umwandeln
    const normalizedText = inputText.replace(/[\n\r\t]+/g, ' ');
    // Text in Sätze zerlegen
    const sentences = splitIntoSentences(normalizedText);
    addOutput(`Text in ${sentences.length} Sätze zerlegt`, 'info');

    // Jeden Satz verarbeiten
    const selectedVoice = SPEAK_VOICE;  // Damit nicht aenderbar within Funktion
    for (let i = 0; i < sentences.length; i++) {
        await fetchAudioForSentence(sentences[i], selectedVoice);
    }


    addOutput('Alle Sätze verarbeitet', 'success');
    isProcessing = false;
    document.getElementById('btn-senden').disabled = false;
}

// Polling beim Laden der Seite starten
window.addEventListener('load', function () {
    startPolling();
});

console.log('Minispeak Version:', VERSION);

