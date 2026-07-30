/**
 * Minimal typings for Deno Desktop APIs (experimental in Deno 2.9+).
 * These are present at runtime when launched via `deno desktop`.
 */

export {};

declare global {
  namespace Deno {
    interface BrowserWindowOptions {
      title?: string;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      resizable?: boolean;
      alwaysOnTop?: boolean;
      frameless?: boolean;
      noActivate?: boolean;
      transparentTitlebar?: boolean;
    }

    interface MenuItemLabel {
      item: {
        label: string;
        id?: string;
        accelerator?: string;
        enabled: boolean;
      };
    }

    interface MenuItemSubmenu {
      submenu: {
        label: string;
        items: MenuItem[];
      };
    }

    interface MenuItemRole {
      role: { role: string };
    }

    type MenuItem = MenuItemLabel | MenuItemSubmenu | MenuItemRole | "separator";

    class BrowserWindow extends EventTarget {
      constructor(options?: BrowserWindowOptions);
      bind(name: string, handler: (...args: any[]) => unknown): void;
      setTitle(title: string): void;
      setApplicationMenu(menu: MenuItem[]): void;
      navigate(url: string): void;
      executeJs(code: string): Promise<unknown>;
      show(): void;
      hide(): void;
      focus(): void;
      close(): void;
      reload(): void;
      openDevtools(options?: { deno?: boolean; renderer?: boolean }): void;
      getSize(): [number, number];
      setSize(width: number, height: number): void;
      getPosition(): [number, number];
      setPosition(x: number, y: number): void;
      isClosed(): boolean;
      isVisible(): boolean;
      readonly windowId: number;
    }
  }
}
