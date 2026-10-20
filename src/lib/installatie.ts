import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let uitgesteld: BeforeInstallPromptEvent | null = null
let netGeinstalleerd = false
const luisteraars = new Set<() => void>()
const meld = () => luisteraars.forEach((f) => f())

export function vangInstallatieMelding() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    uitgesteld = e as BeforeInstallPromptEvent
    meld()
  })
  window.addEventListener('appinstalled', () => {
    uitgesteld = null
    netGeinstalleerd = true
    meld()
  })
}

export type Platform = 'ios' | 'android' | 'anders'

export function platform(): Platform {
  const ua = navigator.userAgent
  const iPadAlsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || iPadAlsMac) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'anders'
}

export function isGeinstalleerd(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return (
    netGeinstalleerd ||
    iosStandalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

export function useInstallatie() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return {
    platform: platform(),
    geinstalleerd: isGeinstalleerd(),
    kanDirectInstalleren: uitgesteld !== null,
    async installeer() {
      if (!uitgesteld) return
      const e = uitgesteld
      uitgesteld = null
      await e.prompt()
      await e.userChoice.catch(() => null)
      meld()
    },
  }
}
