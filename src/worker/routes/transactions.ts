import { Hono } from "hono";
import { Bindings, Variables, AuthContext } from "../types";
import { authMiddleware } from "../middleware";

const transactionsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

transactionsRouter.use("/*", authMiddleware);

transactionsRouter.get("/", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const results = await c.env.D1.prepare(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC"
  )
    .bind(user.id)
    .all();
  return c.json(results.results);
});

transactionsRouter.post("/", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const { type, amount, category, notes, date, new_balance } = await c.req.json();
  
  await c.env.D1.prepare(
    `INSERT INTO transactions 
    (user_id, transaction_type, transaction_date, amount, category_name, notes) 
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(user.id, type, date, amount, category, notes)
    .run();
    
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

transactionsRouter.put("/:id", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const id = c.req.param("id");
  const { type, amount, category, notes, date, new_balance } = await c.req.json();
  
  const tx = await c.env.D1.prepare("SELECT user_id FROM transactions WHERE id = ?").bind(id).first();
  if (!tx || tx.user_id !== user.id) {
    return c.json({ error: "Not found or unauthorized" }, 404);
  }
  
  await c.env.D1.prepare(
    `UPDATE transactions 
     SET transaction_type = ?, transaction_date = ?, amount = ?, category_name = ?, notes = ? 
     WHERE id = ?`
  )
    .bind(type, date, amount, category, notes, id)
    .run();
    
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

transactionsRouter.delete("/:id", async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const id = c.req.param("id");
  const { new_balance } = await c.req.json();
  
  const tx = await c.env.D1.prepare("SELECT user_id FROM transactions WHERE id = ?").bind(id).first();
  if (!tx || tx.user_id !== user.id) {
    return c.json({ error: "Not found or unauthorized" }, 404);
  }
  
  await c.env.D1.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
  
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

export default transactionsRouter;
