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
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

// 👉 keep your original import path if this is where it lives
import { useKnowbyData } from '@/lib/KnowbyDataProvider'
import ScraperButton from './ScraperButton'
import VersionPill from './VersionPill'

type MenuItem = {
  link: string
  icon: any
  text: 'Refresh' | 'Dashboard' | 'Account' | 'Settings' | (string & {})
}

type DialogKey = 'Dashboard' | 'Account' | 'Settings'
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

  // --- Account functionality state ---
  const [isLoading, setIsLoading] = useState(false)
  const [accountStatus, setAccountStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [accountMessage, setAccountMessage] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)


  // --- Scraper functionality state ---
  const [scraperLoading, setScraperLoading] = useState(false)
  const [scraperSuccess, setScraperSuccess] = useState(false)

  // --- Refresh error state ---
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Handle the header extraction process
  const handleExtractHeaders = async () => {
    setIsLoading(true)
    setAccountStatus('idle')
    setAccountMessage('')

    // AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Call the API to extract headers
      const response = await fetch('/api/extract-headers', {
        method: 'POST',
        signal: abortController.signal,

      })

      const data = await response.json()

      if (response.ok) {
        setAccountStatus('success')
        setAccountMessage('Headers extracted successfully! Your authentication is now configured and the web scraper is ready to use.')
      } else {
        setAccountStatus('error')
        setAccountMessage(data.error || 'Failed to extract headers')
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setAccountStatus('idle');
        setAccountMessage('Header extraction was cancelled.');
      } else {
        setAccountStatus('error')
        setAccountMessage('An error occurred while extracting headers')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null;
    }
  }

  // Handle the scraper process
  const handleRunScraper = async () => {
    setScraperLoading(true)
    setScraperSuccess(false)

    try {
      // Call the API to run the scraper
      const response = await fetch('/api/run-scraper', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        // Show success state briefly
        setScraperSuccess(true)
        toast.success('Scraper ran successfully!')
        // Refresh the data after successful scraping
        reload()

        // Reset success state after 2 seconds
        setTimeout(() => {
          setScraperSuccess(false)
        }, 2000)
      } else {
        console.warn('Scraper failed:', data.message)
        toast.error(data.message || 'Failed to refresh data. Please Update Headers.')
      }
    } catch (error: any) {
      console.warn('An error occurred while running the scraper:', error)
      toast.error(error?.message || 'An unexpected error occurred during refresh.')
    } finally {
      setScraperLoading(false)
    }
  }


  // --- Dialog content ---
  const dialogContent = useMemo<Record<DialogKey, DialogEntry>>(
    () => ({
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
        onOk: () => setOpen(false),
      },
      Account: {
        title: 'Account',
        description:
          'Manage your profile, organization, and notification preferences.',
        body: (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="text-muted-foreground space-y-2">
                <p>1. Click the button below to open Knowby in a new window</p>
                <p>2. Sign in to your Knowby account manually</p>
                <p>3. The authentication headers will be automatically extracted and saved</p>
                <p>4. Once complete, you can use the web scraper functionality</p>
              </div>
            </div>

            <Button
              onClick={handleExtractHeaders}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Headers...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Extract Knowby Headers
                </>
              )}
            </Button>

            {/* Success message */}
            {accountStatus === 'success' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-800">{accountMessage}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {accountStatus === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800">{accountMessage}</span>
                </div>
              </div>
            )}
          </div>
        ),
        okText: 'Close',
        onOk: () => setOpen(false),
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

    [source, status, switchSource, reload, isLoading, accountStatus, accountMessage, handleExtractHeaders, handleRunScraper, scraperLoading, scraperSuccess]

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

    // Special handling for Refresh - run scraper directly
    if (item.text === 'Refresh') {
      handleRunScraper()
      return
    }

    setActiveKey(item.text)
    setOpen(true)
  }

  const active = (activeKey && ['Dashboard', 'Account', 'Settings'].includes(activeKey as string))
    ? dialogContent[activeKey as DialogKey]
    : undefined

  return (
    <>
      <aside
        className={`h-screen flex flex-col items bg-sidebar border-r shadow-sm transition-all duration-300 ${expanded ? 'w-[207px]' : 'w-[68px]'}`}
      >
        {/* Logo block */}
        <div className="p-3 flex items-center justify-start">
          <div
            className="relative overflow-hidden transition-all duration-300"
            style={{ width: expanded ? '128px' : '58px', height: '45px' }}
          >
            <div style={{ width: '123px', height: '45px' }}>
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

        {/* Menu items */}
        <div className="mt-8">
          <Command style={{ overflow: 'visible' }} className="bg-transparent">
            <CommandList className={cn(
              `flex flex-col max-h-[calc(100vh-200px)]`, expanded ? 'px-2' : 'items-center')}>
              {menuList.map((menu, key) => (
                // FIX: remove group horizontal padding that causes right shift
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
                                  ? scraperSuccess
                                    ? 'bg-gradient-to-br from-green-600 to-green-400'
                                    : 'bg-gradient-to-br from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600'
                                  : '',
                                (scraperLoading || scraperSuccess) && 'pointer-events-none opacity-75'
                              )}
                            >
                              {isRefresh && scraperLoading ? (
                                <Loader2
                                  className="animate-spin text-white"
                                  style={{
                                    width: expanded ? '14px' : '18px',
                                    height: expanded ? '14px' : '18px',
                                  }}
                                />
                              ) : isRefresh && scraperSuccess ? (
                                <CheckCircle
                                  className="text-white"
                                  style={{
                                    width: expanded ? '14px' : '18px',
                                    height: expanded ? '14px' : '18px',
                                  }}
                                />
                              ) : (
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
                                    width: expanded ? '14px' : '18px',
                                    height: expanded ? '14px' : '18px',
                                  }}
                                />
                              )}
                              {expanded && (
                                <span className="text-sm transition-opacity duration-200 group-hover:text-[var(--accent-foreground)]">
                                  {isRefresh && scraperLoading ? 'Running...' : isRefresh && scraperSuccess ? 'Success!' : item.text}
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
        <div className="flex justify-center mt-auto mb-2">
          <VersionPill />
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
                  Close
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