import { NextRequest, NextResponse } from "next/server";
import { expectedSessionToken, sessionCookieName } from "../../../internal-auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const configured = process.env.INTERNAL_ACCESS_PASSWORD;

  if (!configured || password !== configured) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  }

  const token = await expectedSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Login is not configured." }, { status: 503 });
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
