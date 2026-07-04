

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}


export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}



export type UserIdentity = {
  authKeys: CryptoKeyPair; 
  dataKey: CryptoKey;      
};

export type EncryptedIdentity = {
  salt: string; 
  iv: string;   
  ciphertext: string; 
};

export async function generateIdentity(): Promise<UserIdentity> {
  const authKeys = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const dataKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  return { authKeys, dataKey };
}


async function deriveWrapperKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}


export async function encryptIdentity(identity: UserIdentity, password: string): Promise<EncryptedIdentity> {
  
  const privateAuthJwk = await window.crypto.subtle.exportKey("jwk", identity.authKeys.privateKey);
  const publicAuthJwk = await window.crypto.subtle.exportKey("jwk", identity.authKeys.publicKey);
  const dataKeyJwk = await window.crypto.subtle.exportKey("jwk", identity.dataKey);

  const payload = JSON.stringify({
    auth: privateAuthJwk,
    authPub: publicAuthJwk,
    data: dataKeyJwk
  });

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const wrapperKey = await deriveWrapperKey(password, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    wrapperKey,
    enc.encode(payload)
  );

  return {
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedContent),
  };
}


export async function decryptIdentity(encryptedId: EncryptedIdentity, password: string): Promise<UserIdentity> {
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedId.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedId.iv));
  const ciphertext = base64ToArrayBuffer(encryptedId.ciphertext);

  const wrapperKey = await deriveWrapperKey(password, salt);

  try {
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      wrapperKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const payload = JSON.parse(dec.decode(decryptedContent));

    const authPrivateKey = await window.crypto.subtle.importKey(
      "jwk",
      payload.auth,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign"]
    );

    let authPublicKey: CryptoKey;
    if (payload.authPub) {
       authPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        payload.authPub,
        {
          name: "ECDSA",
          namedCurve: "P-256",
        },
        true,
        ["verify"]
      );
    } else {
        
        const privateJwk = await window.crypto.subtle.exportKey("jwk", authPrivateKey);
        authPublicKey = await window.crypto.subtle.importKey(
            "jwk",
            {
                kty: privateJwk.kty,
                crv: privateJwk.crv,
                x: privateJwk.x,
                y: privateJwk.y,
            },
            {
                name: "ECDSA",
                namedCurve: "P-256",
            },
            true,
            ["verify"]
        );
    }
    
    const dataKey = await window.crypto.subtle.importKey(
        "jwk",
        payload.data,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );

    return {
        authKeys: { privateKey: authPrivateKey, publicKey: authPublicKey },
        dataKey
    };

  } catch {
    throw new Error("Incorrect password or corrupted key data");
  }
}


export async function exportPublicKey(key: CryptoKey): Promise<string> {
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(jwk);
}



export async function signChallenge(privateKey: CryptoKey, challenge: string): Promise<string> {
    const enc = new TextEncoder();
    const signature = await window.crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        privateKey,
        enc.encode(challenge)
    );
    return arrayBufferToBase64(signature);
}

export async function encryptData(text: string, key: CryptoKey): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        enc.encode(text)
    );
    
    
    return arrayBufferToBase64(iv.buffer) + ":" + arrayBufferToBase64(ciphertext);
}

export async function decryptData(packed: string, key: CryptoKey): Promise<string> {
    try {
        const parts = packed.split(":");
        if (parts.length !== 2) throw new Error("Invalid format");
        
        const iv = base64ToArrayBuffer(parts[0]);
        const ciphertext = base64ToArrayBuffer(parts[1]);
        
        const decrypted = await window.crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: iv
            },
            key,
            ciphertext
        );
        
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (e) {
        console.error("Decryption failed", e);
        return "Decryption Error";
    }
}



export async function serializeIdentity(identity: UserIdentity): Promise<string> {
    const authPrivateJwk = await window.crypto.subtle.exportKey("jwk", identity.authKeys.privateKey);
    const authPublicJwk = await window.crypto.subtle.exportKey("jwk", identity.authKeys.publicKey);
    const dataJwk = await window.crypto.subtle.exportKey("jwk", identity.dataKey);
    
    return JSON.stringify({
        authPrivate: authPrivateJwk,
        authPublic: authPublicJwk,
        data: dataJwk
    });
}

export async function deserializeIdentity(serialized: string): Promise<UserIdentity> {
    const parsed = JSON.parse(serialized);
    
    const authPrivateKey = await window.crypto.subtle.importKey(
        "jwk",
        parsed.authPrivate,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
    );
    
    const authPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        parsed.authPublic,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
    );
    
    const dataKey = await window.crypto.subtle.importKey(
        "jwk",
        parsed.data,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
    
    return {
        authKeys: { privateKey: authPrivateKey, publicKey: authPublicKey },
        dataKey
    };
}

