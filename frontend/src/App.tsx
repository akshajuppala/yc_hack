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
  description: string;
}

interface CameraEvent {
  id: number;
  timestamp: string;
  type: string;
  item: string;
  confidence: number;
  status: string;
  icon: string;
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

function App() {
  const [watchData, setWatchData] = useState<SmartWatchData | null>(null);
  const [backendStatus, setBackendStatus] = useState<ConnectionStatus>('checking');
  const [cameraState, setCameraState] = useState<'loading' | 'active' | 'denied' | 'unavailable'>('loading');
  const [currentAction, setCurrentAction] = useState('taking a supplement');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [now, setNow] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch smart watch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/smart-watch-data');
        if (res.ok) {
          const data = await res.json();
          setWatchData(data);
          setBackendStatus('connected');
        } else {
          setBackendStatus('disconnected');
        }
      } catch {
        setBackendStatus('disconnected');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraState('unavailable');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraState('active');
      } catch (err: any) {
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          current_action: currentAction,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setLastAnalysis(data.analysis);
          
          if (data.analysis.status !== 'not detected') {
            const newEvent: CameraEvent = {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              type: data.analysis.status,
              item: data.analysis.description.slice(0, 40),
              confidence: data.analysis.status === 'finished' ? 95 : 75,
              status: data.analysis.status,
              icon: data.analysis.status === 'finished' ? '✅' : data.analysis.status === 'in progress' ? '🔄' : '🎯',
            };
            setEvents(prev => [newEvent, ...prev].slice(0, 10));
          }
        }
      }
    } catch (err) {
      console.log('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, currentAction, backendStatus]);

  // Auto-analyze every 5 seconds
  useEffect(() => {
    if (cameraState !== 'active' || backendStatus !== 'connected') return;
    const interval = setInterval(analyzeFrame, 5000);
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

  const fahrenheitToCelsius = (f: number) => ((f - 32) * 5 / 9).toFixed(1);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="logo">BLUEPRINT</h1>
          <span className="subtitle">Health Optimizer</span>
        </div>
        <div className="header-right">
          <span className={`backend-badge ${backendStatus === 'connected' ? 'backend-connected' : 'backend-disconnected'}`}>
            <span style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: backendStatus === 'connected' ? '#00ff88' : '#ff4466',
              display: 'inline-block'
            }} />
            {backendStatus === 'connected' ? 'Backend Connected' : 'Backend Offline'}
          </span>
          <span className="live-badge">
            <span className="rec-dot" /> LIVE
          </span>
          <span className="clock">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Heart Rate</span>
          <span className="stat-value" style={{ color: '#00ff88' }}>
            {watchData?.heart_rate_bpm ?? '--'}
            <span className="stat-unit"> bpm</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">HRV</span>
          <span className="stat-value" style={{ color: '#00ccff' }}>
            {watchData?.hrv_ms ?? '--'}
            <span className="stat-unit"> ms</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">SpO2</span>
          <span className="stat-value" style={{ color: '#a78bfa' }}>
            {watchData?.blood_oxygen_spo2 ?? '--'}
            <span className="stat-unit"> %</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Temperature</span>
          <span className="stat-value" style={{ color: '#f59e0b' }}>
            {watchData ? fahrenheitToCelsius(watchData.body_temperature_f) : '--'}
            <span className="stat-unit"> °C</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Calories</span>
          <span className="stat-value" style={{ color: '#ff6b6b' }}>
            {watchData?.calories_burned ?? '--'}
            <span className="stat-unit"> kcal</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="main-grid">
        {/* Live Camera Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🎥 Live Camera</span>
            {cameraState === 'active' && (
              <span className="live-badge" style={{ fontSize: 9 }}>
                <span className="rec-dot" /> LIVE
              </span>
            )}
          </div>

          <div className="webcam-container">
            {cameraState === 'active' && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="webcam-video"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="scanline" />
                <div className="bracket bracket-tl" />
                <div className="bracket bracket-tr" />
                <div className="bracket bracket-bl" />
                <div className="bracket bracket-br" />

                {lastAnalysis && (
                  <div className="analysis-overlay">
                    <div 
                      className="analysis-status"
                      style={{ backgroundColor: getStatusColor(lastAnalysis.status) }}
                    >
                      {lastAnalysis.status.toUpperCase()}
                    </div>
                    <div className="analysis-desc">{lastAnalysis.description}</div>
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
                    fontSize: 11,
                    color: '#00ff88',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Analyzing...
                  </div>
                )}
              </>
            )}

            {cameraState === 'loading' && (
              <div className="webcam-placeholder">
                <div className="spinner" />
                <span>Requesting camera...</span>
              </div>
            )}

            {cameraState === 'denied' && (
              <div className="webcam-placeholder">
                <span style={{ fontSize: 36 }}>🚫</span>
                <span>Camera access denied</span>
                <span style={{ fontSize: 11, color: '#444' }}>Allow camera in browser settings</span>
              </div>
            )}

            {cameraState === 'unavailable' && (
              <div className="webcam-placeholder">
                <span style={{ fontSize: 36 }}>📷</span>
                <span>No camera available</span>
              </div>
            )}
          </div>

          <div className="webcam-controls">
            <label style={{ fontSize: 11, color: '#666' }}>Detecting:</label>
            <select
              className="webcam-select"
              value={currentAction}
              onChange={(e) => setCurrentAction(e.target.value)}
            >
              <option value="taking a supplement">Taking supplement</option>
              <option value="drinking water">Drinking water</option>
              <option value="eating a meal">Eating meal</option>
              <option value="exercising">Exercising</option>
              <option value="meditation">Meditation</option>
            </select>
            <button
              className="analyze-btn"
              onClick={analyzeFrame}
              disabled={isAnalyzing || cameraState !== 'active' || backendStatus !== 'connected'}
            >
              {isAnalyzing ? '...' : 'Analyze Now'}
            </button>
          </div>

          {watchData && (
            <div className="watch-data-bar">
              <span>🏃 {watchData.steps_today} steps</span>
              <span>😤 {watchData.stress_level}</span>
              <span>⏱️ {watchData.active_minutes} min active</span>
            </div>
          )}
        </div>

        {/* Detection Events Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📸 Detection Events</span>
            <span style={{ fontSize: 11, color: '#555' }}>{events.length} events</span>
          </div>

          <div className="events-list">
            {events.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 200,
                color: '#444',
                gap: 8
              }}>
                <span style={{ fontSize: 36 }}>👁️</span>
                <span>No events detected yet</span>
                <span style={{ fontSize: 11 }}>Camera will auto-analyze every 5 seconds</span>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="event-item">
                  <span className="event-icon">{event.icon}</span>
                  <div className="event-content">
                    <div className="event-title">{event.item}</div>
                    <div className="event-meta">
                      {new Date(event.timestamp).toLocaleTimeString()} · {event.confidence}% confidence
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ 
        marginTop: 24, 
        paddingTop: 16, 
        borderTop: '1px solid #1a1a2e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 11, color: '#444' }}>Blueprint Health Optimizer · Powered by MCP</span>
        <span style={{ fontSize: 11, color: '#333' }}>
          Backend: {backendStatus === 'connected' ? '✅ localhost:8000' : '❌ offline'}
        </span>
      </footer>
    </div>
  );
}

export default App;
