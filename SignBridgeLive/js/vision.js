import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

export async function initializeVision(callback) {
    const video = document.getElementById('webcam');
    const teachVideo = document.getElementById('teach_preview');
    const btnRecord = document.getElementById('btnRecord');
    const canvas = document.getElementById('output_canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (!video) return;

    // 1. Start Camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        await video.play();
        if (teachVideo) {
            teachVideo.srcObject = stream;
            await teachVideo.play();
        }
    } catch (e) {
        alert("Camera blocked! Please allow access.");
        return;
    }

    if (btnRecord) {
        btnRecord.disabled = true;
        btnRecord.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading AI Engine...`;
        btnRecord.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 2. Download AI Model directly via JS module
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        // Unlock button!
        if (btnRecord) {
            btnRecord.disabled = false;
            btnRecord.innerHTML = `<i class="fa-solid fa-video"></i> Record 30 Frames`;
            btnRecord.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        let lastVideoTime = -1;
        function renderLoop() {
            if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
                lastVideoTime = video.currentTime;
                
                const results = handLandmarker.detectForVideo(video, performance.now());
                let features = [];
                if (results.landmarks && results.landmarks.length > 0) {
                    features = results.landmarks[0].flatMap(p => [p.x, p.y, p.z]);
                }
                
                if (callback) {
                    try { callback(features, { handResults: results }, ctx); } catch (err) {}
                }
            }
            requestAnimationFrame(renderLoop);
        }
        
        video.addEventListener('playing', renderLoop);
        if (!video.paused) renderLoop();

    } catch (err) {
        // If it fails now, it will print the EXACT reason on the button
        console.error("AI Error:", err);
        if (btnRecord) {
            btnRecord.innerHTML = "❌ Error: " + err.message;
        }
    }
}