import { initializeVision } from './vision.js';
import { setupDataCollection, handleFrameForData, dataset } from './data.js';
import { classifyLiveSequence } from './classifier.js';
import { processGlossesToSentence } from './llm.js';
import { speakSentence } from './speech.js';

let liveWindow = [];
let debounceCounter = 0;
let currentSentenceGlosses = [];
let sentenceTimeout = null;
let lastLiveCaptureTime = 0; 

document.addEventListener('DOMContentLoaded', () => {
    setupDataCollection();
    
    const glossStream = document.getElementById('glossStream');
    const finalSentenceUI = document.getElementById('finalSentence');
    const languageSelect = document.getElementById('languageSelect');
    const video = document.getElementById('webcam');

    initializeVision((features, rawData, ctx) => {
        handleFrameForData(features); 

        if (ctx && video) {
            if (ctx.canvas.width !== video.videoWidth) {
                ctx.canvas.width = video.videoWidth;
                ctx.canvas.height = video.videoHeight;
            }
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
            
            ctx.fillStyle = "#06b6d4";
            if (rawData.handResults && rawData.handResults.landmarks) {
                for (const hand of rawData.handResults.landmarks) {
                    for (const landmark of hand) {
                        ctx.beginPath();
                        ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }

            // HACKATHON LIFESAVER: Warn you on-screen if memory is empty!
            // Premium UI Warning Toggle
            const warningUI = document.getElementById('memoryWarning');
            if (warningUI) {
                if (dataset.length === 0 && !document.getElementById('recordStatus')?.innerText.includes("RECORDING")) {
                    warningUI.classList.remove('opacity-0');
                } else {
                    warningUI.classList.add('opacity-0');
                }
            }
        }

        const statusText = document.getElementById('recordStatus')?.innerText || "";
        if (statusText.includes("RECORDING")) return;

        const now = Date.now();
        if (now - lastLiveCaptureTime < 80) return;
        lastLiveCaptureTime = now;

        if (features && features.length > 0) {
            liveWindow.push(features);
        }

        if (debounceCounter > 0) {
            debounceCounter--;
            return;
        }

        // SPEED UP: Only need 15 frames (~1 second) to instantly recognize a sign!
        if (liveWindow.length >= 15 && dataset.length > 0) {
            const prediction = classifyLiveSequence(liveWindow, dataset);
            
            if (prediction && prediction.confidence >= 0.75) {
                addGlossChip(prediction.label);
                debounceCounter = 20; // Pause briefly before reading next sign
                liveWindow = []; 
                
                currentSentenceGlosses.push(prediction.label);

                clearTimeout(sentenceTimeout);
                sentenceTimeout = setTimeout(() => {
                    finalizeSentence();
                }, 2500); // 2.5 seconds timeout
            } else {
                 // Clear bad frames to instantly try again
                 liveWindow = [];
            }
        }
    });

    function addGlossChip(label) {
        if (glossStream.innerHTML.includes("WAITING...")) glossStream.innerHTML = "";
        const chip = document.createElement('span');
        chip.className = "px-3 py-1 bg-medical/80 text-white rounded-md text-sm font-bold shadow-lg";
        chip.innerText = label;
        glossStream.appendChild(chip);
    }

    async function finalizeSentence() {
        if (currentSentenceGlosses.length === 0) return;
        
        finalSentenceUI.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Translating...`;
        const targetLang = languageSelect ? languageSelect.value : "en-IN"; 
        
        const translatedText = await processGlossesToSentence(currentSentenceGlosses, targetLang);
        finalSentenceUI.innerText = translatedText;
        speakSentence(translatedText, targetLang);
        
        currentSentenceGlosses = [];
        setTimeout(() => {
            glossStream.innerHTML = `<span class="px-3 py-1 bg-gray-700 text-white rounded-md text-sm font-bold">WAITING...</span>`;
        }, 5000);
    }
   // --- ADVANCED FEATURE: Bidirectional Reverse Translation ---
    const btnSpeakReverse = document.getElementById('btnSpeakReverse');
    const doctorInput = document.getElementById('doctorInput');
    const patientDisplay = document.getElementById('patientDisplay');

    if (btnSpeakReverse && doctorInput && patientDisplay) {
        btnSpeakReverse.addEventListener('click', () => {
            const text = doctorInput.value.trim();
            if (!text) return;
            
            // 1. Set text and trigger smooth fade-in
            patientDisplay.innerText = text;
            patientDisplay.classList.remove('opacity-0');
            patientDisplay.classList.add('border-cyan-400', 'shadow-[0_0_40px_rgba(6,182,212,0.3)]', 'scale-102');
            
            // 2. Speak the text aloud
            const targetLang = languageSelect ? languageSelect.value : "en-IN";
            speakSentence(text, targetLang);
            
            // 3. Clear text box immediately so the doctor can type next
            doctorInput.value = "";
            
            // 4. Automatically fade out the patient display after 8 seconds
            setTimeout(() => {
                patientDisplay.classList.add('opacity-0');
                patientDisplay.classList.remove('border-cyan-400', 'shadow-[0_0_40px_rgba(6,182,212,0.3)]', 'scale-102');
            }, 8000);
        });
    }
     
})