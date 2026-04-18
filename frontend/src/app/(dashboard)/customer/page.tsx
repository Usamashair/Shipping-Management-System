import { redirect } from "next/navigation";

export default function CustomerIndexPage() {
  redirect("/customer/shipments");
}
