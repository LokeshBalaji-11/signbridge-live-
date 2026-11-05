export let dataset = [];
let isRecording = false;
let currentFrames = [];
let currentLabel = "";
let lastCaptureTime = 0; // NEW: Timer for speed control

export function setupDataCollection() {
    const btnRecord = document.getElementById('btnRecord');
    const signLabel = document.getElementById('signLabel');
    const status = document.getElementById('recordStatus');

    if(!btnRecord) return;

    btnRecord.addEventListener('click', () => {
        if (!signLabel.value.trim()) {
            alert("Please enter a sign label first!");
            return;
        }
        currentLabel = signLabel.value.trim().toUpperCase();
        isRecording = true;
        currentFrames = [];
        lastCaptureTime = Date.now(); // Reset timer
        status.innerText = "🔴 RECORDING: 0/30";
        status.style.color = "red";
    });
}

export function handleFrameForData(features) {
    if (!isRecording) return;
    
    const status = document.getElementById('recordStatus');
    const now = Date.now();

    // SPEED CONTROL: Only capture a frame every 80 milliseconds (Stretches 30 frames to ~2.5 seconds)
    if (now - lastCaptureTime < 80) return; 

    if (features && features.length > 0) {
        lastCaptureTime = now; // Update the timer
        currentFrames.push(features);
        status.innerText = `🔴 RECORDING: ${currentFrames.length}/30`;
        status.style.color = "red";
        
        if (currentFrames.length >= 30) {
            isRecording = false;
            saveSampleToDataset(currentLabel, currentFrames);
            status.innerText = "✅ DONE !";
            status.style.color = "#06b6d4";
        }
    } else {
         status.innerText = `✋ Waiting for hands... ${currentFrames.length}/30`;
         status.style.color = "orange";
    }
}

function saveSampleToDataset(label, frames) {
    dataset.push({ label, sequence: frames });
    updateSamplesUI();
}

function updateSamplesUI() {
    const list = document.getElementById('samplesList');
    list.innerHTML = "";
    
    const counts = {};
    dataset.forEach(d => {
        counts[d.label] = (counts[d.label] || 0) + 1;
    });

    Object.keys(counts).forEach(label => {
        const div = document.createElement('div');
        div.className = "bg-gray-800 p-2 rounded text-center border border-gray-600 font-bold text-white shadow-md";
        div.innerText = `${label} (${counts[label]}x)`;
        list.appendChild(div);
    });
}