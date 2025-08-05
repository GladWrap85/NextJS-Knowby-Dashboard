'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

const SidebarContext = createContext<{
  expanded: boolean
  toggle: () => void
}>({
  expanded: true,
  toggle: () => { },
})

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => setExpanded((prev) => !prev)

  return (
    <SidebarContext.Provider value={{ expanded, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
