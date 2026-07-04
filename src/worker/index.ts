import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "./types";
import authRouter from "./routes/auth";
import meRouter from "./routes/me";
import transactionsRouter from "./routes/transactions";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PUT"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.route("/api", authRouter);
app.route("/api/me", meRouter);
app.route("/api/transactions", transactionsRouter);

export default app;
