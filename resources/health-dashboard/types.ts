import { z } from "zod";

export const propSchema = z.object({
  view: z.enum(["live", "morning", "full_day"]),
  vitals: z.object({
    startTime: z.string(),
    intervalMs: z.number(),
    heartRate: z.array(z.number()),
    hrv: z.array(z.number()),
    spo2: z.array(z.number()),
    skinTemp: z.array(z.number()),
  }),
  cameraEvents: z.array(
    z.object({
      id: z.number(),
      timestamp: z.string(),
      type: z.string(),
      item: z.string(),
      dose: z.string().optional(),
      confidence: z.number(),
      status: z.string(),
      icon: z.string(),
    })
  ),
  protocol: z.array(
    z.object({
      name: z.string(),
      dose: z.string(),
      scheduledTime: z.string(),
      actualTime: z.string().nullable(),
      status: z.string(),
      detectedBy: z.string().nullable(),
      category: z.string(),
      note: z.string().optional(),
    })
  ),
  nutrition: z.object({
    targetCalories: z.number(),
    targetMacros: z.object({
      protein: z.object({ target: z.number(), unit: z.string() }),
      fat: z.object({ target: z.number(), unit: z.string() }),
      carbs: z.object({ target: z.number(), unit: z.string() }),
      fiber: z.object({ target: z.number(), unit: z.string() }),
    }),
    meals: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        time: z.string(),
        calories: z.number(),
        macros: z.object({
          protein: z.number(),
          fat: z.number(),
          carbs: z.number(),
          fiber: z.number(),
        }),
        status: z.string(),
        detectedBy: z.string().nullable(),
      })
    ),
  }),
  profileName: z.string(),
  date: z.string(),
  summary: z.object({
    adherenceScore: z.number(),
    takenCount: z.number(),
    totalCount: z.number(),
    latestHR: z.number(),
    latestHRV: z.number(),
    caloriesConsumed: z.number(),
    caloriesTarget: z.number(),
  }),
});

export type HealthDashboardProps = z.infer<typeof propSchema>;
