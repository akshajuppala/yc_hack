import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";
import OpenAI from "openai";

const server = new MCPServer({
  name: "nutrition-tracker",
  title: "NutriScan - Food Nutrition Tracker",
  version: "1.0.0",
  description: "Healthcare MCP app that recognizes food from camera and tracks nutritional intake",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

// In-memory storage for the session's food items
interface FoodItem {
  id: string;
  name: string;
  category: string;
  timestamp: string;
  imageData?: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
}

const sessionFoods: FoodItem[] = [];

// Nutritional database (approximate values per 100g)
const nutritionDatabase: Record<string, FoodItem["nutrition"]> = {
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10 },
  banana: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12 },
  orange: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9 },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 5 },
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0 },
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
  beef: { calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sugar: 0 },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0 },
  egg: { calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1 },
  milk: { calories: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0, sugar: 5 },
  cheese: { calories: 402, protein: 25, carbs: 1.3, fat: 33, fiber: 0, sugar: 0.5 },
  yogurt: { calories: 59, protein: 10, carbs: 3.6, fat: 0.7, fiber: 0, sugar: 3.2 },
  pizza: { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3, sugar: 3.6 },
  burger: { calories: 295, protein: 17, carbs: 24, fat: 14, fiber: 1.3, sugar: 5 },
  salad: { calories: 20, protein: 1.5, carbs: 3.5, fat: 0.2, fiber: 2, sugar: 1.3 },
  pasta: { calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, sugar: 0.6 },
  sandwich: { calories: 250, protein: 12, carbs: 30, fat: 9, fiber: 2, sugar: 4 },
  soup: { calories: 75, protein: 4, carbs: 10, fat: 2, fiber: 1.5, sugar: 3 },
  coffee: { calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  juice: { calories: 45, protein: 0.7, carbs: 10, fat: 0.2, fiber: 0.2, sugar: 8 },
  cookie: { calories: 488, protein: 5.5, carbs: 65, fat: 23, fiber: 2.4, sugar: 30 },
  cake: { calories: 350, protein: 5, carbs: 52, fat: 14, fiber: 1, sugar: 35 },
  ice_cream: { calories: 207, protein: 3.5, carbs: 24, fat: 11, fiber: 0.7, sugar: 21 },
  chips: { calories: 536, protein: 7, carbs: 53, fat: 35, fiber: 4.4, sugar: 0.3 },
  candy: { calories: 380, protein: 0, carbs: 95, fat: 0, fiber: 0, sugar: 90 },
  soda: { calories: 41, protein: 0, carbs: 10.6, fat: 0, fiber: 0, sugar: 10.6 },
  water: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  vegetables: { calories: 25, protein: 2, carbs: 5, fat: 0.2, fiber: 2.5, sugar: 2 },
  fruit: { calories: 50, protein: 0.5, carbs: 13, fat: 0.2, fiber: 2, sugar: 10 },
  snack: { calories: 450, protein: 6, carbs: 55, fat: 22, fiber: 2, sugar: 15 },
  default: { calories: 150, protein: 5, carbs: 20, fat: 5, fiber: 2, sugar: 5 },
};

function getNutrition(foodName: string): FoodItem["nutrition"] {
  const normalizedName = foodName.toLowerCase();
  for (const [key, value] of Object.entries(nutritionDatabase)) {
    if (normalizedName.includes(key)) {
      return value;
    }
  }
  return nutritionDatabase.default;
}

// Tool 1: Start Session - Shows main menu
server.tool(
  {
    name: "start_session",
    description: "Start the NutriScan session. Shows the main menu with options to capture food or view the nutrition dashboard.",
    schema: z.object({}),
    widget: {
      name: "main-menu",
      invoking: "Starting NutriScan...",
      invoked: "NutriScan ready",
    },
  },
  async () => {
    return widget({
      props: { 
        foodCount: sessionFoods.length,
        lastFood: sessionFoods[sessionFoods.length - 1]?.name || null
      },
      output: text("NutriScan is ready! Choose 'Scan Food' to capture food with your camera, or 'View Dashboard' to see your nutritional analysis."),
    });
  }
);

// Tool 2: Capture Food - Opens webcam widget for food capture
server.tool(
  {
    name: "capture_food",
    description: "Open the camera to capture and identify food items. The camera will recognize the food and add it to your session tracking.",
    schema: z.object({}),
    widget: {
      name: "webcam-capture",
      invoking: "Opening camera...",
      invoked: "Camera ready",
    },
  },
  async () => {
    return widget({
      props: { 
        sessionFoods: sessionFoods.map(f => ({ id: f.id, name: f.name, category: f.category }))
      },
      output: text("Camera is ready. Point your camera at food items to scan them."),
    });
  }
);

// Tool 3: Analyze Food Image - Called from webcam widget with image data
server.tool(
  {
    name: "analyze_food_image",
    description: "Analyze a food image using AI vision to identify the food and get nutritional information. This is called automatically when you capture an image.",
    schema: z.object({
      imageBase64: z.string().describe("Base64 encoded image data from the camera"),
    }),
  },
  async ({ imageBase64 }) => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this food image and respond with ONLY a JSON object in this exact format, no other text:
{"name": "food name", "category": "one of: fruit, vegetable, protein, dairy, grain, snack, beverage, dessert, meal"}

Be specific about the food item. If you see multiple items, identify the main one.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content || '{"name": "unknown food", "category": "meal"}';
      
      let parsed: { name: string; category: string };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        parsed = { name: "unknown food", category: "meal" };
      }

      const nutrition = getNutrition(parsed.name);
      const newFood: FoodItem = {
        id: `food_${Date.now()}`,
        name: parsed.name,
        category: parsed.category,
        timestamp: new Date().toISOString(),
        nutrition,
      };

      sessionFoods.push(newFood);

      return text(JSON.stringify({
        success: true,
        food: newFood,
        message: `Identified: ${parsed.name} (${parsed.category}). Added to your session with ${nutrition.calories} calories.`
      }));
    } catch (error) {
      return text(JSON.stringify({
        success: false,
        message: `Error analyzing image: ${error instanceof Error ? error.message : "Unknown error"}`
      }));
    }
  }
);

// Tool 4: Add Food Manually - For when camera doesn't work
server.tool(
  {
    name: "add_food_manually",
    description: "Manually add a food item to your session if the camera recognition doesn't work.",
    schema: z.object({
      name: z.string().describe("Name of the food item"),
      category: z.enum(["fruit", "vegetable", "protein", "dairy", "grain", "snack", "beverage", "dessert", "meal"]).describe("Category of the food"),
    }),
  },
  async ({ name, category }) => {
    const nutrition = getNutrition(name);
    const newFood: FoodItem = {
      id: `food_${Date.now()}`,
      name,
      category,
      timestamp: new Date().toISOString(),
      nutrition,
    };

    sessionFoods.push(newFood);

    return text(`Added ${name} to your session. Nutritional info: ${nutrition.calories} calories, ${nutrition.protein}g protein, ${nutrition.carbs}g carbs.`);
  }
);

// Tool 5: Get Dashboard - Shows nutritional analysis
server.tool(
  {
    name: "get_nutrition_dashboard",
    description: "View the nutrition dashboard showing all captured food items and their combined nutritional analysis for this session.",
    schema: z.object({}),
    widget: {
      name: "nutrition-dashboard",
      invoking: "Loading dashboard...",
      invoked: "Dashboard ready",
    },
  },
  async () => {
    const totals = sessionFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.nutrition.calories,
        protein: acc.protein + food.nutrition.protein,
        carbs: acc.carbs + food.nutrition.carbs,
        fat: acc.fat + food.nutrition.fat,
        fiber: acc.fiber + food.nutrition.fiber,
        sugar: acc.sugar + food.nutrition.sugar,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    );

    const categoryBreakdown = sessionFoods.reduce((acc, food) => {
      acc[food.category] = (acc[food.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return widget({
      props: {
        foods: sessionFoods,
        totals,
        categoryBreakdown,
        itemCount: sessionFoods.length,
      },
      output: text(
        sessionFoods.length > 0
          ? `Dashboard showing ${sessionFoods.length} food items. Total: ${totals.calories} calories, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat.`
          : "No food items captured yet. Use 'Scan Food' to start tracking."
      ),
    });
  }
);

// Tool 6: Clear Session
server.tool(
  {
    name: "clear_session",
    description: "Clear all captured food items from the current session.",
    schema: z.object({}),
  },
  async () => {
    const count = sessionFoods.length;
    sessionFoods.length = 0;
    return text(`Cleared ${count} food items from the session.`);
  }
);

server.listen().then(() => {
  console.log(`NutriScan server running on ${process.env.MCP_URL || "http://localhost:3000"}`);
  console.log("Available tools: start_session, capture_food, analyze_food_image, add_food_manually, get_nutrition_dashboard, clear_session");
});
