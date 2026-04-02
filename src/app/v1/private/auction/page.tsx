import { redirect } from "next/navigation";

export default function AuctionPage() {
  redirect("/v1/private/auction/dashboard");
}
