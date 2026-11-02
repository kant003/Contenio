import { redirect } from "next/navigation";
import { authHeaders } from "@/lib/auth-headers";
import { configured } from "@/lib/database";
import { getAuth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function Login() {
  if (!configured()) redirect("/setup");
  if (await getAuth().api.getSession({ headers: await authHeaders() }))
    redirect("/spaces");
  return <AuthForm />;
}
