'use client';

import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { GrammarlyRemover } from "@/components/ui/GrammarlyRemover";
import { Toaster } from "@/components/ui/sonner";
import { useSearchParams } from "next/navigation";

// export const metadata: Metadata = {
//     title: "MYO Present",
//     description: "Presentation Controller with Myo",
// };

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const searchParams = useSearchParams();
    const isViewer = searchParams.get("viewer") === "true";

    return (
        <html lang="en">
            <body>
                <SidebarProvider>
                    {!isViewer && <AppSidebar />}
                    <main className="w-full">
                        {!isViewer && <SidebarTrigger />}
                        {children}
                    </main>
                </SidebarProvider>
                <Toaster />
                <GrammarlyRemover />
            </body>
        </html>
    );
}
