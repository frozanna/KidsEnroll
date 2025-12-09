import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Nieprawidłowy email" }),
  password: z.string(),
});

export const registerSchema = z
  .object({
    email: z.string().email({ message: "Nieprawidłowy email" }),
    password: z
      .string()
      .min(8, { message: "Hasło min. 8 znaków" })
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Hasło musi zawierać literę i cyfrę" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Hasła muszą być takie same",
  });

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterDTO = z.infer<typeof registerSchema>;
