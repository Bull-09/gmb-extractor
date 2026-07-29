import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

const COOKIE_NAME = "mapmint_session";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function expectedSessionToken() {
  const password = process.env.INTERNAL_ACCESS_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) return null;
  return digest(`${password}:${secret}`);
}

export async function getAppUser(): Promise<ChatGPTUser | null> {
  const platformUser = await getChatGPTUser();
  if (platformUser) return platformUser;

  const expected = await expectedSessionToken();
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!expected || !token || token !== expected) return null;

  return {
    displayName: "Nivaro Team",
    email: "Internal access",
    fullName: "Nivaro Team",
  };
}

export async function requireAppUser(): Promise<ChatGPTUser> {
  const user = await getAppUser();
  if (user) return user;
  redirect("/login");
}

export const sessionCookieName = COOKIE_NAME;
