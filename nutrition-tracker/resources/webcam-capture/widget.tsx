import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "react-router";
import "../styles.css";
import type { WebcamCaptureProps, CapturedFood } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description: "Webcam capture interface for scanning and identifying food items",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Opening camera...",
    invoked: "Camera ready",
    csp: {
      resourceDomains: ["blob:", "data:"],
    },
  },
};

const WebcamCapture: React.FC = () => {
  const { props, isPending, theme, sendFollowUpMessage } = useWidget<WebcamCaptureProps>();
  const isDark = theme === "dark";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedFoods, setCapturedFoods] = useState<CapturedFood[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { callTool: analyzeImage, isPending: isAnalyzing } = useCallTool<{ imageBase64: string }>("analyze_food_image");
  const { callTool: goToMenu } = useCallTool<Record<string, never>>("start_session");
  const { callTool: goToDashboard } = useCallTool<Record<string, never>>("get_nutrition_dashboard");

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please ensure camera permissions are granted.");
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL("image/jpeg", 0.8);
    setLastResult(null);

    try {
      const result = await analyzeImage({ imageBase64 }) as { content?: Array<{ type: string; text?: string }> } | undefined;
      const textContent = result?.content?.find((c) => c.type === "text");
      if (textContent && textContent.text) {
        const parsed = JSON.parse(textContent.text);
        if (parsed.success && parsed.food) {
          setCapturedFoods(prev => [...prev, {
            id: parsed.food.id,
            name: parsed.food.name,
            category: parsed.food.category,
            calories: parsed.food.nutrition.calories,
          }]);
          setLastResult(`✓ ${parsed.food.name} (${parsed.food.nutrition.calories} cal)`);
        } else {
          setLastResult(parsed.message || "Could not identify food");
        }
      }
    } catch {
      setLastResult("Error analyzing image");
    }
  }, [analyzeImage]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (isPending) {
    return (
      <McpUseProvider>
        <div className="min-h-[500px] flex items-center justify-center bg-surface-elevated border border-default rounded-3xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 animate-pulse" />
            <p className="text-secondary">Initializing camera...</p>
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const allFoods = [...(props.sessionFoods || []), ...capturedFoods];

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className={`min-h-[550px] bg-surface-elevated border border-default rounded-3xl overflow-hidden ${isDark ? "dark" : ""}`}>
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
                onClick={() => goToMenu({})}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Camera View */}
          <div className="relative bg-black">
            {error ? (
              <div className="h-72 flex items-center justify-center p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
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
                  className="w-full h-72 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/30 rounded-2xl">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                  </div>
                </div>

                {/* Result overlay */}
                {lastResult && (
                  <div className={`absolute bottom-4 left-4 right-4 px-4 py-3 rounded-xl text-center font-medium ${
                    lastResult.startsWith("✓") ? "bg-green-500/90 text-white" : "bg-yellow-500/90 text-black"
                  }`}>
                    {lastResult}
                  </div>
                )}

                {/* Analyzing overlay */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-12 h-12 mx-auto mb-3 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      <p className="font-medium">Analyzing food...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Capture Button */}
          <div className="p-4 flex justify-center">
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

          {/* Captured Foods List */}
          {allFoods.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-default">Captured Items ({allFoods.length})</h3>
                <button
                  onClick={() => goToDashboard({})}
                  className="text-xs text-info hover:underline cursor-pointer"
                >
                  View Dashboard →
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allFoods.slice(-5).map((food, idx) => (
                  <span
                    key={food.id || idx}
                    className="px-3 py-1.5 bg-surface border border-default rounded-full text-xs font-medium capitalize"
                  >
                    {food.name}
                  </span>
                ))}
                {allFoods.length > 5 && (
                  <span className="px-3 py-1.5 bg-surface border border-default rounded-full text-xs text-secondary">
                    +{allFoods.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Manual Input Hint */}
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-secondary">
              Camera not working? Ask: "Add [food name] to my session"
            </p>
          </div>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default WebcamCapture;
