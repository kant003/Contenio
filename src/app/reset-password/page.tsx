import { redirect } from "next/navigation";
import { configured } from "@/lib/database";
import { hasActiveResetToken } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
    error?: string | string[];
  }>;
}) {
  if (!configured()) redirect("/setup");
  const search = await searchParams;
  const token = typeof search.token === "string" ? search.token : "";
  const invalid = Boolean(search.error) || !(await hasActiveResetToken(token));
  return (
    <AuthForm
      key={token || "invalid"}
      mode="reset"
      resetToken={invalid ? undefined : token}
      invalidLink={invalid}
    />
  );
}
