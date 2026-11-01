import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { configured } from "@/lib/database";
import { getAuth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function Login() {
  if (!configured()) redirect("/setup");
  if (await getAuth().api.getSession({ headers: await headers() }))
    redirect("/spaces");
  return <AuthForm />;
}
