import React, { useEffect, useState, useRef, useCallback } from 'react';

interface SmartWatchData {
  heart_rate_bpm: number;
  blood_oxygen_spo2: number;
  sleep_score: number;
  steps_today: number;
  calories_burned: number;
  stress_level: string;
  body_temperature_f: number;
  respiratory_rate: number;
  hrv_ms: number;
  active_minutes: number;
}

interface AnalysisResult {
  status: string;
  action_type?: string;
  title?: string;
  description: string;
  macros?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
}

interface NutritionTotals {
  calories_consumed: number;
  calories_burned: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
}

interface ProtocolItem {
  id: string;
  action_type: string;
  title: string;
  timestamp: string;
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

interface Protocol {
  total_actions: number;
  totals: NutritionTotals;
  net_calories: number;
  supplements_taken: string[];
  items: ProtocolItem[];
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

const actionIcons: Record<string, string> = {
  food: '🍎',
  supplement: '💊',
  hydration: '💧',
  exercise: '🏃',
};

function App() {
  const [watchData, setWatchData] = useState<SmartWatchData | null>(null);
  const [backendStatus, setBackendStatus] = useState<ConnectionStatus>('checking');
  const [cameraState, setCameraState] = useState<'loading' | 'active' | 'denied' | 'unavailable'>('loading');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [now, setNow] = useState(new Date());
  const [actionInProgress, setActionInProgress] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [watchRes, protocolRes] = await Promise.all([
          fetch('/api/smart-watch-data'),
          fetch('/api/protocol'),
        ]);
        
        if (watchRes.ok) {
          setWatchData(await watchRes.json());
          setBackendStatus('connected');
        } else {
          setBackendStatus('disconnected');
        }
        
        if (protocolRes.ok) {
          setProtocol(await protocolRes.json());
        }
      } catch {
        setBackendStatus('disconnected');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function start() {
      console.log('[Camera] Starting camera initialization...');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          console.log('[Camera] getUserMedia not available');
          setCameraState('unavailable');
          return;
        }
        
        console.log('[Camera] Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        
        if (cancelled) {
          console.log('[Camera] Cancelled, stopping stream');
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        console.log('[Camera] Got stream, tracks:', stream.getTracks().length);
        streamRef.current = stream;
        
        const video = videoRef.current;
        if (video) {
          console.log('[Camera] Setting srcObject on video element');
          video.srcObject = stream;
          
          // Try to play immediately
          video.onloadedmetadata = () => {
            console.log('[Camera] Metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          };
          
          video.oncanplay = async () => {
            console.log('[Camera] Can play, attempting play...');
            try {
              await video.play();
              console.log('[Camera] Playing! Setting state to active');
              setCameraState('active');
            } catch (e) {
              console.error('[Camera] Play failed:', e);
            }
          };
          
          // Also try play after a short delay as fallback
          setTimeout(async () => {
            if (video.paused && !cancelled) {
              console.log('[Camera] Fallback: trying to play after timeout');
              try {
                await video.play();
                setCameraState('active');
              } catch (e) {
                console.log('[Camera] Fallback play failed:', e);
              }
            }
          }, 500);
        } else {
          console.log('[Camera] Video ref not available');
        }
      } catch (err: any) {
        console.error('[Camera] Error:', err);
        if (!cancelled) {
          setCameraState(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Analyze frame
  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || backendStatus !== 'connected') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video not ready yet');
      return;
    }
    if (video.readyState < 2) {
      console.log('Video readyState:', video.readyState);
      return;
    }
    if (video.paused) {
      console.log('Video paused, trying to play...');
      video.play().catch(() => {});
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    
    // Skip if image is too small (likely black)
    if (imageBase64.length < 1000) {
      console.log('Image too small, skipping');
      return;
    }

    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setLastAnalysis(data.analysis);
          setActionInProgress(data.action_in_progress || false);
          
          // Update protocol from response
          if (data.protocol) {
            setProtocol(data.protocol);
          }
        }
      }
    } catch (err) {
      console.log('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, backendStatus]);

  // Auto-analyze every second
  useEffect(() => {
    if (cameraState !== 'active' || backendStatus !== 'connected') return;
    const interval = setInterval(analyzeFrame, 1000);
    return () => clearInterval(interval);
  }, [cameraState, backendStatus, analyzeFrame]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'started': return '#00ff88';
      case 'in progress': return '#ffaa00';
      case 'finished': return '#00ccff';
      default: return '#666';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060c',
      color: '#ddd',
      fontFamily: 'system-ui, sans-serif',
      padding: 20,
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid #1a1a2e',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#00ff88', letterSpacing: 4 }}>BLUEPRINT</h1>
          <span style={{ fontSize: 11, color: '#666' }}>Health Optimizer with Nutrition Tracking</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 10,
            background: backendStatus === 'connected' ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,102,0.15)',
            color: backendStatus === 'connected' ? '#00ff88' : '#ff4466',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: backendStatus === 'connected' ? '#00ff88' : '#ff4466',
            }} />
            {backendStatus === 'connected' ? 'Backend Connected' : 'Backend Offline'}
          </span>
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 10,
            background: 'rgba(255,68,102,0.15)',
            color: '#ff4466',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ff4466',
              animation: 'pulse 1s infinite',
            }} />
            LIVE
          </span>
          <span style={{ fontSize: 14, color: '#888' }}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}>
        {[
          { label: 'Heart Rate', value: watchData?.heart_rate_bpm ?? '--', unit: 'bpm', color: '#00ff88' },
          { label: 'HRV', value: watchData?.hrv_ms ?? '--', unit: 'ms', color: '#00ccff' },
          { label: 'SpO2', value: watchData?.blood_oxygen_spo2 ?? '--', unit: '%', color: '#a78bfa' },
          { label: 'Net Cal', value: protocol?.net_calories ?? 0, unit: 'kcal', color: '#ff6b6b' },
          { label: 'Protein', value: protocol?.totals?.protein_g?.toFixed(0) ?? 0, unit: 'g', color: '#00ff88' },
          { label: 'Actions', value: protocol?.total_actions ?? 0, unit: '', color: '#ffaa00' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} style={{
            background: '#0a0a14',
            borderRadius: 12,
            padding: '12px 16px',
            border: '1px solid #1a1a2e',
          }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>
              {value}<span style={{ fontSize: 11, color: '#666' }}> {unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Camera Card */}
        <div style={{
          background: '#0a0a14',
          borderRadius: 16,
          padding: 16,
          border: '1px solid #1a1a2e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#888' }}>🎥 AI CAMERA</span>
            {actionInProgress && (
              <span style={{
                fontSize: 9,
                background: 'rgba(255,170,0,0.2)',
                color: '#ffaa00',
                padding: '2px 8px',
                borderRadius: 8,
              }}>
                ACTION IN PROGRESS
              </span>
            )}
          </div>

          <div style={{
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#080810',
            minHeight: 300,
          }}>
            {/* Video element always mounted so we can set srcObject */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%', 
                height: 300, 
                objectFit: 'cover', 
                display: cameraState === 'active' ? 'block' : 'none',
                background: '#000',
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameraState === 'active' && (
              <>
                {lastAnalysis && lastAnalysis.status !== 'not detected' && (
                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.8)',
                    borderRadius: 10,
                    padding: '10px 14px',
                  }}>
                    <div style={{
                      display: 'inline-block',
                      fontSize: 9,
                      fontWeight: 700,
                      background: getStatusColor(lastAnalysis.status),
                      color: '#000',
                      padding: '3px 8px',
                      borderRadius: 4,
                      marginBottom: 6,
                    }}>
                      {lastAnalysis.status.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, color: '#ccc' }}>
                      {lastAnalysis.title || lastAnalysis.description}
                    </div>
                  </div>
                )}

                {isAnalyzing && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 10,
                    color: '#00ff88',
                  }}>
                    Analyzing...
                  </div>
                )}
              </>
            )}

            {cameraState === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555' }}>
                <span style={{ fontSize: 36 }}>📷</span>
                <span>Starting camera...</span>
              </div>
            )}

            {cameraState === 'denied' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555' }}>
                <span style={{ fontSize: 36 }}>🚫</span>
                <span>Camera access denied</span>
              </div>
            )}

            {cameraState === 'unavailable' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555' }}>
                <span style={{ fontSize: 36 }}>📷</span>
                <span>No camera available</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#555', textAlign: 'center' }}>
            AI auto-detects: 💊 Supplements · 🍎 Food · 💧 Hydration · 🏃 Exercise
          </div>
        </div>

        {/* Nutrition Card */}
        <div style={{
          background: '#0a0a14',
          borderRadius: 16,
          padding: 16,
          border: '1px solid #1a1a2e',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#888', marginBottom: 12 }}>📊 NUTRITION TRACKER</div>

          {/* Calorie Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#0e0e18', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#666' }}>🍎 CONSUMED</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffaa00' }}>+{protocol?.totals?.calories_consumed ?? 0}</div>
              <div style={{ fontSize: 10, color: '#666' }}>kcal</div>
            </div>
            <div style={{ flex: 1, background: '#0e0e18', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#666' }}>🔥 BURNED</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ff6b6b' }}>-{protocol?.totals?.calories_burned ?? 0}</div>
              <div style={{ fontSize: 10, color: '#666' }}>kcal</div>
            </div>
            <div style={{ flex: 1, background: '#0e0e18', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#666' }}>⚡ NET</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#00ff88' }}>{protocol?.net_calories ?? 0}</div>
              <div style={{ fontSize: 10, color: '#666' }}>kcal</div>
            </div>
          </div>

          {/* Macro Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Protein', value: protocol?.totals?.protein_g ?? 0, max: 150, color: '#00ff88' },
              { label: 'Carbs', value: protocol?.totals?.carbs_g ?? 0, max: 300, color: '#ffaa00' },
              { label: 'Fat', value: protocol?.totals?.fat_g ?? 0, max: 80, color: '#ff6b6b' },
              { label: 'Fiber', value: protocol?.totals?.fiber_g ?? 0, max: 30, color: '#a78bfa' },
            ].map(({ label, value, max, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>{label}</span>
                  <span style={{ color, fontWeight: 600 }}>{value.toFixed(1)}g</span>
                </div>
                <div style={{ height: 8, background: '#1a1a2e', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((value / max) * 100, 100)}%`,
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Hydration */}
          {(protocol?.totals?.water_ml ?? 0) > 0 && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: '#0e0e18',
              borderRadius: 10,
              border: '1px solid rgba(0,204,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>💧</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#00ccff' }}>{protocol?.totals?.water_ml} ml</span>
              <span style={{ fontSize: 11, color: '#666' }}>hydration</span>
            </div>
          )}
        </div>
      </div>

      {/* Health Log */}
      <div style={{
        background: '#0a0a14',
        borderRadius: 16,
        padding: 16,
        border: '1px solid #1a1a2e',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#888' }}>📋 HEALTH LOG</span>
          <span style={{ fontSize: 11, color: '#00ff88' }}>{protocol?.total_actions ?? 0} actions</span>
        </div>

        {/* Supplements Summary */}
        {(protocol?.supplements_taken?.length ?? 0) > 0 && (
          <div style={{
            padding: 10,
            background: '#0e0e18',
            borderRadius: 10,
            border: '1px solid rgba(167,139,250,0.2)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>💊</span>
            <span style={{ fontSize: 12, color: '#a78bfa' }}>{protocol?.supplements_taken?.join(', ')}</span>
          </div>
        )}

        {/* Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
          {(protocol?.items?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👁️</div>
              <div>No health actions yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Take supplements, eat food, or exercise</div>
            </div>
          ) : (
            protocol?.items?.slice().reverse().map((item) => {
              const icon = actionIcons[item.action_type] || '✅';
              const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const cals = item.macros?.calories ?? 0;
              const macroText = item.action_type === 'food' && item.macros?.protein_g 
                ? ` · P:${item.macros.protein_g.toFixed(0)}g C:${item.macros.carbs_g.toFixed(0)}g F:${item.macros.fat_g.toFixed(0)}g`
                : '';
              return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: '#0e0e18',
                  borderRadius: 10,
                  borderLeft: `3px solid ${
                    item.action_type === 'food' ? '#ffaa00' :
                    item.action_type === 'supplement' ? '#a78bfa' :
                    item.action_type === 'hydration' ? '#00ccff' :
                    '#ff6b6b'
                  }`,
                }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {time}{cals !== 0 ? ` · ${cals > 0 ? '+' : ''}${cals} kcal` : ''}{macroText}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid #1a1a2e',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: '#444',
      }}>
        <span>Blueprint Health Optimizer · Powered by Gemini AI</span>
        <span>Backend: {backendStatus === 'connected' ? '✅ Connected' : '❌ Offline'}</span>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default App;
