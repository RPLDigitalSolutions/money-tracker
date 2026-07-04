import { Hono } from "hono";
import { Bindings, Variables, AuthContext } from "../types";
import { authMiddleware } from "../middleware";

const meRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

meRouter.use("/*", authMiddleware);

meRouter.get("/", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const userData = await c.env.D1.prepare("SELECT id, username, current_balance FROM users WHERE id = ?")
    .bind(user.id)
    .first();
  return c.json(userData);
});

meRouter.put("/", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const { username, encrypted_private_key } = await c.req.json();
  
  try {
    if (username) {
        await c.env.D1.prepare("UPDATE users SET username = ? WHERE id = ?")
            .bind(username, user.id)
            .run();
    }
    
    if (encrypted_private_key) {
        await c.env.D1.prepare("UPDATE users SET private_key = ? WHERE id = ?")
            .bind(JSON.stringify(encrypted_private_key), user.id)
            .run();
    }
    
    return c.json({ success: true, message: "Profile updated" });
  } catch (e) {
    return c.json({ error: "Update failed" }, 400);
  }
});

export default meRouter;
