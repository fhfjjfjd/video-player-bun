import { z } from "zod";

const usernameRe = /^[A-Za-z0-9_]{3,32}$/;
const gmailRe = /^[^@\s]+@gmail\.com$/i;

const usernameMessage = "Username phải gồm 3–32 ký tự chữ, số hoặc gạch dưới.";
const passwordMessage = "Password phải có ít nhất 6 ký tự.";
const emailMessage = "Email phải là tài khoản Gmail hợp lệ (…@gmail.com).";
const loginMissingMessage = "Thiếu Gmail/username hoặc password.";

export const loginSchema = z.object({
  username: z.string().min(1, loginMissingMessage),
  password: z.string().min(6, passwordMessage),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z.string().regex(usernameRe, usernameMessage),
  email: z.string().regex(gmailRe, emailMessage),
  password: z.string().min(6, passwordMessage),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export type FieldErrors = Record<string, string>;

/** Validate plain form data against a zod schema; returns per-field messages. */
export function validateForm(schema: z.ZodTypeAny, data: unknown): FieldErrors {
  const result = schema.safeParse(data);
  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
