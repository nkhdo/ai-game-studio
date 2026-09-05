import * as server from "../lib/api";

export interface Clock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

export interface ConfirmationAdapter {
  confirm(message: string): boolean | Promise<boolean>;
  prompt(message: string, initial?: string): string | null | Promise<string | null>;
}

export interface StudioDependencies {
  server: typeof server;
  clock: Clock;
  confirmation: ConfirmationAdapter;
}

export function productionDependencies(): StudioDependencies {
  return {
    server,
    clock: {
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
    },
    confirmation: {
      confirm: (message) => window.confirm(message),
      prompt: (message, initial) => window.prompt(message, initial),
    },
  };
}
