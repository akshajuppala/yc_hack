import { z } from "zod";

export const propSchema = z.object({
  foodCount: z.number().describe("Number of food items captured in this session"),
  lastFood: z.string().nullable().describe("Name of the last captured food item"),
});

export type MainMenuProps = z.infer<typeof propSchema>;
