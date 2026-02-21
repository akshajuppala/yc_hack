import { z } from "zod";

export const nutritionSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  sugar: z.number(),
});

export const foodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  timestamp: z.string(),
  nutrition: nutritionSchema,
});

export const propSchema = z.object({
  foods: z.array(foodItemSchema).describe("List of all food items captured"),
  totals: nutritionSchema.describe("Total nutritional values"),
  categoryBreakdown: z.record(z.string(), z.number()).describe("Count of foods by category"),
  itemCount: z.number().describe("Total number of food items"),
});

export type NutritionDashboardProps = z.infer<typeof propSchema>;
export type FoodItem = z.infer<typeof foodItemSchema>;
export type Nutrition = z.infer<typeof nutritionSchema>;
