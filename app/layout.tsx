import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { ThemeProvider } from "next-themes"
import { DateRangeProvider } from "@/lib/DateRangeContext"; // Import the DateRangeProvider
import { SidebarProvider } from "@/components/Sidebar-Context" // Your global context

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          {/* Wrap the entire application content that needs the date range context */}
          <DateRangeProvider>
            <div className="hidden md:flex min-w-[260px] border-r bg-sidebar text-sidebar-foreground inset-shadow-sm/10">
              <Sidebar />
            </div>
            <main className="flex flex-col w-full h-full">
              {/* Header now gets its dateRange and onDateRangeChange from the context.
                  We need to use the useDateRange hook, but hooks can only be called inside
                  function components. We can't directly use a hook here in a server component.
                  Instead, Header will be the one to use the hook.
                  For now, Header doesn't need props for date range, as it will consume the context directly.
                  This simplifies the prop drilling slightly.
              */}
              <Header /> {/* Header will now consume DateRangeContext directly */}
              <div className="flex-1 overflow-y-auto p-8 pb-32">
                {children} {/* Children (page.tsx) will also consume DateRangeContext directly */}
              </div>
            </main>
          </DateRangeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}