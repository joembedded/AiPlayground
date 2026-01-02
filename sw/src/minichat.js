// minichat.js
import * as MICRO from './minimicro.js';
import * as TB from './minitools.js';

//--------- globals ------ 
export const VERSION = 'V0.0x / xx.xx.2025';
export const COPYRIGHT = '(C)JoEmbedded.de';

// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***
export const API_PASSWORD = 'Leg1310LX'; //  
export const API_USER = 'Juergen'; // Test special chars
export const USER_LANG = 'de-DE';
// *** Muss mit keys.inc.php uebereinstimmen *todo* extern holen ***


const chatVerlauf = document.getElementById('chat-verlauf');
const textEingabe = document.getElementById('text-eingabe');
const btnSenden = document.getElementById('btn-senden');
const btnMicro = document.getElementById('btn-micro');
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

async function sendeNachricht() {
    const text = textEingabe.value.trim();
    if (!text) {
        addMessage('Hallo, Wie kann ich helfen?', 'bot info');
        return;
    }

    addMessage(text, 'user');
    textEingabe.value = '';

    const newMessage = addMessage(' Wait...', 'bot spinner');
    const payload = {
        apipw: API_PASSWORD,
        user: API_USER,
        lang: USER_LANG,
        message: text
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

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

document.getElementById('sidebar-close').addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

console.log('Minichat Version:', VERSION);