'use client';
import { Bell, ChartArea, ChartBar, ChartLineIcon, Cookie, CreditCard, Frame, Home, Inbox, LayoutDashboard, Link2, LogIn, LogOut, Logs, RefreshCcw, Settings, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./ui/command";
import UserItem from "./UserItem";
import Link from "next/link";

export default function Sidebar() {
  const menuList = [
    {
      group: "Connection",
      items: [
        {
          link: "/",
          icon: <RefreshCcw />,
          text: "Refresh"
        }
      ]
    },
    {
      group: "Account",
      items: [
        {
          link: "/",
          icon: <LogIn />,
          text: "Login"
        },
        {
          link: "/",
          icon: <LogOut />,
          text: "Logout"
        }
      ]
    },
    /*{
      group: "General",
      items: [
        {
          link: "/",
          icon: <LayoutDashboard />,
          text: "Home"
        },
        {
          link: "/",
          icon: <ChartLineIcon />,
          text: "Charts"
        }
      ]
    },*/
    {
      group: "Settings",
      items: [
        {
          link: "/",
          icon: <Settings />,
          text: "General Settings"
        }
      ]
    },
  ]

  return <div className="fixed flex flex-col gap-4 w-[260px] min-w-[260px] p-4 min-h-screen">
    <div className="flex items-center gap-4">
      {/* Light mode logo */}
      <img
        src="./ffs_logo_full.png"
        alt="First Step Solutions"
        className="block dark:hidden"
      />

      {/* Dark mode logo */}
      <img
        src="./ffs_logo_full_dark.png"
        alt="First Step Solutions (Dark)"
        className="hidden dark:block"
      />
    </div>

    <div>
        <UserItem />
    </div>
    <div className="flex-1">
      <Command style={{ overflow: 'visible'}} className="shadow-md bg-background">
        <CommandList className="max-h-[calc(100vh-200px)]">
          {menuList.map((menu: any, key: number) => (
            <CommandGroup key={key} heading={menu.group}>
            {menu.items.map((option: any, optionKey: number) => 
              <CommandItem key={optionKey} className="flex gap-2 cursor-pointer p-2">
                {option.icon}
                {option.text}
              </CommandItem>
            )}
            </CommandGroup>))}
        </CommandList>
      </Command>

    </div>
    <div>
      <Link href="/team" className="flex items-center gap-2">
      <Frame />
      <span>Alternate</span>
      </Link>
    </div>
  </div>
}