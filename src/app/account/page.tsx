import { session } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";
export default async function Account() {
  const { user } = await session();
  return <AuthForm mode="change" email={user.email} />;
}
