"use client";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Trash2, Plus, Download, Terminal, XCircle, CheckCircle, Loader2 } from "lucide-react";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [batches, setBatches] = useState([
    { id: 1, name: "Batch #1", urls: "" } // Default ek section rahega
  ]);
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState(null); // Kaunsa batch chal raha hai
  const [progress, setProgress] = useState(0);
  const logsEndRef = useRef(null);

  // --- ACTIONS ---

  // Naya Section Add karna
  const addNewBatch = () => {
    const newId = batches.length > 0 ? Math.max(...batches.map(b => b.id)) + 1 : 1;
    setBatches([...batches, { id: newId, name: `Batch #${newId}`, urls: "" }]);
  };

  // Section Delete karna
  const removeBatch = (id) => {
    setBatches(batches.filter((b) => b.id !== id));
  };

  // Input Text Update karna
  const updateBatchContent = (id, text) => {
    setBatches(batches.map((b) => (b.id === id ? { ...b, urls: text } : b)));
  };

  // Logger
  const addLog = (msg, type = "info") => {
    setLogs((prev) => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  // Auto Scroll Logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- DOWNLOAD LOGIC ---
  const startGlobalDownload = async () => {
    // 1. Validation
    const allUrls = batches.flatMap(b => b.urls.split('\n').map(u => u.trim()).filter(u => u.length > 0));
    
    if (allUrls.length === 0) {
      alert("Please Enter any URLs");
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setProgress(0);
    addLog(`🚀 Starting Global Download: ${allUrls.length} files found.`, "info");

    let completedCount = 0;

    // 2. Iterate through Batches (Sections)
    for (const batch of batches) {
      const urlsInBatch = batch.urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
      
      if (urlsInBatch.length === 0) continue;

      setCurrentBatchId(batch.id); // Highlight current batch
      addLog(`📂 Processing Section: ${batch.name}`, "info");

      // 3. Iterate through URLs in current Batch
      for (const linkUrl of urlsInBatch) {
        addLog(`⏳ Downloading: ${linkUrl.substring(0, 40)}...`, "info");

        try {
          // API Call
          const response = await axios.post("/api/download", 
            { url: linkUrl },
            { responseType: "blob" }
          );

          // Filename Extraction
          let filename = `video-${Date.now()}.mp4`;
          const disposition = response.headers["content-disposition"];
          if (disposition && disposition.includes("filename=")) {
            filename = disposition.split('filename="')[1].split('"')[0];
          }

          // Save File
          const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = blobUrl;
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();
          link.remove();

          addLog(`✅ Success: ${filename}`, "success");

        } catch (error) {
          addLog(`❌ Failed: ${linkUrl}`, "error");
          console.error(error);
        }

        // Update Progress
        completedCount++;
        setProgress((completedCount / allUrls.length) * 100);
      }
    }

    setIsProcessing(false);
    setCurrentBatchId(null);
    addLog("🎉 All Downloads Completed!", "success");
  };

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white font-sans selection:bg-blue-500 selection:text-white">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 bg-[#0f0f12]/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              <Download className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-wide">
              Everything<span className="text-blue-500">Downloader</span>
            </h1>
          </div>

          {/* Global Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
             <button 
              onClick={addNewBatch}
              disabled={isProcessing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-white/10 transition-all text-sm font-medium"
            >
              <Plus size={16} /> Add Section
            </button>
            
            <button 
              onClick={startGlobalDownload}
              disabled={isProcessing}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${
                isProcessing 
                ? "bg-gray-700 text-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-blue-500/25 active:scale-95"
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              {isProcessing ? "Working..." : "Download All"}
            </button>
          </div>
        </div>
        
        {/* Global Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
           <div 
             className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
             style={{ width: `${progress}%` }}
           />
        </div>
      </header>

      {/* --- MAIN GRID CONTENT --- */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 pb-80"> {/* pb-80 for logs space */}
        
        {batches.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No sections found. Click "Add Section" to start.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => (
            <div 
              key={batch.id} 
              className={`relative group bg-[#18181b] border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl ${
                currentBatchId === batch.id 
                ? "border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]" 
                : "border-white/5 hover:border-white/10"
              }`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
                <input 
                  type="text"
                  value={batch.name}
                  onChange={(e) => {
                     const newName = e.target.value;
                     setBatches(batches.map(b => b.id === batch.id ? {...b, name: newName} : b));
                  }}
                  className="bg-transparent text-sm font-bold text-gray-300 focus:text-white focus:outline-none w-full"
                />
                <button 
                  onClick={() => removeBatch(batch.id)}
                  disabled={isProcessing}
                  className="text-gray-600 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Text Area */}
              <div className="p-1">
                <textarea
                  className="w-full h-48 bg-[#0f0f12] text-gray-300 p-3 text-xs md:text-sm font-mono focus:outline-none resize-none"
                  placeholder={`Paste URLs for ${batch.name} here...\nOne per line`}
                  value={batch.urls}
                  onChange={(e) => updateBatchContent(batch.id, e.target.value)}
                  disabled={isProcessing}
                ></textarea>
              </div>

              {/* Status Indicator (Only if active) */}
              {currentBatchId === batch.id && (
                 <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                    <Loader2 className="animate-spin" size={12} /> Processing....
                 </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* --- TERMINAL / LOGS (Sticky Bottom) --- */}
      <div className="fixed bottom-0 left-0 w-full h-64 bg-[#0a0a0c] border-t border-white/10 shadow-2xl z-40 flex flex-col">
        <div className="px-4 py-2 bg-white/5 flex items-center justify-between border-b border-white/5">
           <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider font-bold">
              <Terminal size={14} /> System Logs
           </div>
           <span className="text-xs text-gray-600">
             {logs.length} events
           </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
           {logs.length === 0 && <p className="text-gray-600 italic">Waiting for tasks...</p>}
           
           {logs.map((log, idx) => (
             <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1">
                <span className="text-gray-600 shrink-0">[{log.time}]</span>
                {log.type === "success" && <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />}
                {log.type === "error" && <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />}
                {log.type === "info" && <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 mt-0.5 shrink-0 border border-blue-500/50" />}
                
                <span className={`break-all ${
                  log.type === "success" ? "text-green-400" : 
                  log.type === "error" ? "text-red-400" : "text-gray-300"
                }`}>
                  {log.msg}
                </span>
             </div>
           ))}
           <div ref={logsEndRef} />
        </div>
      </div>

    </div>
  );
}