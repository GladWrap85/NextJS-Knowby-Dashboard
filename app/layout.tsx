import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { ThemeProvider } from "next-themes"

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
          attribute="class" // This applies "dark" or "light" class to <html>
          defaultTheme="system"
          enableSystem
        >
          <div className="hidden md:flex min-w-[260px] border-r bg-sidebar text-sidebar-foreground inset-shadow-sm/10">
            <Sidebar />
          </div>
          <main className="flex flex-col w-full h-full">
            <Header />
            <div className="flex-1 overflow-y-auto p-8 pb-32">
              {children}
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}





















//Old version without inner-page scrolling (aka with whole page scrolling)

{/*
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knowby Dashboard",
  description: "Dashboard for Knowby Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} flex items-start justify-between`}>
        <div className="hidden md:flex min-w-[300px] border-r min-h-[1113px]">
          <Sidebar />
        </div>
        <main className="grid w-full h-full">
          <Header />
          <div className="p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
*/}




















//Old version without inner-page scrolling (aka with whole page scrolling)

{/*
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knowby Dashboard",
  description: "Dashboard for Knowby Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} flex items-start justify-between`}>
        <div className="hidden md:flex min-w-[300px] border-r min-h-[1113px]">
          <Sidebar />
        </div>
        <main className="grid w-full h-full">
          <Header />
          <div className="p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
*/}