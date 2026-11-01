import { redirect } from "next/navigation";
import { configured } from "@/lib/database";
import { AuthForm } from "@/components/auth-form";
export default function Forgot() {
  if (!configured()) redirect("/setup");
  return <AuthForm mode="recovery" />;
}
