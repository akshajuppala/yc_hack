const MCP_URL = '/mcp';

interface MCPResponse {
  result?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
    isError?: boolean;
  };
  error?: {
    message: string;
  };
}

let sessionId: string | null = null;

async function initSession(): Promise<string> {
  if (sessionId) return sessionId;

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'NutriScan Frontend', version: '1.0.0' },
      },
    }),
  });

  const data = await response.json();
  sessionId = response.headers.get('mcp-session-id') || 'default';
  
  // Send initialized notification
  await fetch(MCP_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'mcp-session-id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  return sessionId;
}

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const sid = await initSession();

  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'mcp-session-id': sid,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  const data: MCPResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const textContent = data.result?.content?.find(c => c.type === 'text');
  if (textContent?.text) {
    try {
      return JSON.parse(textContent.text) as T;
    } catch {
      return textContent.text as T;
    }
  }

  return data.result as T;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  timestamp: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
}

export interface AnalyzeResult {
  success: boolean;
  food?: FoodItem;
  message: string;
}

export interface DashboardData {
  foods: FoodItem[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
  categoryBreakdown: Record<string, number>;
  itemCount: number;
}

export async function analyzeFood(imageBase64: string): Promise<AnalyzeResult> {
  return callTool<AnalyzeResult>('analyze_food_image', { imageBase64 });
}

export async function addFoodManually(name: string, category: string): Promise<string> {
  return callTool<string>('add_food_manually', { name, category });
}

export async function getDashboard(): Promise<DashboardData> {
  const result = await callTool<{ props: DashboardData }>('get_nutrition_dashboard');
  return result.props || result as unknown as DashboardData;
}

export async function clearSession(): Promise<string> {
  return callTool<string>('clear_session');
}
