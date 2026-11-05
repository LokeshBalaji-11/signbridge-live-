"use client";

import { useState, useEffect, useRef } from "react";

const SIGN_LANGUAGES = [
  "Indian Sign Language (ISL)", "American Sign Language (ASL)", "British Sign Language (BSL)",
  "Australian Sign Language (Auslan)", "French Sign Language (LSF)", "Japanese Sign Language (JSL)",
  "German Sign Language (DGS)", "Italian Sign Language (LIS)", "Spanish Sign Language (LSE)"
  // ... (Assume the rest of the 50 are here for brevity)
];

const BUILT_IN_SIGNS_DB = [
  "Hello", "Yes", "No", "Please", "Doctor", "Nurse", "Hospital", "Pain", "Sharp", "Ache", 
  "Stomach", "Back", "Arm", "Leg", "Medicine", "Pill", "Allergy"
];

const SPOKEN_LANGUAGES = ["English", "Telugu", "Hindi", "Spanish", "French"];

export function AppShell() {
  const [signSearch, setSignSearch] = useState("");
  const [activeSignLang, setActiveSignLang] = useState(SIGN_LANGUAGES[0]);
  const [activeSpokenLang, setActiveSpokenLang] = useState(SPOKEN_LANGUAGES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // --- NEW: Dynamic Transcript & Analysis States ---
  const [transcript, setTranscript] = useState(
    "Doctor, I have been experiencing a sharp pain in my lower abdomen since yesterday evening. It feels worse when I try to stand up straight or walk."
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    symptoms: string[];
    location: string;
    duration: string;
    aggravator: string;
    completeness: number;
    suggestion: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function enableWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Webcam access denied.");
      }
    }
    enableWebcam();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // --- NEW: The AI Extraction Function ---
  const extractMedicalData = async () => {
    setIsAnalyzing(true);
    
    // TODO: Replace this timeout with your actual fetch call to Groq API (Llama/Qwen)
    // Example: await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ transcript }) })
    
    setTimeout(() => {
      setAnalysisData({
        symptoms: ["Sharp pain"],
        location: "Lower abdomen (Stomach)",
        duration: "Since yesterday evening",
        aggravator: "Standing or walking",
        completeness: 85,
        suggestion: "Patient has provided primary symptoms. Consider asking about fever or nausea."
      });
      setIsAnalyzing(false);
      setShowAnalysis(true); // Auto-switch to analysis tab
    }, 1500);
  };

  const filteredSigns = SIGN_LANGUAGES.filter((lang) =>
    lang.toLowerCase().includes(signSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full flex-col bg-[#070b19] text-slate-100 font-sans">
      <header className="flex items-center justify-between border-b border-slate-800 bg-[#0a1024] px-6 py-4">
        <h1 className="text-xl font-bold tracking-wide text-cyan-400">
          <i className="fa-solid fa-hands-asl-interpreting mr-2"></i>
          SignBridge Live
        </h1>
        {/* ... (Keep your existing Header code here) ... */}
      </header>

      <main className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col border-r border-slate-800 p-6">
          {/* ... (Keep your existing Camera Panel code here) ... */}
          <div className="flex-1 rounded-xl border border-slate-700 bg-black shadow-inner relative overflow-hidden flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
          </div>
        </section>

        <section className="flex w-96 flex-col bg-[#0a1024]">
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setShowAnalysis(false)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${!showAnalysis ? 'border-b-2 border-cyan-500 text-cyan-400' : 'text-slate-500'}`}
            >
              Live Translation
            </button>
            <button
              onClick={() => setShowAnalysis(true)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${showAnalysis ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-500'}`}
            >
              Medical Analysis
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!showAnalysis ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Transcript</p>
                <textarea 
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 p-4 text-slate-300 border border-slate-800 focus:border-cyan-500 focus:outline-none min-h-[150px] resize-none text-sm"
                />
                
                <button 
                  onClick={extractMedicalData}
                  disabled={isAnalyzing}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold text-sm transition-colors flex justify-center items-center"
                >
                  {isAnalyzing ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Analyzing...</>
                  ) : (
                    <><i className="fa-solid fa-brain mr-2"></i> Generate Clinical Extraction</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {analysisData ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-3">Automated Extraction</p>
                      <ul className="space-y-3 text-sm text-slate-300">
                        <li className="flex items-start bg-slate-900 p-2 rounded border border-slate-800">
                          <i className="fa-solid fa-check text-emerald-500 mt-1 mr-3"></i> 
                          <span><strong className="text-white">Symptom:</strong> {analysisData.symptoms.join(", ")}</span>
                        </li>
                        <li className="flex items-start bg-slate-900 p-2 rounded border border-slate-800">
                          <i className="fa-solid fa-check text-emerald-500 mt-1 mr-3"></i> 
                          <span><strong className="text-white">Location:</strong> {analysisData.location}</span>
                        </li>
                        <li className="flex items-start bg-slate-900 p-2 rounded border border-slate-800">
                          <i className="fa-solid fa-check text-emerald-500 mt-1 mr-3"></i> 
                          <span><strong className="text-white">Duration:</strong> {analysisData.duration}</span>
                        </li>
                        <li className="flex items-start bg-slate-900 p-2 rounded border border-slate-800">
                          <i className="fa-solid fa-check text-emerald-500 mt-1 mr-3"></i> 
                          <span><strong className="text-white">Aggravator:</strong> {analysisData.aggravator}</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                      <p className="text-xs font-semibold text-slate-400 mb-2 flex justify-between">
                        <span>Clinical Completeness</span>
                        <span className="text-emerald-400">{analysisData.completeness}%</span>
                      </p>
                      <div className="h-2 w-full rounded-full bg-slate-800 mb-3">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${analysisData.completeness}%` }}></div>
                      </div>
                      <p className="text-xs text-slate-400 border-t border-slate-800 pt-2">
                        <i className="fa-solid fa-circle-info text-cyan-500 mr-1"></i> {analysisData.suggestion}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-500 mt-10 text-sm">
                    No analysis generated yet. <br/> Go to Translation tab and click Generate.
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