"use client";

import { useState, useEffect, useRef } from "react";
import { FilesetResolver, HandLandmarker, DrawingUtils, NormalizedLandmark } from "@mediapipe/tasks-vision";

const SIGN_LANGUAGES = [
  "Indian Sign Language (ISL)", "American Sign Language (ASL)", "British Sign Language (BSL)",
  "Australian Sign Language (Auslan)", "French Sign Language (LSF)", "Japanese Sign Language (JSL)",
  "Chinese Sign Language (CSL)", "Korean Sign Language (KSL)", "Russian Sign Language (RSL)",
  "German Sign Language (DGS)", "Italian Sign Language (LIS)", "Spanish Sign Language (LSE)"
];

const SPOKEN_LANGUAGES = [
  "English", "Telugu", "Hindi", "Tamil", "Kannada", 
  "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu"
];

// Exact BCP 47 language codes for native voice pronunciation
const SPEECH_LANG_MAP: Record<string, string> = {
  "English": "en-IN", 
  "Telugu": "te-IN", 
  "Hindi": "hi-IN", 
  "Tamil": "ta-IN",
  "Kannada": "kn-IN", 
  "Malayalam": "ml-IN", 
  "Marathi": "mr-IN", 
  "Bengali": "bn-IN",
  "Gujarati": "gu-IN", 
  "Punjabi": "pa-IN", 
  "Urdu": "ur-IN"
};

function normalizeFrame(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
  const wrist = landmarks[0];
  return landmarks.map(lm => ({
    x: lm.x - wrist.x,
    y: lm.y - wrist.y,
    z: lm.z - wrist.z,
    visibility: lm.visibility ?? 1.0
  }));
}

function frameDistance(f1: NormalizedLandmark[], f2: NormalizedLandmark[]) {
  let sum = 0;
  for (let i = 0; i < f1.length; i++) {
    sum += Math.pow(f1[i].x - f2[i].x, 2) + Math.pow(f1[i].y - f2[i].y, 2) + Math.pow(f1[i].z - f2[i].z, 2);
  }
  return Math.sqrt(sum);
}

function sequenceDistance(seq1: NormalizedLandmark[][], seq2: NormalizedLandmark[][]) {
  let dist = 0;
  const len = Math.min(seq1.length, seq2.length);
  for (let i = 0; i < len; i++) dist += frameDistance(seq1[i], seq2[i]);
  return dist / len;
}

export function AppShell() {
  const [signSearch, setSignSearch] = useState("");
  const [activeSignLang, setActiveSignLang] = useState(SIGN_LANGUAGES[0]);
  const [activeSpokenLang, setActiveSpokenLang] = useState(SPOKEN_LANGUAGES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"translation" | "analysis" | "evaluation">("translation");
  
  const [transcript, setTranscript] = useState("");
  const [displayTranscript, setDisplayTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [completenessScore, setCompletenessScore] = useState(0);

  const [evalResults, setEvalResults] = useState<{ accuracy: number, matrix: Record<string, Record<string, number>>, labels: string[] } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);

  const [recordingLabel, setRecordingLabel] = useState("");
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  const [samplesCount, setSamplesCount] = useState(0);
  
  const isRecordingRef = useRef(false);
  const currentLabelRef = useRef("");
  const framesBuffer = useRef<NormalizedLandmark[][]>([]);
  const latestLandmarksRef = useRef<NormalizedLandmark[] | null>(null);

  const liveBufferRef = useRef<NormalizedLandmark[][]>([]);
  const [detection, setDetection] = useState<{ label: string; confidence: number; top3: string[] } | null>(null);

  useEffect(() => {
    const samples = JSON.parse(localStorage.getItem("sign_samples") || "[]");
    setSamplesCount(samples.length);
  }, []);

  // Automatically translate transcript into active language using the API
  useEffect(() => {
    async function translateText() {
      if (!transcript) {
        setDisplayTranscript("");
        return;
      }
      if (activeSpokenLang === "English") {
        setDisplayTranscript(transcript);
        return;
      }
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, targetLanguage: activeSpokenLang, action: 'translate' })
        });
        const data = await res.json();
        setDisplayTranscript(data.translatedText || transcript);
      } catch (err) {
        setDisplayTranscript(transcript);
      }
    }
    translateText();
  }, [transcript, activeSpokenLang]);

  useEffect(() => {
    let handLandmarker: HandLandmarker;
    let stream: MediaStream;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let isActive = true;

    async function initializeVision() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        const renderLoop = () => {
          if (!isActive) return;

          if (videoRef.current && videoRef.current.readyState >= 2 && canvasRef.current && handLandmarker) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth || 1280;
              canvas.height = video.videoHeight || 720;
            }

            let startTimeMs = performance.now();
            
            if (video.currentTime !== lastVideoTimeRef.current) {
              lastVideoTimeRef.current = video.currentTime;
              const results = handLandmarker.detectForVideo(video, startTimeMs);
              setLatency(Math.round(performance.now() - startTimeMs));

              if (ctx) {
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);

                if (results.landmarks && results.landmarks.length > 0) {
                  const currentLandmarks = results.landmarks[0];
                  latestLandmarksRef.current = currentLandmarks;
                  const drawingUtils = new DrawingUtils(ctx);
                  drawingUtils.drawConnectors(currentLandmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#06b6d4", lineWidth: 3 });
                  drawingUtils.drawLandmarks(currentLandmarks, { color: "#10b981", lineWidth: 2, radius: 4 });

                  if (isRecordingRef.current) {
                    framesBuffer.current.push(currentLandmarks);
                    if (framesBuffer.current.length >= 20) {
                      isRecordingRef.current = false;
                      const samples = JSON.parse(localStorage.getItem("sign_samples") || "[]");
                      samples.push({ label: currentLabelRef.current, frames: framesBuffer.current });
                      localStorage.setItem("sign_samples", JSON.stringify(samples));
                      setIsRecordingUI(false);
                      setSamplesCount(samples.length);
                    }
                  } 
                  else {
                    liveBufferRef.current.push(currentLandmarks);
                    if (liveBufferRef.current.length > 20) liveBufferRef.current.shift();

                    if (liveBufferRef.current.length === 20 && frameCount % 5 === 0) {
                      const samples = JSON.parse(localStorage.getItem("sign_samples") || "[]");
                      if (samples.length > 0) {
                        const normLive = liveBufferRef.current.map(normalizeFrame);
                        const distances = samples.map((sample: any) => {
                          const normSample = sample.frames.map(normalizeFrame);
                          return { label: sample.label, dist: sequenceDistance(normLive, normSample) };
                        });
                        
                        distances.sort((a: any, b: any) => a.dist - b.dist);
                        const bestDist = distances[0].dist;
                        const confidence = Math.max(0, 1 - (bestDist * 2.0)); 
                        
                        if (confidence > 0.20) {
                          const top3 = distances.slice(0, 3).map((d: any) => d.label);
                          const uniqueTop3 = Array.from(new Set(top3)) as string[];
                          
                          setDetection({ label: distances[0].label, confidence, top3: uniqueTop3 });
                          
                          if (confidence >= 0.45) {
                            setTranscript(prev => (prev + " " + distances[0].label).trim());
                            liveBufferRef.current = []; 
                          }
                        } else {
                          setDetection(null);
                        }
                      }
                    }
                  }
                } else {
                   latestLandmarksRef.current = null;
                   liveBufferRef.current = [];
                   if (frameCount % 30 === 0) setDetection(null);
                }
                ctx.restore();
              }
            }

            frameCount++;
            const now = performance.now();
            if (now - lastFpsTime >= 1000) {
              setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
              frameCount = 0;
              lastFpsTime = now;
            }
          }
          requestRef.current = requestAnimationFrame(renderLoop);
        };
        
        requestRef.current = requestAnimationFrame(renderLoop);
        
      } catch (err) {
        console.error("Vision Engine failed to load:", err);
      }
    }

    initializeVision();

    return () => {
      isActive = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (handLandmarker) handLandmarker.close();
      window.speechSynthesis.cancel();
    };
  }, []);

  const startRecording = () => {
    if (!recordingLabel) return alert("Please enter a sign label");
    if (!latestLandmarksRef.current) return alert("No hand detected in camera view!");
    currentLabelRef.current = recordingLabel;
    framesBuffer.current = [];
    isRecordingRef.current = true;
    setIsRecordingUI(true);
  };

  const handleSpeak = () => {
    const textToSpeak = displayTranscript || transcript;
    if (!textToSpeak) return;
    
    setIsSpeaking(true);
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = SPEECH_LANG_MAP[activeSpokenLang] || "en-IN";
    
    // Explicitly scan browser voices for a native match (e.g., Telugu voice)
    const voices = window.speechSynthesis.getVoices();
    const langCode = utterance.lang.toLowerCase(); // e.g., "te-in"
    const baseLang = langCode.split('-')[0]; // e.g., "te"

    const nativeVoice = voices.find(v => v.lang.toLowerCase() === langCode || v.lang.toLowerCase().startsWith(baseLang));
    if (nativeVoice) {
      utterance.voice = nativeVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };
    
  
  const calculateCompleteness = (data: any) => {
    let score = 0;
    if (data.symptoms && data.symptoms.length > 0) score += 25;
    if (data.location && data.location.length > 3) score += 25;
    if (data.duration && data.duration.length > 3) score += 25;
    if (data.severity && data.severity.length > 3) score += 25;
    return score;
  };

  const extractMedicalData = async () => {
    const textToAnalyze = displayTranscript || transcript;
    if (!textToAnalyze) return alert("Transcript is empty.");
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToAnalyze, action: 'extract' })
      });
      const data = await res.json();
      setAnalysisData(data);
      setCompletenessScore(calculateCompleteness(data));
      setActiveTab("analysis");
    } catch (err) {
      console.error("Failed to extract", err);
    }
    setIsAnalyzing(false);
  };

  const runEvaluation = () => {
    const samples = JSON.parse(localStorage.getItem("sign_samples") || "[]");
    if (samples.length < 2) return alert("Please record at least 2 samples to run cross-validation.");

    let correct = 0;
    const matrix: Record<string, Record<string, number>> = {};
    const labelsSet = new Set<string>();
    
    samples.forEach((s: any) => labelsSet.add(s.label));
    const labels = Array.from(labelsSet);
    
    labels.forEach(l1 => {
      matrix[l1] = {};
      labels.forEach(l2 => matrix[l1][l2] = 0);
    });

    samples.forEach((testSample: any, testIdx: number) => {
      const trainSamples = samples.filter((_: any, idx: number) => idx !== testIdx);
      const normTest = testSample.frames.map(normalizeFrame);
      
      let bestDist = Infinity;
      let predictedLabel = labels[0]; 
      
      trainSamples.forEach((train: any) => {
        const normTrain = train.frames.map(normalizeFrame);
        const dist = sequenceDistance(normTest, normTrain);
        if (dist < bestDist) {
          bestDist = dist;
          predictedLabel = train.label;
        }
      });
      
      matrix[testSample.label][predictedLabel] = (matrix[testSample.label][predictedLabel] || 0) + 1;
      if (testSample.label === predictedLabel) correct++;
    });
    
    setEvalResults({
      accuracy: Math.round((correct / samples.length) * 100),
      matrix,
      labels
    });
  };

  const handlePrint = () => window.print();

  const filteredSigns = SIGN_LANGUAGES.filter((lang) => lang.toLowerCase().includes(signSearch.toLowerCase()));

  return (
    <div className="flex h-screen w-full flex-col bg-[#070b19] text-slate-100 font-sans print:bg-white print:text-black">
      
      <header className="flex items-center justify-between border-b border-slate-800 bg-[#0a1024] px-6 py-4 print:hidden">
        <h1 className="text-xl font-bold tracking-wide text-cyan-400">
          <i className="fa-solid fa-hands-asl-interpreting mr-2"></i> SignBridge Live
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search Languages..." 
              value={signSearch} 
              onFocus={() => setIsDropdownOpen(true)} 
              onChange={(e) => { setSignSearch(e.target.value); setIsDropdownOpen(true); }} 
              className="w-64 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none" 
            />
            {isDropdownOpen && (
              <div className="absolute top-12 left-0 z-50 w-full rounded-md border border-slate-700 bg-slate-800 shadow-xl p-2 max-h-60 overflow-y-auto">
                <ul className="py-1">
                  {filteredSigns.map((lang) => (
                    <li 
                      key={lang} 
                      onClick={() => { 
                        setActiveSignLang(lang); 
                        setIsDropdownOpen(false); 
                        setSignSearch(""); 
                      }} 
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-cyan-900 rounded text-slate-200"
                    >
                      {lang}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <select value={activeSpokenLang} onChange={(e) => setActiveSpokenLang(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none">
            {SPOKEN_LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
          </select>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden print:overflow-visible">
        
        <section className="flex flex-1 flex-col border-r border-slate-800 p-6 print:hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200">Live Clinical Feed</h2>
            <span className="flex items-center text-xs font-medium text-emerald-400">
              <span className="mr-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> MediaPipe Engine Active
            </span>
          </div>
          
          <div className="flex-1 rounded-xl border border-slate-700 bg-black shadow-inner relative overflow-hidden flex items-center justify-center">
            
            <div className="absolute top-4 left-4 z-20 flex gap-2 flex-col bg-slate-900/80 p-4 rounded-lg border border-slate-700 backdrop-blur-sm w-64">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Training Recorder</h3>
              <input type="text" placeholder="Sign Label" value={recordingLabel} onChange={(e) => setRecordingLabel(e.target.value)} className="w-full rounded bg-black border border-slate-600 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
              <button onClick={startRecording} disabled={isRecordingUI} className={`w-full py-1 text-xs font-bold rounded transition-colors ${isRecordingUI ? 'bg-rose-600 animate-pulse text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}>
                {isRecordingUI ? "Capturing 20 Frames..." : "Record Sample"}
              </button>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-slate-400">Saved Samples: <span className="text-cyan-400 font-bold">{samplesCount}</span></p>
                <button onClick={() => { localStorage.removeItem("sign_samples"); setSamplesCount(0); setTranscript(""); alert("Cleared samples!"); }} className="text-[10px] text-rose-400 hover:underline">Clear All</button>
              </div>
            </div>

            {detection && (
              <div className="absolute top-4 right-4 z-20 rounded-lg bg-cyan-950/90 border border-cyan-500 p-3 shadow-lg backdrop-blur-sm min-w-[200px] transition-all">
                <div className="flex justify-between items-end mb-2 border-b border-cyan-800 pb-2">
                  <div>
                    <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Detected</p>
                    <p className="text-xl font-bold text-white leading-none mt-1">{detection.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Conf</p>
                    <p className={`text-lg font-bold leading-none mt-1 ${detection.confidence > 0.75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(detection.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover z-10" />

            <div className="absolute bottom-4 left-4 z-20 rounded bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm border border-slate-700">
              <span className="text-cyan-400">{fps} FPS</span> | Latency: <span className={latency > 50 ? "text-rose-400" : "text-emerald-400"}>{latency}ms</span>
            </div>
          </div>
        </section>

        <section className="flex w-[26rem] flex-col bg-[#0a1024] print:w-full print:bg-white print:text-black">
          <div className="flex border-b border-slate-800 print:hidden shrink-0">
            <button onClick={() => setActiveTab('translation')} className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === 'translation' ? 'border-b-2 border-cyan-500 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>Live Translation</button>
            <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === 'analysis' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Medical Analysis</button>
            <button onClick={() => setActiveTab('evaluation')} className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === 'evaluation' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>Evaluation</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
            
            {activeTab === 'translation' && (
              <div className="space-y-4 flex flex-col h-full print:hidden">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Live Transcript ({activeSpokenLang})</p>
                  <button onClick={handleSpeak} disabled={isSpeaking || !displayTranscript} className={`px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-2 ${isSpeaking ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-cyan-400 hover:bg-slate-700 border border-slate-700'}`}>
                    <i className="fa-solid fa-volume-high"></i> {isSpeaking ? "Speaking..." : "Read Aloud"}
                  </button>
                </div>
                <textarea value={displayTranscript} onChange={(e) => setDisplayTranscript(e.target.value)} className="w-full flex-1 rounded-lg bg-slate-900 p-4 text-slate-300 border border-slate-800 focus:border-cyan-500 focus:outline-none resize-none text-sm min-h-[200px]" placeholder="Signs will automatically append and translate here..." />
                <button onClick={extractMedicalData} disabled={isAnalyzing || !displayTranscript} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md font-bold text-sm transition-colors flex justify-center items-center mt-4">
                  {isAnalyzing ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Analyzing Transcript...</> : <><i className="fa-solid fa-brain mr-2"></i> Extract Clinical Data</>}
                </button>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {analysisData ? (
                  <>
                    <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
                      <h1 className="text-2xl font-bold uppercase">SignBridge Clinical SOAP Note</h1>
                      <p className="text-sm">Generated: {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="flex justify-between items-center print:hidden">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Diagnostic Data</p>
                      <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-pdf"></i> Save / Print PDF
                      </button>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 print:border-black print:bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-slate-400 print:text-black">Clinical Completeness</p>
                        <p className={`text-sm font-bold ${completenessScore >= 75 ? 'text-emerald-400' : completenessScore >= 50 ? 'text-amber-400' : 'text-rose-400'} print:text-black`}>{completenessScore}%</p>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 print:bg-gray-200">
                        <div className={`h-2 rounded-full transition-all duration-1000 ${completenessScore >= 75 ? 'bg-emerald-500' : completenessScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'} print:bg-black`} style={{ width: `${completenessScore}%` }}></div>
                      </div>
                    </div>

                    {analysisData.red_flags && analysisData.red_flags.length > 0 && (
                      <div className="bg-rose-950/50 border border-rose-500/50 rounded-lg p-4 print:bg-white print:border-black">
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center print:text-black">
                          <i className="fa-solid fa-triangle-exclamation mr-2 print:hidden"></i> Critical Red Flags
                        </p>
                        <ul className="list-disc list-inside text-sm text-rose-200 print:text-black">
                          {analysisData.red_flags.map((flag: string, i: number) => <li key={i}>{flag}</li>)}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-3 print:text-black print:font-bold">Subjective & Objective</p>
                      <ul className="space-y-2 text-sm text-slate-300 print:text-black">
                        <li className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-black">
                          <strong className="text-white text-xs uppercase tracking-wider block mb-1 print:text-black">Symptoms</strong>
                          {analysisData.symptoms?.join(", ") || "None recorded"}
                        </li>
                        <li className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-black">
                          <strong className="text-white text-xs uppercase tracking-wider block mb-1 print:text-black">Location & Duration</strong>
                          {analysisData.location || "Unknown"} • {analysisData.duration || "Unknown"}
                        </li>
                        <li className="bg-slate-900 p-3 rounded border border-slate-800 flex justify-between items-center print:bg-white print:border-black">
                          <strong className="text-white text-xs uppercase tracking-wider print:text-black">Severity</strong>
                          <span className="bg-amber-900/50 text-amber-400 px-2 py-1 rounded text-xs border border-amber-800 print:bg-white print:border-black print:text-black font-bold">
                            {analysisData.severity || "Unknown"}
                          </span>
                        </li>
                        <li className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-black">
                          <strong className="text-white text-xs uppercase tracking-wider block mb-1 print:text-black">Aggravators</strong>
                          {analysisData.aggravators?.join(", ") || "None recorded"}
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-cyan-800 bg-cyan-950/30 p-4 print:bg-white print:border-black">
                      <p className="text-xs font-bold uppercase text-cyan-400 mb-2 flex items-center print:text-black">
                        <i className="fa-solid fa-circle-question mr-2 print:hidden"></i> Assessment & Plan (Follow-ups)
                      </p>
                      <ul className="list-disc list-inside text-sm text-cyan-200 print:text-black">
                        {analysisData.missing_info?.map((info: string, i: number) => <li key={i}>Provider should ask about {info}</li>)}
                      </ul>
                    </div>

                    <div className="hidden print:block mt-8 pt-4 border-t border-black">
                      <p className="text-xs font-bold uppercase mb-2">Original Patient Transcript</p>
                      <p className="text-sm italic">"{displayTranscript}"</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-500 mt-10 text-sm">
                    No data extracted yet.<br/>Go to Live Translation and click Extract.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'evaluation' && (
              <div className="space-y-6 print:hidden">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-500">System Metrics</p>
                  <button onClick={runEvaluation} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors">
                    Run LOOCV Eval
                  </button>
                </div>
                
                {evalResults ? (
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Held-Out Accuracy</p>
                        <p className={`text-3xl font-bold ${evalResults.accuracy > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{evalResults.accuracy}%</p>
                      </div>
                      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Avg Latency</p>
                        <p className="text-3xl font-bold text-cyan-400">{latency}ms</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Confusion Matrix</p>
                      <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-800 text-slate-400">
                            <tr>
                              <th className="px-3 py-2 font-medium">Actual \ Predicted</th>
                              {evalResults.labels.map(l => <th key={l} className="px-3 py-2 font-medium truncate max-w-[80px]" title={l}>{l}</th>)}
                            </tr>
                          </thead>
                          <tbody className="bg-slate-900 divide-y divide-slate-800">
                            {evalResults.labels.map(actualLabel => (
                              <tr key={actualLabel}>
                                <td className="px-3 py-2 font-bold text-slate-300 border-r border-slate-800 truncate max-w-[80px]" title={actualLabel}>{actualLabel}</td>
                                {evalResults.labels.map(predictedLabel => {
                                  const count = evalResults.matrix[actualLabel][predictedLabel];
                                  const isCorrect = actualLabel === predictedLabel;
                                  return (
                                    <td key={predictedLabel} className={`px-3 py-2 text-center ${count > 0 ? (isCorrect ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400') : 'text-slate-600'}`}>
                                      {count}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 mt-10 text-sm bg-slate-900 p-6 rounded-lg border border-slate-800 border-dashed">
                    <i className="fa-solid fa-chart-pie text-3xl mb-3 text-slate-600 block"></i>
                    Click 'Run LOOCV Eval' to validate the k-NN model using your stored localStorage samples.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}