import { requireAppUser } from "./internal-auth";
import ExtractorClient from "./ExtractorClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireAppUser();
  const platformUser =
    user.email !== "Internal access" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <ExtractorClient
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={platformUser
        ? "/signout-with-chatgpt?return_to=%2F"
        : "/api/auth/logout"}
    />
  );
}
