
import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";
import { verify, sign } from "hono/jwt";

type Bindings = {
  D1: D1Database;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Basic Utils
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC Helper for Stateless Challenges
async function signChallenge(text: string, secret: string) {
  if (!secret || secret === "dev-secret") {
    console.warn("WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!");
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", 
    enc.encode(secret), 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return bufferToHex(signature);
}

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

// --- Auth Routes ---

app.post("/api/register", async (c) => {
  const { username, encrypted_private_key, public_key, initial_balance } = await c.req.json();
  
  if (!username || !encrypted_private_key || !public_key) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // initial_balance is encrypted text from client
  const balance = initial_balance || "EncryptedZero"; 

  try {
    const res = await c.env.D1.prepare(
      "INSERT INTO users (username, private_key, public_key, current_balance) VALUES (?, ?, ?, ?) RETURNING id"
    )
      .bind(username, JSON.stringify(encrypted_private_key), JSON.stringify(public_key), balance)
      .first();
    
    return c.json({ success: true, id: res?.id });
  } catch (e) {
    // Log error in development only, avoid leaking sensitive info
    if (c.env.JWT_SECRET === "dev-secret") {
      console.error("Registration error:", e);
    }
    return c.json({ error: "Username already exists or database error" }, 409);
  }
});

// Step 1: Request Login Challenge
app.post("/api/auth/challenge", async (c) => {
  const { username } = await c.req.json();
  
  const user = await c.env.D1.prepare("SELECT private_key FROM users WHERE username = ?").bind(username).first();
  
  if (!user) return c.json({ error: "User not found" }, 404);
  
  const nonce = crypto.randomUUID();
  const serverSignature = await signChallenge(nonce, c.env.JWT_SECRET || "dev-secret");
  
  // Return the encrypted private key so the client can decrypt it and sign the nonce
  return c.json({
    encrypted_private_key: JSON.parse(user.private_key as string),
    nonce,
    server_signature: serverSignature
  });
});

// Step 2: Verify Challenge Signature
app.post("/api/auth/verify", async (c) => {
  const { username, nonce, signature, server_signature } = await c.req.json();
  
  // 1. Validate Server Signature (Stateless Check)
  const expectedSig = await signChallenge(nonce, c.env.JWT_SECRET || "dev-secret");
  if (expectedSig !== server_signature) {
    return c.json({ error: "Invalid challenge signature (replay or spoof)" }, 400);
  }
  
  // 2. Fetch User Public Key
  const user = await c.env.D1.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  if (!user) return c.json({ error: "User not found" }, 404);
  
  const publicKeyJwk = JSON.parse(user.public_key as string);
  
  // 3. Verify User Signature
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    
    // Signature from client is Base64, convert to Buffer
    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const dataBuffer = new TextEncoder().encode(nonce);
    
    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      publicKey,
      signatureBuffer,
      dataBuffer
    );
    
    if (!isValid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
    
    // 4. Issue JWT
    const token = await sign({ 
      id: user.id, 
      username: user.username, 
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
    }, c.env.JWT_SECRET || "dev-secret");
    
    return c.json({ token, username: user.username, public_key: publicKeyJwk });
    
  } catch (e) {
    // Log error in development only
    if (c.env.JWT_SECRET === "dev-secret") {
      console.error("Verification error:", e);
    }
    return c.json({ error: "Verification failed" }, 400);
  }
});


// --- Transaction Routes ---

// Middleware
type AuthContext = {
  user: { id: number; username: string };
};

type Variables = {
  user: { id: number; username: string };
};

const authMiddleware = async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
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

app.get("/api/me", authMiddleware, async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const userData = await c.env.D1.prepare("SELECT id, username, current_balance FROM users WHERE id = ?")
    .bind(user.id)
    .first();
  return c.json(userData);
});

app.put("/api/me", authMiddleware, async (c) => {
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
    // Log error in development only
    if (c.env.JWT_SECRET === "dev-secret") {
      console.error("Profile update error:", e);
    }
    return c.json({ error: "Update failed. Username might be taken." }, 400);
  }
});

app.get("/api/transactions", authMiddleware, async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const results = await c.env.D1.prepare(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC"
  )
    .bind(user.id)
    .all();
  return c.json(results.results);
});

app.post("/api/transactions", authMiddleware, async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const { type, amount, category, notes, date, new_balance } = await c.req.json();
  
  // Insert Tx
  await c.env.D1.prepare(
    `INSERT INTO transactions 
    (user_id, transaction_type, transaction_date, amount, category_name, notes) 
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(user.id, type, date, amount, category, notes)
    .run();
    
  // Update Balance (if provided)
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

app.put("/api/transactions/:id", authMiddleware, async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const id = c.req.param("id");
  const { type, amount, category, notes, date, new_balance } = await c.req.json();
  
  // Verify ownership
  const tx = await c.env.D1.prepare("SELECT user_id FROM transactions WHERE id = ?").bind(id).first();
  if (!tx || tx.user_id !== user.id) {
    return c.json({ error: "Not found or unauthorized" }, 404);
  }
  
  // Update transaction
  await c.env.D1.prepare(
    `UPDATE transactions 
     SET transaction_type = ?, transaction_date = ?, amount = ?, category_name = ?, notes = ? 
     WHERE id = ?`
  )
    .bind(type, date, amount, category, notes, id)
    .run();
    
  // Update Balance (if provided)
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

app.delete("/api/transactions/:id", authMiddleware, async (c) => {
  const user = c.get("user") as AuthContext["user"];
  const id = c.req.param("id");
  const { new_balance } = await c.req.json();
  
  // Verify ownership
  const tx = await c.env.D1.prepare("SELECT user_id FROM transactions WHERE id = ?").bind(id).first();
  if (!tx || tx.user_id !== user.id) {
    return c.json({ error: "Not found or unauthorized" }, 404);
  }
  
  // Delete transaction
  await c.env.D1.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
  
  // Update Balance (if provided)
  if (new_balance) {
      await c.env.D1.prepare("UPDATE users SET current_balance = ? WHERE id = ?")
        .bind(new_balance, user.id)
        .run();
  }
  
  return c.json({ success: true });
});

export default app;
