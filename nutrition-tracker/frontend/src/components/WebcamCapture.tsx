import { useRef, useState, useCallback, useEffect } from 'react';
import { analyzeFood, addFoodManually, type AnalyzeResult } from '../lib/mcpClient';

interface CapturedFood {
  id: string;
  name: string;
  category: string;
  calories: number;
}

interface WebcamCaptureProps {
  onBack: () => void;
  onViewDashboard: () => void;
  onFoodCaptured: () => void;
}

export default function WebcamCapture({ onBack, onViewDashboard, onFoodCaptured }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedFoods, setCapturedFoods] = useState<CapturedFood[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('meal');

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please ensure camera permissions are granted.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    setLastResult(null);
    setIsAnalyzing(true);

    try {
      const result: AnalyzeResult = await analyzeFood(imageBase64);
      if (result.success && result.food) {
        setCapturedFoods(prev => [...prev, {
          id: result.food!.id,
          name: result.food!.name,
          category: result.food!.category,
          calories: result.food!.nutrition.calories,
        }]);
        setLastResult(`✓ ${result.food.name} (${result.food.nutrition.calories} cal)`);
        onFoodCaptured();
      } else {
        const msg = result.message || 'Could not identify food';
        if (msg.includes('API key') || msg.includes('401') || msg.includes('authentication')) {
          setLastResult('⚠️ OpenAI API key not configured. Add to .env file.');
        } else {
          setLastResult(msg);
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('Incorrect API')) {
        setLastResult('⚠️ OpenAI API key missing or invalid. Create .env file.');
      } else {
        setLastResult('Error analyzing image. Check console for details.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [onFoodCaptured]);

  const handleManualAdd = async () => {
    if (!manualName.trim()) return;
    
    try {
      await addFoodManually(manualName, manualCategory);
      setCapturedFoods(prev => [...prev, {
        id: `manual_${Date.now()}`,
        name: manualName,
        category: manualCategory,
        calories: 150,
      }]);
      setLastResult(`✓ Added ${manualName}`);
      setManualName('');
      setShowManualInput(false);
      onFoodCaptured();
    } catch (err) {
      setLastResult('Error adding food');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg">Scan Food</h1>
              <p className="text-white/70 text-xs">Point camera at food items</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Camera View */}
      <div className="relative bg-black aspect-[4/3]">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-400 mb-4 text-sm">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning Frame */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-white/30 rounded-2xl">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
              </div>
            </div>

            {/* Result Overlay */}
            {lastResult && (
              <div className={`absolute bottom-4 left-4 right-4 px-4 py-3 rounded-xl text-center font-medium text-sm ${
                lastResult.startsWith('✓') ? 'bg-green-500/90 text-white' : 'bg-yellow-500/90 text-black'
              }`}>
                {lastResult}
              </div>
            )}

            {/* Analyzing Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-12 h-12 mx-auto mb-3 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="font-medium">Analyzing food...</p>
                  <p className="text-white/70 text-xs mt-1">Using AI to identify</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture Button */}
      <div className="p-4 flex justify-center bg-slate-50 dark:bg-slate-900">
        <button
          onClick={captureImage}
          disabled={!isStreaming || isAnalyzing}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg transform active:scale-95 transition-transform cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white" />
          </div>
        </button>
      </div>

      {/* Manual Input */}
      {showManualInput && (
        <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <input
              type="text"
              placeholder="Food name (e.g., Apple, Pizza)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
            />
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
            >
              <option value="fruit">Fruit</option>
              <option value="vegetable">Vegetable</option>
              <option value="protein">Protein</option>
              <option value="dairy">Dairy</option>
              <option value="grain">Grain</option>
              <option value="snack">Snack</option>
              <option value="beverage">Beverage</option>
              <option value="dessert">Dessert</option>
              <option value="meal">Meal</option>
              <option value="supplement">Supplement</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleManualAdd}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                Add Food
              </button>
              <button
                onClick={() => setShowManualInput(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captured Foods */}
      {capturedFoods.length > 0 && (
        <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Captured ({capturedFoods.length})</h3>
            <button
              onClick={onViewDashboard}
              className="text-xs text-blue-500 hover:underline cursor-pointer"
            >
              View Dashboard →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {capturedFoods.slice(-5).map((food) => (
              <span
                key={food.id}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-medium capitalize text-slate-700 dark:text-slate-300"
              >
                {food.name}
              </span>
            ))}
            {capturedFoods.length > 5 && (
              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs text-slate-500">
                +{capturedFoods.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-900">
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-blue-500 cursor-pointer py-2"
        >
          {showManualInput ? 'Use camera instead' : 'Camera not working? Add manually'}
        </button>
      </div>
    </div>
  );
}
