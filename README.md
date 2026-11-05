# SignBridge Live: Enterprise Hackathon Submission

> **Project Name:** SignBridge Live  
> **Tagline:** AI-Powered Clinical Sign Language Interpreter & Automated SOAP Documentation System  

---

## 💡 1. Abstract & Problem Statement
In fast-paced emergency and clinical healthcare environments, communication barriers between medical professionals and non-verbal or sign-language-using patients lead to diagnostic delays, compromised history-taking, and critical errors. Traditional human interpreters are rarely available 24/7, and existing translation tools lack medical context or structural clinical documentation workflows.

**SignBridge Live** solves this by providing a zero-latency, browser-based clinical sign interpreter. It bridges the gap by translating physical hand sign gestures into multi-lingual regional text and natural speech, while concurrently converting raw conversational transcripts into structured medical **SOAP (Subjective, Objective, Assessment, Plan)** notes for clinicians.

---

## 🏗️ 2. Architecture & Technical Workflow

The system is designed with a strict emphasis on edge-computing privacy and lightning-fast cloud intelligence:

1. **Client-Side Computer Vision (Privacy-First):** 
   * Video streams are captured locally in the browser.
   * MediaPipe Tasks Vision (`HandLandmarker`) extracts **21 3D hand landmarks** per frame with hardware GPU acceleration.
   * Raw video data never leaves the user's device, ensuring complete patient biometric data privacy.
2. **Dynamic Gesture Recognition (k-NN Engine):**
   * Frames are normalized relative to the wrist coordinate space to achieve scale and position invariance.
   * A custom k-Nearest Neighbors (k-NN) sequence matching algorithm compares live rolling landmark buffers against pre-recorded training samples stored in `localStorage`.
3. **Multilingual NLP & Native Translation (Groq API):**
   * Recognized sign tokens are sent to the backend and processed using high-speed open-source LLMs (`llama3-8b-8192` via Groq).
   * Translates English sign concepts into fluent native regional scripts (e.g., Telugu script **హాయ్**, Hindi **नमस्ते**).
4. **Clinical SOAP Intelligence & TTS:**
   * Text is parsed under strict JSON constraints to generate clinical SOAP notes complete with completeness scoring and critical red-flag identification.
   * Browser Web Speech API (`SpeechSynthesis`) maps output to exact BCP 47 locales (`te-IN`, `hi-IN`) for native regional audio pronunciation.

---

## 🛠️ 3. Tech Stack

* **Frontend & Framework:** Next.js (React), TypeScript, Tailwind CSS
* **Computer Vision:** MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
* **AI / LLM Engine:** Groq Cloud API (`Llama 3 - 8B`)
* **Speech Synthesis:** HTML5 Web Speech API (BCP 47 Localized)
* **Data Persistence:** Browser `localStorage` for dynamic client-side sample training

---

## 🚀 4. Core Features & Hackathon Innovations

* **1-Click Custom Gesture Training:** Allows users or medical staff to instantly record and train custom sign sequences on the fly using the built-in Training Recorder.
* **True Native Script & Voice Output:** Translates and speaks regional languages natively rather than transliterating phonetically.
* **Automated Clinical SOAP Note Generation:** Instantly structures chaotic patient gestures into professional medical documentation with a real-time data completeness score.
* **Print-Ready Medical Export:** Formats diagnostic summaries into clean, professional PDF reports using responsive CSS print layouts.
* **Built-in Model Evaluation:** Features a Leave-One-Out Cross-Validation (LOOCV) harness and confusion matrix metrics directly inside the app to prove classification accuracy.

---

## 📈 5. System Performance & Metrics

* **Inference Latency:** Client-side vision pipeline operates at **20ms – 50ms latency** (yielding a smooth **20–30+ FPS**).
* **Vocabulary Support:** Preloaded with **55+ essential medical sign definitions** alongside infinite user-trainable custom gestures.
* **Security:** 100% client-side video processing ensures compliance with modern digital privacy frameworks.

---

## 📂 6. Project Structure

```text
signbridge-live/
├── app/
│   ├── api/
│   │   └── extract/
│   │       └── route.ts       # Groq LLM translation & clinical SOAP extraction backend
│   ├── layout.tsx             # Root layout & font configurations
│   └── page.tsx               # Main application entry
├── components/
│   └── signbridge/
│       └── app-shell.tsx      # Core UI, MediaPipe vision loop, & k-NN matcher
├── public/                    # Static assets & icons
├── package.json               # Dependencies & scripts
└── README.md                  # Project documentation
⚙️ 7. Setup & Installation Guide
1. Clone the repository:
   ```bash
   git clone [https://github.com/LokeshBalaji-11/signbridge-live.git](https://github.com/LokeshBalaji-11/signbridge-live.git)
   cd signbridge-live
2.Configure Environment Variables:
Create a .env.local file in the root directory and insert your Groq API key:

Code snippet
GROQ_API_KEY=your_groq_api_key_here
3.Run the development server:
Bash
npm run dev
4.Access the application:
Open your browser and navigate to http://localhost:3000
