import LoginLanding from "../LoginLanding";

// The login page IS the landing splash (animated backdrop + Google sign-in +
// a link into the public /demo). NextAuth is configured with pages.signIn = "/sign-in".
export default function SignInPage() {
  return <LoginLanding />;
}
