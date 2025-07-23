'use client'

import {
  Frame,
  LayoutDashboard,
  LogIn,
  LogOut,
  RefreshCcw,
  Settings,
  User,

} from 'lucide-react'

import Link from 'next/link'
import UserItem from './UserItem'
import { Command, CommandGroup, CommandItem, CommandList } from './ui/command'
import { SidebarProvider, SidebarTrigger } from './ui/sidebar'
import { createContext, useContext, useState } from 'react'
import { Button } from './ui/button'
import { useSidebar } from './Sidebar-Context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'


export default function Sidebar() {
  const { expanded } = useSidebar()

  const menuList = [
    {
      group: 'Connection',
      items: [
        {
          link: '/',
          icon: RefreshCcw,
          text: 'Refresh',
        },
      ],
    },
    {
      group: 'Account',
      items: [
        {
          link: '/team',
          icon: LayoutDashboard,
          text: 'Dashboard',
        },
        {
          link: '/',
          icon: User,
          text: 'Account',
        },
      ],
    },
    {
      group: 'Settings',
      items: [
        {
          link: '/',
          icon: Settings,
          text: 'Settings',
        },
      ],
    },
  ]

  return (
      <aside
        className={`h-screen flex flex-col items bg-white dark:bg-card border-r shadow-sm transition-all duration-300 ${expanded ? 'w-[260px]' : 'w-[75px]'
          }`}
      >
      <div className="p-3 flex items-center justify-start">
        <div
          className="relative overflow-hidden transition-all duration-300"
          style={{ width: expanded ? '142px' : '64px', height: '50px' }}
        >
          <div style={{ width: '142px', height: '50px' }}>
            <img
              src="./ffs_logo_full.png"
              alt="Logo Light"
              className="block dark:hidden"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <img
              src="./ffs_logo_full_dark.png"
              alt="Logo Dark"
              className="hidden dark:block"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>







        {/* Menu */}
        <div className="px-2 mt-8 w-full flex flex-col items-center">
          <Command style={{ overflow: 'visible' }} className="bg-transparent">
            <CommandList className="max-h-[calc(100vh-200px)]">
              {menuList.map((menu, key) => (
                <CommandGroup key={key} heading={expanded ? menu.group : undefined}>
                  {menu.items.map((item, idx) => {
                    const Icon = item.icon

                    return (
                      <Tooltip key={`${menu.group}-${item.text}`}>
                        <TooltipTrigger asChild>
                          <Link href={item.link}>
                            <CommandItem
                              className={`group cursor-pointer transition-all duration-300 rounded-md
                            ${expanded
                                  ? 'flex items-center gap-2 px-3 py-2 justify-start hover:bg-[var(--accent)]'
                                  : 'w-12 h-12 flex items-center justify-center hover:bg-[var(--accent)]'}
                            ${!expanded && item.text === 'Refresh'
                                  ? 'bg-gradient-to-br from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600'
                                  : ''}
                                `}
                            >
                              <Icon
                                className={` transition-all duration-300 text-muted-foreground
                                  ${!expanded && item.text === 'Refresh'
                                    ? 'text-white'
                                    : 'group-hover:text-[var(--accent-foreground)]'}
                                      group-hover:text-[var(--accent-foreground)]
                                  `}
                                style={{
                                  width: expanded ? '16px' : '20px',
                                  height: expanded ? '16px' : '20px',
                                }}
                              />
                              {expanded && (
                                <span className="text-sm transition-opacity duration-200 group-hover:text-[var(--accent-foreground)]">
                                  {item.text}
                                </span>
                              )}
                            </CommandItem>

                          </Link>
                        </TooltipTrigger>

                        <TooltipContent side="right" className={`${expanded ? 'hidden' : ''} z-[9999]`}>{item.text}</TooltipContent>
                      </Tooltip>

                    )
                  })}



                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>

      </aside>
  )
}
