import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Nieprawidłowy email" }),
  password: z.string(),
});

export type LoginDTO = z.infer<typeof loginSchema>;
