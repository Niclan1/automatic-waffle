/// <reference types="vite/client" />
interface Window { desktop?: { invoke<T>(command: string, args: Record<string, unknown>): Promise<T> } }
