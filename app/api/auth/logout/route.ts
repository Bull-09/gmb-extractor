import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "../../../internal-auth";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
