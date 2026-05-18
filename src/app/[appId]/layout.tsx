import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/ui/shell/AppShell";
import { isRegisteredAppId } from "@/ui/shell/appRegistry";

type AppRouteLayoutProps = {
  children: ReactNode;
  params: Promise<{
    appId: string;
  }>;
};

export default async function AppRouteLayout({
  children,
  params,
}: AppRouteLayoutProps) {
  const { appId } = await params;

  if (!isRegisteredAppId(appId)) {
    notFound();
  }

  return (
    <>
      <AppShell />
      {children}
    </>
  );
}
