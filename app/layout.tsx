import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { DateRangeProvider } from "@/lib/DateRangeContext"; // Import the DateRangeProvider
import { SidebarProvider } from "@/components/Sidebar-Context" // Your global context
import { KnowbyDataProvider } from "@/lib/KnowbyDataProvider"
import { cn } from "@/lib/utils"
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knowby Dashboard",
  description: "Dashboard for Knowby Analytics",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} flex h-screen overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <KnowbyDataProvider>
            <SidebarProvider>
              <DateRangeProvider>
              <Toaster 
                  position="top-right" 
                  richColors 
                  closeButton 
                />
                <div className="hidden md:flex border-r bg-sidebar text-sidebar-foreground inset-shadow-sm/10">
                  <Sidebar />
                </div>
                <main className="flex flex-col w-full h-full">
                  <Header />
                   <div
                    className={cn(
                      "flex-1 overflow-y-auto -mt-12 pt-16 pb-10",
                      "px-3 sm:px-5 md:px-8 lg:px-16 xl:px-24 2xl:px-30"
                    )}
                  >
                    {children}
                    <SpeedInsights />
                  </div>
                </main>
              </DateRangeProvider>
            </SidebarProvider>
          </KnowbyDataProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}