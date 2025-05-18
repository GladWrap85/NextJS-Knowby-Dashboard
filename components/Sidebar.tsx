'use client';
import { Bell, ChartArea, ChartBar, ChartLineIcon, Cookie, CreditCard, Frame, Home, Inbox, LayoutDashboard, Logs, Settings, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./ui/command";
import UserItem from "./UserItem";
import Link from "next/link";

export default function Sidebar() {
  const menuList = [
    {
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
    },
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
      <img src="./ffs_logo_full.png" alt="firststepsolutions_logo" />
    </div>
    <div>
        <UserItem />
    </div>
    <div className="grow">
      <Command style={{ overflow: 'visible'}} className="shadow-md">
        <CommandList>
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
      <span>Dev Branch</span>
      </Link>
    </div>
  </div>
}