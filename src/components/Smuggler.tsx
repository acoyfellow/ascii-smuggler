import { useState, useEffect, useRef, useCallback } from "react";
import { TECHNIQUES, RISK_COLORS, RISK_BG, CAT_LABELS } from "../lib/techniques";

function byteSize(s: string) {
  return new Blob([s]).size;
}

function HexDump({ data }: { data: string }) {
  if (!data) return null;
  const bytes = data.split("").map((c) => c.charCodeAt(0));
  const rows = [];
  for (let i = 0; i < Math.min(bytes.length, 128); i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const addr = i.toString(16).padStart(8, "0");
    const hex = chunk.map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = chunk
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "\u00B7"))
      .join("");
    rows.push(
      <div key={i} className="flex gap-4 font-mono text-xs leading-[22px]">
        <span className="text-gray-400">{addr}</span>
        <span className="text-gray-700 tracking-wide">{hex.padEnd(48)}</span>
        <span className="text-gray-500">{ascii}</span>
      </div>,
    );
  }
  return <div className="overflow-x-auto">{rows}</div>;
}

function DiffView({ original, smuggled }: { original: string; smuggled: string }) {
  if (!original || !smuggled) return null;
  const maxLen = Math.max(original.length, smuggled.length);
  const diffs = [];
  let changed = 0;
  for (let i = 0; i < Math.min(maxLen, 300); i++) {
    const o = original.charCodeAt(i) || 0;
    const s = smuggled.charCodeAt(i) || 0;
    const d = o !== s;
    if (d) changed++;
    diffs.push(
      <span
        key={i}
        className={d ? "text-red-700 bg-red-50 border-b border-red-200 px-px" : "text-gray-700"}
      >
        {smuggled[i] || "\u00A0"}
      </span>,
    );
  }
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        {changed} of {maxLen} codepoints modified. Substitution rate:{" "}
        {((changed / maxLen) * 100).toFixed(1)}%. Red-highlighted characters indicate
        positions where the codepoint differs from the original input.
      </p>
      <div className="break-all font-mono text-sm leading-6 p-4 bg-gray-50 rounded-md border border-gray-200">
        {diffs}
      </div>
    </div>
  );
}

function CodepointInspector({ text }: { text: string }) {
  if (!text) return null;
  const chars = text.slice(0, 80).split("");
  const ZW_CODES = [0x200b, 0x200c, 0x200d, 0x202e, 0x202c];
  return (
    <div>
      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-100 border border-red-200 inline-block" />
          Zero-width
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-200 inline-block" />
          Non-ASCII
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-gray-100 border border-gray-200 inline-block" />
          ASCII
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {chars.map((c, i) => {
          const cp = c.codePointAt(0) ?? 0;
          const isAscii = cp < 128;
          const isZW = ZW_CODES.includes(cp);
          return (
            <div
              key={i}
              className={`inline-flex flex-col items-center px-1.5 py-1 rounded min-w-[40px] border ${
                isZW
                  ? "bg-red-50 border-red-200"
                  : !isAscii
                    ? "bg-amber-50 border-amber-200"
                    : "bg-gray-50 border-gray-200"
              }`}
            >
              <span
                className={`text-sm font-mono font-medium ${
                  isZW ? "text-red-700" : !isAscii ? "text-yellow-800" : "text-gray-700"
                }`}
              >
                {isZW ? "ZW" : c}
              </span>
              <span className="text-[8px] font-mono text-gray-400 mt-0.5">
                U+{cp.toString(16).toUpperCase().padStart(4, "0")}
              </span>
            </div>
          );
        })}
        {text.length > 80 && (
          <div className="text-xs text-gray-400 p-2 self-center">+{text.length - 80} more</div>
        )}
      </div>
    </div>
  );
}

interface LogEntry {
  msg: string;
  type: string;
  ts: number;
}

export default function Smuggler() {
  const [input, setInput] = useState("");
  const [technique, setTechnique] = useState("unicode_confusables");
  const [result, setResult] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState("output");
  const [chainMode, setChainMode] = useState(false);
  const [chainSteps, setChainSteps] = useState(["unicode_confusables"]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  
  // CHAOS MODE STATE 🔥
  const [chaosMode, setChaosMode] = useState(false);
  const [chaosLevel, setChaosLevel] = useState(0);
  const [stealthLevel, setStealthLevel] = useState(100);
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [chaosStyle, setChaosStyle] = useState<"sequential" | "random" | "all" | "chaos">("chaos");
  const [showExplosion, setShowExplosion] = useState(false);
  const [matrixRain, setMatrixRain] = useState(false);

  const addLog = useCallback((msg: string, type = "info") => {
    setLogs((prev) => [...prev.slice(-60), { msg, type, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const activeTech = TECHNIQUES[technique];
  const activeSteps = chainMode ? chainSteps : [technique];

  // CHAOS MODE FUNCTIONS 🔥
  const calculateChaosLevel = (techniques: string[]) => {
    const riskScores = { Critical: 10, High: 7, Medium: 4, Low: 2 };
    const total = techniques.reduce((sum, t) => sum + riskScores[TECHNIQUES[t].risk], 0);
    return Math.min(100, (total / techniques.length) * 10);
  };

  const calculateStealthLevel = (techniques: string[]) => {
    const riskScores = { Critical: 0, High: 30, Medium: 60, Low: 90 };
    if (techniques.length === 0) return 100;
    const avg = techniques.reduce((sum, t) => sum + riskScores[TECHNIQUES[t].risk], 0) / techniques.length;
    return Math.max(0, Math.min(100, avg - (techniques.length - 1) * 5));
  };

  const runChaosMode = () => {
    if (!input.trim()) {
      addLog("🔥 CHAOS MODE: Empty input detected. ABORT.", "error");
      return;
    }
    
    setProcessing(true);
    setResult(null);
    setMatrixRain(true);
    setShowExplosion(true);
    
    addLog("🔥 INITIATING CHAOS MODE...", "error");
    addLog(`⚡ ${selectedTechniques.length} techniques selected`, "info");
    addLog(`💀 Chaos level: ${chaosLevel.toFixed(0)}%`, "error");
    
    setTimeout(() => setShowExplosion(false), 2000);
    
    setTimeout(() => {
      let output = input;
      let techniques = [...selectedTechniques];
      
      if (chaosStyle === "random") {
        // Shuffle techniques
        techniques = techniques.sort(() => Math.random() - 0.5);
        addLog("🎲 Random order applied", "info");
      } else if (chaosStyle === "chaos") {
        // Apply each technique multiple times in random order
        const chaosSteps = [];
        for (let i = 0; i < Math.max(3, selectedTechniques.length); i++) {
          chaosSteps.push(techniques[Math.floor(Math.random() * techniques.length)]);
        }
        techniques = chaosSteps;
        addLog("🌀 TRUE CHAOS: Multiple random passes", "error");
      } else if (chaosStyle === "all") {
        // Apply all selected techniques simultaneously with random character distribution
        addLog("💥 ALL-AT-ONCE MODE", "error");
      }
      
      if (mode === "encode") {
        if (chaosStyle === "all") {
          // Split input across techniques
          const chars = output.split("");
          output = chars.map((char, i) => {
            const techKey = techniques[i % techniques.length];
            const T = TECHNIQUES[techKey];
            return T.encode(char, T.map);
          }).join("");
          addLog(`🔀 Characters distributed across ${techniques.length} techniques`, "success");
        } else {
          techniques.forEach((t, i) => {
            const T = TECHNIQUES[t];
            const before = output.length;
            output = T.encode(output, T.map);
            addLog(`⚡ Stage ${i + 1}: ${T.name} [${before} → ${output.length} chars]`, "success");
          });
        }
      } else {
        [...techniques].reverse().forEach((t, i) => {
          const T = TECHNIQUES[t];
          output = T.decode(output, T.map);
          addLog(`🔓 Stage ${i + 1}: ${T.name} reversed`, "info");
        });
      }
      
      addLog(`🎉 CHAOS COMPLETE: ${output.length} chars, ${byteSize(output)} bytes`, "success");
      addLog(`⚠️  Stealth level: ${stealthLevel.toFixed(0)}%`, "error");
      setResult(output);
      setProcessing(false);
      setTimeout(() => setMatrixRain(false), 3000);
    }, 800);
  };

  const randomizeChaos = () => {
    const all = Object.keys(TECHNIQUES);
    const count = Math.floor(Math.random() * all.length) + 1;
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(all[Math.floor(Math.random() * all.length)]);
    }
    setSelectedTechniques([...new Set(selected)]);
    const styles: Array<"sequential" | "random" | "all" | "chaos"> = ["sequential", "random", "all", "chaos"];
    setChaosStyle(styles[Math.floor(Math.random() * styles.length)]);
    addLog(`🎲 Randomized: ${selected.length} techniques in ${chaosStyle} mode`, "info");
  };

  const toggleChaos = () => {
    if (!chaosMode && selectedTechniques.length === 0) {
      // Auto-select some techniques when enabling chaos mode
      setSelectedTechniques(Object.keys(TECHNIQUES).slice(0, 3));
    }
    setChaosMode(!chaosMode);
    addLog(chaosMode ? "🔥 Chaos mode deactivated" : "🔥 CHAOS MODE ACTIVATED", "error");
  };

  useEffect(() => {
    if (chaosMode) {
      setChaosLevel(calculateChaosLevel(selectedTechniques));
      setStealthLevel(calculateStealthLevel(selectedTechniques));
    }
  }, [selectedTechniques, chaosMode]);

  const runSmuggle = () => {
    if (chaosMode) {
      runChaosMode();
      return;
    }
    
    if (!input.trim()) {
      addLog("Empty input. Operation cancelled.", "error");
      return;
    }
    setProcessing(true);
    setResult(null);
    addLog(`${mode === "encode" ? "Encode" : "Decode"} started. ${input.length} chars, ${byteSize(input)} bytes.`);
    setTimeout(() => {
      let output = input;
      const steps = chainMode ? chainSteps : [technique];
      if (mode === "encode") {
        steps.forEach((t, i) => {
          const T = TECHNIQUES[t];
          output = T.encode(output, T.map);
          addLog(`Stage ${i + 1}: ${T.name}. ${output.length} chars.`);
        });
      } else {
        [...steps].reverse().forEach((t, i) => {
          const T = TECHNIQUES[t];
          output = T.decode(output, T.map);
          addLog(`Stage ${i + 1}: ${T.name} reversed.`);
        });
      }
      addLog(`Done. ${output.length} chars, ${byteSize(output)} bytes.`, "success");
      setResult(output);
      setProcessing(false);
    }, 400);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    addLog("Copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleReverse = () => {
    if (!result) return;
    setInput(result);
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans relative">
      {/* MATRIX RAIN EFFECT */}
      {matrixRain && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden bg-black/5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-green-500 font-mono text-xs animate-pulse opacity-30"
              style={{
                left: `${i * 5}%`,
                top: `-20px`,
                animation: `fall ${1 + Math.random() * 2}s linear infinite`,
                animationDelay: `${Math.random()}s`,
              }}
            >
              {Array.from({ length: 10 }).map((_, j) => (
                <div key={j}>01</div>
              ))}
            </div>
          ))}
        </div>
      )}
      
      {/* ASCII EXPLOSION */}
      {showExplosion && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-6xl font-bold text-red-600 animate-ping opacity-75">
            💥 CHAOS 💥
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[5px] bg-gray-900 flex items-center justify-center text-xs font-bold text-white">
            S
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">ASCII Smuggler</div>
            <div className="text-xs text-gray-400">Payload Encoding Toolkit</div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={toggleChaos}
            className={`px-3 py-1.5 text-xs border rounded-[5px] font-semibold cursor-pointer transition-all ${
              chaosMode
                ? "bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-700 shadow-lg animate-pulse"
                : "bg-white text-gray-500 border-gray-200 hover:border-red-300"
            }`}
          >
            🔥 {chaosMode ? "CHAOS MODE" : "Chaos Mode"}
          </button>
          <button
            onClick={() => setShowLog(!showLog)}
            className={`px-2.5 py-1 text-xs border border-gray-200 rounded-[5px] text-gray-500 cursor-pointer ${
              showLog ? "bg-gray-100" : "bg-white"
            }`}
          >
            Log{logs.length > 0 ? ` (${logs.length})` : ""}
          </button>
          <span className="text-[10px] text-gray-300">v2.1.0</span>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-gray-200 px-5 py-2 flex items-center gap-2.5 flex-wrap">
        {!chaosMode ? (
          <>
            <div className="inline-flex rounded-md overflow-hidden border border-gray-200">
              {(["encode", "decode"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setResult(null);
                  }}
                  className={`px-4 py-1.5 text-xs border-none cursor-pointer ${
                    mode === m
                      ? "bg-gray-900 text-white font-semibold"
                      : "bg-white text-gray-500"
                  } ${m === "encode" ? "border-r border-gray-200" : ""}`}
                >
                  {m === "encode" ? "Encode" : "Decode"}
                </button>
              ))}
            </div>
            <div className="w-px h-[18px] bg-gray-200" />
            <button
              onClick={() => {
                setChainMode(!chainMode);
                if (!chainMode) setChainSteps([technique]);
              }}
              className={`px-3 py-1 text-xs rounded-[5px] cursor-pointer border ${
                chainMode
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200"
              }`}
            >
              Pipeline {chainMode ? "On" : "Off"}
            </button>
            {chainMode && chainSteps.length > 0 && (
              <div className="flex gap-1 items-center flex-wrap">
                {chainSteps.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 text-xs">&rarr;</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                      {TECHNIQUES[s].name}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* CHAOS MODE TOOLBAR */}
            <div className="inline-flex rounded-md overflow-hidden border-2 border-red-500">
              {(["encode", "decode"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setResult(null);
                  }}
                  className={`px-4 py-1.5 text-xs border-none cursor-pointer ${
                    mode === m
                      ? "bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold"
                      : "bg-white text-gray-500"
                  } ${m === "encode" ? "border-r-2 border-red-500" : ""}`}
                >
                  {m === "encode" ? "🔥 ENCODE" : "🔓 DECODE"}
                </button>
              ))}
            </div>
            <div className="w-px h-[18px] bg-red-300" />
            <div className="flex gap-1.5 items-center">
              {(["sequential", "random", "all", "chaos"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setChaosStyle(style)}
                  className={`px-2.5 py-1 text-[10px] rounded cursor-pointer border font-semibold uppercase ${
                    chaosStyle === style
                      ? "bg-red-600 text-white border-red-700"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            <button
              onClick={randomizeChaos}
              className="px-3 py-1 text-xs rounded bg-gradient-to-r from-purple-600 to-pink-600 text-white border-none cursor-pointer font-semibold"
            >
              🎲 Randomize
            </button>
            <div className="flex-1" />
            <div className="flex gap-3 items-center">
              <div className="flex flex-col">
                <div className="text-[8px] text-gray-400 uppercase tracking-wider">Danger</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 transition-all"
                      style={{ width: `${chaosLevel}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-red-600">{chaosLevel.toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-[8px] text-gray-400 uppercase tracking-wider">Stealth</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-600 transition-all"
                      style={{ width: `${stealthLevel}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-green-600">{stealthLevel.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile technique bar */}
      <div className="md:hidden border-b border-gray-200 px-5 py-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Technique</div>
          <div className="text-sm font-medium text-gray-900">{activeTech.name}</div>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="px-3.5 py-1 text-xs rounded-[5px] bg-gray-100 border border-gray-200 text-gray-700 cursor-pointer"
        >
          {showPanel ? "Done" : "Select"}
        </button>
      </div>

      {/* Mobile technique list */}
      {showPanel && (
        <div className="md:hidden border-b border-gray-200 px-5 py-2 bg-gray-50/50 max-h-[300px] overflow-y-auto flex flex-col gap-1">
          {Object.entries(TECHNIQUES).map(([key, t]) => {
            const active = chainMode ? chainSteps.includes(key) : technique === key;
            const idx = chainMode ? chainSteps.indexOf(key) : -1;
            return (
              <button
                key={key}
                onClick={() => {
                  if (chainMode) {
                    setChainSteps((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
                  } else {
                    setTechnique(key);
                    setShowPanel(false);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-left w-full cursor-pointer ${
                  active ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"
                }`}
              >
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-wide ${
                    active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {CAT_LABELS[t.category]}
                </span>
                <span className="flex-1 text-sm text-gray-700">{t.name}</span>
                <span className={`text-[10px] font-medium ${RISK_COLORS[t.risk]}`}>{t.risk}</span>
                {chainMode && idx >= 0 && (
                  <span className="w-[18px] h-[18px] rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-[calc(100vh-150px)]">
        {/* Sidebar */}
        <div className="hidden md:block w-[272px] min-w-[272px] border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="text-[10px] font-semibold text-gray-400 tracking-[1.5px] uppercase mb-2.5">
              {chaosMode ? "🔥 Select Techniques" : "Techniques"}
            </div>
            {chaosMode && (
              <div className="mb-3 text-xs text-gray-500 leading-relaxed">
                Select multiple techniques to combine in chaos mode
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {Object.entries(TECHNIQUES).map(([key, t]) => {
                const active = chaosMode
                  ? selectedTechniques.includes(key)
                  : chainMode
                    ? chainSteps.includes(key)
                    : technique === key;
                const idx = chainMode && !chaosMode ? chainSteps.indexOf(key) : -1;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (chaosMode) {
                        setSelectedTechniques((prev) =>
                          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
                        );
                      } else if (chainMode) {
                        setChainSteps((p) =>
                          p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
                        );
                      } else {
                        setTechnique(key);
                      }
                    }}
                    className={`flex items-center gap-2 px-2.5 py-[7px] rounded-[5px] border-none text-left w-full text-xs cursor-pointer transition-colors ${
                      active
                        ? chaosMode
                          ? "bg-red-50 text-red-900 border-l-4 border-red-600"
                          : "bg-gray-100 text-gray-900"
                        : "bg-transparent text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {chaosMode && (
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded cursor-pointer accent-red-600"
                      />
                    )}
                    <span
                      className={`text-[9px] font-semibold px-[5px] py-px rounded tracking-wide shrink-0 ${
                        active
                          ? chaosMode
                            ? "bg-red-600 text-white"
                            : "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {CAT_LABELS[t.category]}
                    </span>
                    <span className={`flex-1 ${active ? "font-medium" : ""}`}>{t.name}</span>
                    {!chaosMode && chainMode && idx >= 0 && (
                      <span className="w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                    )}
                    {!chaosMode && !chainMode && (
                      <span className={`text-[10px] font-medium shrink-0 ${RISK_COLORS[t.risk]}`}>
                        {t.risk}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!chainMode && !chaosMode && (
            <div className="px-4 pb-4">
              <div className="p-3.5 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-900">{activeTech.name}</span>
                  <span
                    className={`text-[9px] px-[7px] py-0.5 rounded font-semibold border ${RISK_BG[activeTech.risk]} ${RISK_COLORS[activeTech.risk]}`}
                  >
                    {activeTech.risk}
                  </span>
                </div>
                <p className="text-[11.5px] text-gray-500 leading-relaxed">{activeTech.desc}</p>
                <div className="mt-2.5 text-[10px] text-gray-400">Category: {activeTech.category}</div>
              </div>
            </div>
          )}
          
          {chaosMode && (
            <div className="px-4 pb-4">
              <div className="p-3.5 bg-gradient-to-br from-red-50 to-orange-50 rounded-md border-2 border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-xs font-bold text-red-900">CHAOS MODE ACTIVE</span>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed mb-2">
                  {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? "s" : ""} selected. 
                  {selectedTechniques.length === 0 && " Select at least one technique above."}
                  {selectedTechniques.length > 0 && ` This will ${mode === "encode" ? "encode" : "decode"} your payload using ${chaosStyle} mode.`}
                </p>
                {selectedTechniques.length > 0 && (
                  <div className="text-[10px] text-red-600 mt-2 font-semibold">
                    ⚠️ {chaosStyle === "chaos" ? "MAXIMUM CHAOS" : chaosStyle === "all" ? "DISTRIBUTED CHAOS" : chaosStyle === "random" ? "RANDOM ORDER" : "SEQUENTIAL"} ⚠️
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Input */}
          <div className="p-4 px-5 border-b border-gray-200">
            <label className="text-[10px] font-semibold text-gray-400 tracking-[1.5px] uppercase block mb-2">
              {mode === "encode" ? "Payload Input" : "Encoded Input"}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "encode" ? "Enter text to encode..." : "Paste encoded payload to decode..."}
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-md text-gray-900 font-mono text-sm p-3 resize-y leading-5 focus:outline-none focus:border-gray-400"
            />
            <div className="flex gap-2 mt-2.5 items-center flex-wrap">
              {chaosMode ? (
                <button
                  onClick={runSmuggle}
                  disabled={processing || selectedTechniques.length === 0}
                  className={`relative px-8 py-4 rounded-lg border-none text-lg font-black cursor-pointer overflow-hidden transition-all ${
                    processing || selectedTechniques.length === 0
                      ? "bg-gray-200 text-gray-400"
                      : "bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white shadow-2xl hover:shadow-red-500/50 hover:scale-105 animate-pulse"
                  }`}
                  style={{
                    textShadow: processing ? "none" : "0 2px 8px rgba(0,0,0,0.4)",
                    backgroundSize: "200% 100%",
                    animation: processing ? "none" : "gradient 3s ease infinite, pulse 1s ease-in-out infinite",
                  }}
                >
                  {processing ? (
                    <span>🌀 CHAOS IN PROGRESS...</span>
                  ) : (
                    <span>
                      🔥💥 ULTIMATE {mode === "encode" ? "SMUGGLE" : "DECODE"} 💥🔥
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={runSmuggle}
                  disabled={processing}
                  className={`px-5 py-2 rounded-md border-none text-sm font-medium cursor-pointer ${
                    processing ? "bg-gray-200 text-gray-400" : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {processing ? "Processing..." : mode === "encode" ? "Encode" : "Decode"}
                </button>
              )}
              {result && (
                <>
                  <button
                    onClick={handleCopy}
                    className={`px-3.5 py-2 rounded-md border border-gray-200 text-xs text-gray-700 cursor-pointer ${
                      copied ? "bg-gray-100" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleReverse}
                    className="px-3.5 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 cursor-pointer hover:bg-gray-50"
                  >
                    Reverse
                  </button>
                </>
              )}
              <span className="ml-auto text-xs text-gray-300 font-mono">
                {input.length}c {byteSize(input)}b
              </span>
            </div>
          </div>

          {/* Tabs */}
          {result && (
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {[
                { id: "output", l: "Output" },
                { id: "diff", l: "Diff" },
                { id: "hex", l: "Hex" },
                { id: "codepoints", l: "Codepoints" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`px-4 py-2.5 border-none text-xs whitespace-nowrap cursor-pointer bg-transparent border-b-2 ${
                    view === tab.id
                      ? "border-gray-900 text-gray-900 font-semibold"
                      : "border-transparent text-gray-400"
                  }`}
                >
                  {tab.l}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-5 overflow-y-auto">
            {!result && !processing && (
              <div className="text-center py-16">
                <div className="w-11 h-11 rounded-xl bg-gray-100 inline-flex items-center justify-center mb-3.5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <div className="text-sm text-gray-400 mb-1">No output</div>
                <div className="text-xs text-gray-300">Enter a payload and run an encoding operation.</div>
              </div>
            )}
            {processing && (
              <div className="text-center py-16 text-sm text-gray-400">Processing...</div>
            )}

            {result && !processing && view === "output" && (
              <div>
                <div className="flex gap-6 mb-4 flex-wrap">
                  {[
                    { l: "Characters", v: result.length },
                    { l: "Bytes", v: byteSize(result) },
                    {
                      l: "Byte Ratio",
                      v:
                        ((byteSize(result) / Math.max(byteSize(input), 1)) * 100).toFixed(0) + "%",
                    },
                    { l: "Stages", v: activeSteps.length },
                  ].map((s) => (
                    <div key={s.l}>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                        {s.l}
                      </div>
                      <div className="text-lg font-semibold text-gray-900 font-mono">{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-gray-50 rounded-md border border-gray-200 font-mono text-sm leading-[22px] break-all text-gray-900 whitespace-pre-wrap">
                  {result}
                </div>
              </div>
            )}
            {result && !processing && view === "diff" && (
              <DiffView
                original={mode === "encode" ? input : result}
                smuggled={mode === "encode" ? result : input}
              />
            )}
            {result && !processing && view === "hex" && <HexDump data={result} />}
            {result && !processing && view === "codepoints" && <CodepointInspector text={result} />}
          </div>

          {/* Log */}
          {showLog && (
            <div className="border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center px-5 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 tracking-[1.5px] uppercase">
                  Operation Log
                </span>
                <button
                  onClick={() => setLogs([])}
                  className="bg-transparent border-none text-xs text-gray-300 cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div ref={logRef} className="max-h-[120px] overflow-y-auto px-5 py-1 pb-2">
                {logs.length === 0 && (
                  <div className="text-xs text-gray-300 py-1.5">No entries.</div>
                )}
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={`text-xs font-mono leading-5 flex gap-2.5 ${
                      l.type === "error"
                        ? "text-red-700"
                        : l.type === "success"
                          ? "text-green-800"
                          : "text-gray-400"
                    }`}
                  >
                    <span className="text-gray-300 shrink-0">
                      {new Date(l.ts).toLocaleTimeString("en", { hour12: false })}
                    </span>
                    <span>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
