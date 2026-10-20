/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Project-URL van Supabase, bijv. https://abcd.supabase.co (leeg = geen backend) */
  readonly VITE_SUPABASE_URL?: string
  /** Publieke anon/publishable key van Supabase (nooit de service-role key!) */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
