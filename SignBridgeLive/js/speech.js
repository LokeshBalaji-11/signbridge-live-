

export function speakSentence(text, langCode) {
    if (!window.speechSynthesis) {
        console.warn("Text-to-speech not supported in this browser.");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode; // e.g., 'te-IN', 'hi-IN', 'en-IN'
    utterance.rate = 0.9;      // Slightly slower for clarity
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
}