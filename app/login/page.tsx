import { redirect } from "next/navigation";

// Canonical login URL. The actual Google sign-in lives at /sign-in (NextAuth's
// configured signIn page); /login is the friendly entry point the landing links to.
export default function LoginPage() {
  redirect("/sign-in");
}
