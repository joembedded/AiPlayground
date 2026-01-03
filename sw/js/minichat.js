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

// *******todos - START*******
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

async function sendeNachricht() {
    let text = textEingabe.value.trim();
    if(text.length === 0) {
        //text ='\u2424'; // NL-Symbol
        const help = helpTxts[hlpIdx];
        hlpIdx = (hlpIdx + 1) % helpTxts.length;
        addMessage(help, 'bot info');
        // say() hier rein *todo*
        // Keine Eingabe-Keine Zeile
        return;
    }    
    
    // Erstmal nur doof anzeigen
    addMessage(text, 'user');
    textEingabe.value = '';
}

// Background Monitor - alle ca. 100 msec
function periodical() {
    if(DBG)frq_ping(3520, 0.01, 0.01); // Kurzer Ping
}

// *******todos - END*******

// ==== MODUserInterface ====
const chatVerlauf = document.getElementById('chat-verlauf');
const textEingabe = document.getElementById('text-eingabe');
const btnSenden = document.getElementById('btn-senden');
const btnMicro = document.getElementById('btn-micro');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

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
if(DBG) document.querySelector('.dbg').hidden = false;

setInterval(periodical, 100); // 100 msec-Timer starten

// === ENDE MODUserInterface ===

console.log('Minichat:', VERSION);
