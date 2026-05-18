import { redirect } from "next/navigation";
import { defaultAppId, getAppPath } from "@/ui/shell/appRegistry";

export default function Home() {
  redirect(getAppPath(defaultAppId));
}
