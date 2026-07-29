import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";
import ExtractorClient from "./ExtractorClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");

  return (
    <ExtractorClient
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
