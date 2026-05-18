import { notFound } from "next/navigation";
import { apps, isRegisteredAppId } from "@/ui/shell/appRegistry";

type AppPageProps = {
  params: Promise<{
    appId: string;
  }>;
};

export default async function AppPage({ params }: AppPageProps) {
  const { appId } = await params;

  if (!isRegisteredAppId(appId)) {
    notFound();
  }

  return null;
}

export function generateStaticParams() {
  return apps.map((app) => ({
    appId: app.id,
  }));
}
