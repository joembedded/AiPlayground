/*** minitools.js fuer minichat und minimicro ***/

// =======Terminal-Emulation=======
const TERMINAL_LINES = 25; // Default
let terminal_lines = TERMINAL_LINES; // Real
const terminalContent = [];
const terminalEl = document.querySelector(".terminal");
// Terminal kann von frueheren Modulen benutzt werden
export function terminalPrint(txt) {
    if (txt !== undefined) terminalContent.push(txt);
    else terminalContent[0] = '*** Terminal ***';
    while (terminalContent.length > terminal_lines) terminalContent.shift();
    terminalEl.innerText = terminalContent.join('\n');
}

// Ping-Helper
let acx = null;
export function frq_ping(frq = 440, dura = 0.2, vol = 0.07) { // Helper, extern available
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

export async function jsSleepMs(ms = 1) { // Helper
    let np = new Promise(resolve => setTimeout(resolve, ms))
    return np
}


console.log('Minitools ok');
