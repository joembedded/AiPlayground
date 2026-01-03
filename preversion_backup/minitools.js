/*** minitools.js fuer minichat und minimicro ***/

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
frq_ping(880, 0.1, 0.05);
console.log('Minitools ok');
