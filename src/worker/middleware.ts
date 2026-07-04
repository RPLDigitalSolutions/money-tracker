import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { Bindings, Variables } from "./types";

export const authMiddleware = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  
  const token = authHeader.split(" ")[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET || "dev-secret") as { id: number; username: string };
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid Token" }, 401);
  }
};
