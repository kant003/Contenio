import { redirect } from "next/navigation";
import { configured } from "@/lib/database";
export default function Home() {
  redirect(configured() ? "/spaces" : "/setup");
}
