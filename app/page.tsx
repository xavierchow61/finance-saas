import { redirect } from "next/navigation";

export default function Home() {
  // Middleware 會處理 redirect，呢度只係 fallback
  redirect("/dashboard");
}
