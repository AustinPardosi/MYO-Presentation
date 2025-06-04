"use client";

import "./globals.css";
import { GrammarlyRemover } from "@/components/ui/GrammarlyRemover";
import { Toaster } from "@/components/ui/sonner";
import { MyoConsoleLogger } from "@/components/ui/MyoConsoleLogger";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                {/* <SidebarProvider>
                    {!isViewer && <AppSidebar />}
                    <main className="w-full">
                        {!isViewer && <SidebarTrigger />}
                        {children}
                    </main>
                </SidebarProvider> */}
                <main className="w-full">
                    {children}
                </main>
                <Toaster />
                <GrammarlyRemover />
                {/* MyoConsoleLogger untuk mendeteksi gerakan Myo dan mencetaknya ke konsol */}
                <MyoConsoleLogger />
            </body>
        </html>
    );
}
