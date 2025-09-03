import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { DateRangeProvider } from "@/lib/DateRangeContext"; // Import the DateRangeProvider
import { SidebarProvider } from "@/components/Sidebar-Context" // Your global context
import { KnowbyDataProvider } from "@/lib/KnowbyDataProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knowby Dashboard",
  description: "Dashboard for Knowby Analytics",
}

//
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
                <div className="hidden md:flex border-r bg-sidebar text-sidebar-foreground inset-shadow-sm/10">
                  <Sidebar />
                </div>
                <main className="flex flex-col w-full h-full">
                  <Header />
                  <div className="flex-1 overflow-y-auto p-8 pb-32">
                    {children}
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