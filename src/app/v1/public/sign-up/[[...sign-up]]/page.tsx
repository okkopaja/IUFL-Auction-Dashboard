import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/v1/public/sign-in");
}
