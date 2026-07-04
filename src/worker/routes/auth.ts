import { Hono } from "hono";
import { sign } from "hono/jwt";
import { Bindings } from "../types";
import { signChallenge } from "../utils";

const authRouter = new Hono<{ Bindings: Bindings }>();

authRouter.post("/register", async (c) => {
  const { username, encrypted_private_key, public_key, initial_balance } = await c.req.json();
  
  if (!username || !encrypted_private_key || !public_key) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const balance = initial_balance || "EncryptedZero"; 

  try {
    const res = await c.env.D1.prepare(
      "INSERT INTO users (username, private_key, public_key, current_balance) VALUES (?, ?, ?, ?) RETURNING id"
    )
      .bind(username, JSON.stringify(encrypted_private_key), JSON.stringify(public_key), balance)
      .first();
    
    return c.json({ success: true, id: res?.id });
  } catch (e) {
    return c.json({ error: "Username already exists or database error" }, 409);
  }
});

authRouter.post("/auth/challenge", async (c) => {
  const { username } = await c.req.json();
  
  const user = await c.env.D1.prepare("SELECT private_key FROM users WHERE username = ?").bind(username).first();
  
  if (!user) return c.json({ error: "User not found" }, 404);
  
  const nonce = crypto.randomUUID();
  const serverSignature = await signChallenge(nonce, c.env.JWT_SECRET || "dev-secret");
  
  return c.json({
    encrypted_private_key: JSON.parse(user.private_key as string),
    nonce,
    server_signature: serverSignature
  });
});

authRouter.post("/auth/verify", async (c) => {
  const { username, nonce, signature, server_signature } = await c.req.json();
  
  const expectedSig = await signChallenge(nonce, c.env.JWT_SECRET || "dev-secret");
  if (expectedSig !== server_signature) {
    return c.json({ error: "Invalid challenge signature" }, 400);
  }
  
  const user = await c.env.D1.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  if (!user) return c.json({ error: "User not found" }, 404);
  
  const publicKeyJwk = JSON.parse(user.public_key as string);
  
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    
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
    
    const token = await sign({ 
      id: user.id, 
      username: user.username, 
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }, c.env.JWT_SECRET || "dev-secret");
    
    return c.json({ token, username: user.username, public_key: publicKeyJwk });
    
  } catch (e) {
    return c.json({ error: "Verification failed" }, 400);
  }
});

export default authRouter;
