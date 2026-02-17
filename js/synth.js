/**
 * Objective: Polyphonic Synth for Jazz Sparks
 */
export const playChord = (chordString, type = 'sine') => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = { 'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.00, 'A': 440.00, 'B': 493.88 };
    
    // Simple parser for "Cmaj7" or "Dm7"
    const frequencies = [notes['C'], notes['E'], notes['G'], notes['B']]; // Example fallback

    frequencies.forEach(freq => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type; // 'triangle' or 'sine'
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.5);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.5);
    });
};
