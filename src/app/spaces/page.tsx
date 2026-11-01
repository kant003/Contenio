import { session } from "@/lib/session";
import { userQuery } from "@/lib/database";
import { Spaces } from "@/components/spaces";
import type { Space } from "@/lib/types";
export default async function SpacesPage() {
  const { user, isAdmin } = await session();
  const spaces = await userQuery<Space>(
    user.id,
    "select * from spaces order by created_at",
  );
  return <Spaces spaces={spaces} email={user.email ?? ""} isAdmin={isAdmin} />;
}
