interface MainMenuProps {
  capturedCount: number;
  onScanFood: () => void;
  onViewDashboard: () => void;
}

export default function MainMenu({ capturedCount, onScanFood, onViewDashboard }: MainMenuProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold">NutriScan</h1>
            <p className="text-white/80">Healthcare Food Tracker</p>
          </div>
        </div>
      </div>

      {/* Session Status */}
      {capturedCount > 0 && (
        <div className="mx-6 -mt-4 relative z-10">
          <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Current Session</p>
                <p className="font-semibold text-slate-800 dark:text-white">{capturedCount} item{capturedCount !== 1 ? 's' : ''} tracked</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg">🍎</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Options */}
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">What would you like to do?</h2>

        {/* Scan Food */}
        <button
          onClick={onScanFood}
          className="w-full p-5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-2xl text-white text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Scan Food</h3>
              <p className="text-white/80 text-sm">Use your camera to identify food items</p>
            </div>
            <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* View Dashboard */}
        <button
          onClick={onViewDashboard}
          className="w-full p-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl text-white text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">View Dashboard</h3>
              <p className="text-white/80 text-sm">See your nutritional analysis</p>
            </div>
            <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
          Point your camera at food to automatically identify and track nutrition
        </p>
      </div>
    </div>
  );
}
