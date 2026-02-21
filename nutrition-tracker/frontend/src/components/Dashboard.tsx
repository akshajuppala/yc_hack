import { useState, useEffect } from 'react';
import { getDashboard, clearSession, type DashboardData, type FoodItem } from '../lib/mcpClient';

interface DashboardProps {
  onBack: () => void;
  onAddMore: () => void;
  onSessionCleared: () => void;
}

const categoryColors: Record<string, string> = {
  fruit: 'bg-orange-500',
  vegetable: 'bg-green-500',
  protein: 'bg-red-500',
  dairy: 'bg-blue-400',
  grain: 'bg-amber-600',
  snack: 'bg-purple-500',
  beverage: 'bg-cyan-500',
  dessert: 'bg-pink-500',
  meal: 'bg-indigo-500',
  supplement: 'bg-emerald-600',
};

const categoryIcons: Record<string, string> = {
  fruit: '🍎',
  vegetable: '🥬',
  protein: '🍗',
  dairy: '🥛',
  grain: '🍞',
  snack: '🍿',
  beverage: '🥤',
  dessert: '🍰',
  meal: '🍽️',
  supplement: '💊',
};

interface NutritionBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}

function NutritionBar({ label, value, max, color, unit = 'g' }: NutritionBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard({ onBack, onAddMore, onSessionCleared }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'foods' | 'breakdown'>('overview');
  const [isClearing, setIsClearing] = useState(false);

  const dailyTargets = {
    calories: 2000,
    protein: 50,
    carbs: 300,
    fat: 65,
    fiber: 25,
    sugar: 50,
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getDashboard();
      setData(result);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      await clearSession();
      setData({ foods: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }, categoryBreakdown: {}, itemCount: 0 });
      onSessionCleared();
    } catch (err) {
      console.error('Clear error:', err);
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 animate-pulse" />
          <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadDashboard} className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  const { foods = [], totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }, categoryBreakdown = {}, itemCount = 0 } = data || {};
  const isEmpty = itemCount === 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg">Nutrition Dashboard</h1>
              <p className="text-white/70 text-xs">{itemCount} item{itemCount !== 1 ? 's' : ''} tracked</p>
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

      {isEmpty ? (
        <div className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">No Food Tracked Yet</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Start scanning food items to see your nutritional analysis</p>
          <button
            onClick={onAddMore}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl cursor-pointer"
          >
            Scan Food Now
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {(['overview', 'foods', 'breakdown'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'text-blue-500 border-b-2 border-blue-500'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Calorie Card */}
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white/70 text-sm">Total Calories</p>
                      <p className="text-4xl font-bold">{Math.round(totals.calories)}</p>
                    </div>
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🔥</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${Math.min((totals.calories / dailyTargets.calories) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-white/70 text-xs mt-2">
                    {Math.round((totals.calories / dailyTargets.calories) * 100)}% of {dailyTargets.calories} daily target
                  </p>
                </div>

                {/* Macros Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{totals.protein.toFixed(1)}g</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Protein</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-500">{totals.carbs.toFixed(1)}g</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Carbs</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-500">{totals.fat.toFixed(1)}g</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fat</p>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Daily Progress</h3>
                  <NutritionBar label="Protein" value={totals.protein} max={dailyTargets.protein} color="bg-blue-500" />
                  <NutritionBar label="Carbs" value={totals.carbs} max={dailyTargets.carbs} color="bg-amber-500" />
                  <NutritionBar label="Fat" value={totals.fat} max={dailyTargets.fat} color="bg-red-500" />
                  <NutritionBar label="Fiber" value={totals.fiber} max={dailyTargets.fiber} color="bg-green-500" />
                  <NutritionBar label="Sugar" value={totals.sugar} max={dailyTargets.sugar} color="bg-pink-500" />
                </div>
              </div>
            )}

            {activeTab === 'foods' && (
              <div className="space-y-3">
                {foods.map((food: FoodItem) => (
                  <div
                    key={food.id}
                    className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 ${categoryColors[food.category] || 'bg-gray-500'} rounded-xl flex items-center justify-center text-2xl`}>
                      {categoryIcons[food.category] || '🍽️'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-white capitalize">{food.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{food.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-800 dark:text-white">{food.nutrition.calories} cal</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        P:{food.nutrition.protein}g C:{food.nutrition.carbs}g F:{food.nutrition.fat}g
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'breakdown' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 dark:text-white">Category Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(categoryBreakdown).map(([category, count]) => (
                    <div key={category} className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${categoryColors[category] || 'bg-gray-500'} rounded-lg flex items-center justify-center text-xl`}>
                        {categoryIcons[category] || '🍽️'}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="capitalize font-medium text-slate-700 dark:text-slate-200">{category}</span>
                          <span className="text-slate-500 dark:text-slate-400">{count} item{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${categoryColors[category] || 'bg-gray-500'} rounded-full`}
                            style={{ width: `${(count / itemCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Macro Pie */}
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mt-4">
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Macro Distribution</h3>
                  <div className="flex items-center justify-center gap-6">
                    <div className="relative w-28 h-28">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        {(() => {
                          const total = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
                          const proteinPct = total > 0 ? (totals.protein * 4 / total) * 100 : 33.33;
                          const carbsPct = total > 0 ? (totals.carbs * 4 / total) * 100 : 33.33;
                          const fatPct = total > 0 ? (totals.fat * 9 / total) * 100 : 33.34;

                          return (
                            <>
                              <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#3b82f6" strokeWidth="3"
                                strokeDasharray={`${proteinPct} ${100 - proteinPct}`} strokeDashoffset="0" />
                              <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#f59e0b" strokeWidth="3"
                                strokeDasharray={`${carbsPct} ${100 - carbsPct}`} strokeDashoffset={`${-proteinPct}`} />
                              <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#ef4444" strokeWidth="3"
                                strokeDasharray={`${fatPct} ${100 - fatPct}`} strokeDashoffset={`${-(proteinPct + carbsPct)}`} />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Protein</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Carbs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Fat</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            <button
              onClick={onAddMore}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl cursor-pointer"
            >
              Add More Food
            </button>
            <button
              onClick={handleClear}
              disabled={isClearing}
              className="px-4 py-3 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isClearing ? '...' : 'Clear'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
