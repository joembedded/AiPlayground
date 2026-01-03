// minichat.js
import * as MICRO from './minimicro.js';
import * as TB from './minitools.js';
import * as SPEAK from './minispeak.js';

//--------- globals ------ 
export const VERSION = 'V0.0x / xx.xx.2025';
export const COPYRIGHT = '(C)JoEmbedded.de';

// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***
export const API_PASSWORD = 'Leg1310LX'; //  
export const API_USER = 'Juergen'; // Test special chars
export const USER_LANG = 'de-DE';
export const SPEAK_VOICE = 'narrator_f_jane'; // Standard Stimme
// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***

const chatVerlauf = document.getElementById('chat-verlauf');
const textEingabe = document.getElementById('text-eingabe');
const btnSenden = document.getElementById('btn-senden');
//const btnMicro = document.getElementById('btn-micro');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

export function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatVerlauf.appendChild(messageDiv);
    setTimeout(() => {
        chatVerlauf.scrollTop = chatVerlauf.scrollHeight;
    }, 100);
    return messageDiv;
}

function updateMessage(messageDiv, text, type) {
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
}

const helpTxts = [
    'Hallo. Wie kann ich helfen?',
    'Kann ich behilflich sein?',
    'Womit kann ich helfen?',
    'Hallo! Was kann ich tun?',
    'Was kann ich tun?',
    'Fragen? Ich helfe gerne.',
];
let hlpIdx = 0;

async function sendeNachricht() {
    const text = textEingabe.value.trim();
    if (!text) {
        const help = helpTxts[hlpIdx];
        addMessage(help, 'bot info');
        MICRO.setIsPlaying(true); // Externes Play stoppt Micro
        await SPEAK.speakText(help);
        hlpIdx = (hlpIdx + 1) % helpTxts.length;
        return;
    }

    addMessage(text, 'user');
    textEingabe.value = '';

    const newMessage = addMessage(' Wait...', 'bot spinner');
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
        const data = await response.json();
        if (data.success) {
            const text = data?.text?.length ? data.text : '(leere Antwort)';
            updateMessage(newMessage, text, 'bot ok');
            await SPEAK.speakText(text);

        } else {
            updateMessage(newMessage, 'Fehler: ' + (data.error || 'Unbekannter Fehler'), 'bot error');
        }
    } catch (error) {
        updateMessage(newMessage, 'Netzwerkfehler: ' + error.message, 'bot error');
    }
}

btnSenden.addEventListener('click', sendeNachricht);

textEingabe.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendeNachricht();
    }
});

function menuManage(flag) {
    if (flag) {
        // Unsichtbar
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        MICRO.setIsPlaying(false);
    } else {
        // Sichtbar
        sidebar.classList.add('active');
        overlay.classList.add('active');
        MICRO.setIsPlaying(true);
    }
}

menuToggle.addEventListener('click', () => {
    menuManage(false); // AUF
});

overlay.addEventListener('click', () => {
    menuManage(true);   // ZU   
});

document.getElementById('sidebar-close').addEventListener('click', () => {
    menuManage(true); // ZU
});

console.log('Minichat Version:', VERSION);