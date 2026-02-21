import { z } from "zod";

export const propSchema = z.object({
  sessionFoods: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
    })
  ).describe("List of foods already captured in this session"),
});

export type WebcamCaptureProps = z.infer<typeof propSchema>;

export interface CapturedFood {
  id: string;
  name: string;
  category: string;
  calories: number;
}
