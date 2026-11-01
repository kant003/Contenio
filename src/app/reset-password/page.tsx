import { session } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) await session();
  return <AuthForm mode="password" resetToken={token} />;
}
