'use client'

import {
  LayoutDashboard,
  RefreshCcw,
  Settings,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { Command, CommandGroup, CommandItem, CommandList } from './ui/command'
import { useSidebar } from './Sidebar-Context'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '@/lib/utils'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState, useMemo, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// 👉 keep your original import path if this is where it lives
import { useKnowbyData } from '@/lib/KnowbyDataProvider'
import ScraperButton from './ScraperButton'

type MenuItem = {
  link: string
  icon: any
  text: 'Refresh' | 'Dashboard' | 'Account' | 'Settings' | (string & {})
}

type DialogKey = 'Refresh' | 'Dashboard' | 'Account' | 'Settings'
type DialogEntry = {
  title: string
  description: string
  body: React.ReactNode
  okText: string
  onOk?: () => void
}

export default function Sidebar() {
  const { expanded } = useSidebar()

  // --- Dialog state ---
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<MenuItem['text'] | null>(null)

  // --- Data mode from provider (new API) ---
  const { source, switchSource, reload, status } = useKnowbyData()
  type DataMode = 'sample' | 'real'

  // === NEW: local, staged settings state (only applied on save) ===
  const [pendingSource, setPendingSource] = useState<DataMode>(source)

  // When the Settings dialog opens, initialize pending values from current source
  useEffect(() => {
    if (open && activeKey === 'Settings') {
      setPendingSource(source)
    }
  }, [open, activeKey, source])

  const hasUnsaved = activeKey === 'Settings' && pendingSource !== source
  // ================================================================

  // --- Dialog content ---
  const dialogContent = useMemo<Record<DialogKey, DialogEntry>>(
    () => ({
      Refresh: {
        title: 'Refresh Connection',
        description:
          'Attempt to refresh data connections and re-fetch the latest metrics.',
        body: (
          <div className="space-y-2 text-sm">
            <p>This will:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Re-sync Knowby CSV sources</li>
              <li>Invalidate client-side caches</li>
              <li>Recompute totals and trends</li>
            </ul>
          </div>
        ),
        okText: (status === 'loading' || status === 'refreshing') ? 'Refreshing…' : 'Run refresh',
        onOk: () => { reload() },
      },
      Dashboard: {
        title: 'Open Dashboard',
        description:
          'Jump to your main dashboard view or configure which widgets to show by default.',
        body: (
          <div className="space-y-3">
            <div className="text-sm">Choose a quick action:</div>
            <div className="flex gap-2">
              <Button variant="secondary" className="text-sm">Customize widgets</Button>
              <Button variant="secondary" className="text-sm">Set default filters</Button>
            </div>
          </div>
        ),
        okText: 'Go to dashboard',
      },
      Account: {
        title: 'Account',
        description:
          'Manage your profile, organization, and notification preferences.',
        body: (
          <div className="gap-5">
            <div className="flex flex-col w-fit">
              <Button variant="secondary" className="text-sm">Login</Button>
              <Button variant="secondary" className="text-sm">Logout</Button>
              <ScraperButton />
            </div>
          </div>
        ),
        okText: 'Open account',
      },
      Settings: {
        title: 'Settings',
        description: 'Change theme, data sources, and advanced options.',
        body: (
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Data source</div>
              {/* Bind tabs to the staged pending value (not the live source) */}
              <Tabs value={pendingSource} onValueChange={(v) => setPendingSource(v as DataMode)}>
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="sample">Sample data</TabsTrigger>
                  <TabsTrigger value="real">Real data</TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="mt-3">
                  <p className="text-muted-foreground">
                    Use bundled CSVs / demo endpoints for fast iteration.
                  </p>
                </TabsContent>
                <TabsContent value="real" className="mt-3">
                  <p className="text-muted-foreground">
                    Pull from the live Knowby/production sources.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <div className="text-xs opacity-70">
              Current mode: <code>{source}</code>
              {hasUnsaved && (
                <span className="ml-2 text-amber-500">(unsaved changes)</span>
              )}
            </div>
          </div>
        ),
        okText: 'Save & Close',
        onOk: () => {
          // Only apply if changed
          if (pendingSource !== source) {
            switchSource(pendingSource)
          }
          // Close after saving
          setOpen(false)
        },
      },
    }),
    [source, status, reload, pendingSource, hasUnsaved, switchSource]
  )

  // --- Menu list ---
  const menuList: { group: string; items: MenuItem[] }[] = [
    {
      group: 'Connection',
      items: [{ link: '/', icon: RefreshCcw, text: 'Refresh' }],
    },
    {
      group: 'Account',
      items: [
        { link: '/', icon: LayoutDashboard, text: 'Dashboard' },
        { link: '/', icon: User, text: 'Account' },
      ],
    },
    {
      group: 'Settings',
      items: [{ link: '/', icon: Settings, text: 'Settings' }],
    },
  ]

  function handleOpenDialog(item: MenuItem, e?: React.MouseEvent) {
    if (e) e.preventDefault() // stop navigation; open modal instead
    setActiveKey(item.text)
    setOpen(true)
  }

  const active = (activeKey && ['Refresh', 'Dashboard', 'Account', 'Settings'].includes(activeKey as string))
    ? dialogContent[activeKey as DialogKey]
    : undefined

  return (
    <>
      <aside
        className={`h-screen flex flex-col items bg-sidebar border-r shadow-sm transition-all duration-300 ${expanded ? 'w-[230px]' : 'w-[75px]'}`}
      >
        {/* 🔙 Logo block (unchanged) */}
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

        {/* Menu items (unchanged) */}
        <div className="px-2 mt-8 w-full flex flex-col items-center">
          <Command style={{ overflow: 'visible' }} className="bg-transparent">
            <CommandList className="max-h-[calc(100vh-200px)]">
              {menuList.map((menu, key) => (
                <CommandGroup key={key} heading={expanded ? menu.group : undefined}>
                  {menu.items.map((item) => {
                    const Icon = item.icon
                    const isRefresh = item.text === 'Refresh'
                    return (
                      <Tooltip key={`${menu.group}-${item.text}`}>
                        <TooltipTrigger asChild>
                          {/* Keep Link for semantics; prevent default in onClick */}
                          <Link href={item.link} onClick={(e) => handleOpenDialog(item, e)}>
                            <CommandItem
                              className={cn(
                                'group cursor-pointer transition-all duration-300 rounded-md',
                                expanded
                                  ? 'flex items-center gap-2 px-3 py-2 justify-start hover:bg-[var(--accent)]'
                                  : 'w-12 h-12 flex items-center justify-center hover:bg-[var(--accent)]',
                                !expanded && isRefresh
                                  ? 'bg-gradient-to-br from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600'
                                  : ''
                              )}
                            >
                              <Icon
                                className={cn(
                                  'transition-all duration-300',
                                  expanded
                                    ? 'text-muted-foreground group-hover:text-[var(--accent-foreground)]'
                                    : '',
                                  !expanded && isRefresh
                                    ? 'text-white'
                                    : 'text-muted-foreground group-hover:text-[var(--accent-foreground)]'
                                )}
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
                        <TooltipContent side="right" className={`${expanded ? 'hidden' : ''} z-[9999]`}>
                          {item.text}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>
      </aside>

      {/* Global dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          // closing without clicking save discards staged changes (we re-init on next open)
          setOpen(v)
          if (!v) {
            // Optional: reset staged state immediately on close for cleanliness
            setPendingSource(source)
          }
        }}
      >
        <DialogContent>
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
                <DialogDescription>{active.description}</DialogDescription>
              </DialogHeader>

              <div className="mt-2">{active.body}</div>

              <DialogFooter className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    active.onOk?.()
                    if (activeKey === 'Refresh') return
                  }}
                  disabled={
                    (activeKey === 'Refresh' && (status === 'loading' || status === 'refreshing')) ||
                    (activeKey === 'Settings' && !hasUnsaved)
                  }
                >
                  {active.okText}
                </Button>
              </DialogFooter>

            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
