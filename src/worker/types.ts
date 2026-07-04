export type Bindings = {
  D1: D1Database;
  JWT_SECRET: string;
};

export type AuthContext = {
  user: { id: number; username: string };
};

export type Variables = {
  user: { id: number; username: string };
};
