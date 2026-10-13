"use client";

import { Menu } from "@base-ui/react/menu";
import { DownloadSimple, SignIn, SignOut, UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePwa } from "@/features/pwa/usePwa";
import { signOut, useSession } from "@/lib/authClient";
import { cn } from "@/lib/format";
import { isActive, navItems } from "./nav";
import { ThemeMenu } from "./ThemeMenu";

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canInstall, install } = usePwa();
  const signedIn = Boolean(session?.user);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-md font-semibold tracking-tight"
        >
          <LogoMark />
          <span>Tailor</span>
          <span className="sr-only">, home</span>
        </Link>

        {/* Desktop navigation (signed in only: signed out there is nowhere else to go).
            Phones use the bottom tab bar. */}
        {signedIn ? (
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {navItems
              .filter((item) => (!item.signedInOnly || signedIn) && item.href !== "/account")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center rounded-md px-3 font-medium text-sm",
                    isActive(pathname, item.href)
                      ? "bg-surface-2 text-fg"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {canInstall ? (
            <button
              type="button"
              onClick={install}
              className="hidden min-h-10 items-center gap-2 rounded-md px-3 font-medium text-muted text-sm hover:bg-surface-2 hover:text-fg sm:flex"
            >
              <DownloadSimple aria-hidden className="size-4" />
              Install app
            </button>
          ) : null}
          <ThemeMenu />
          {signedIn && session ? (
            <AccountMenu name={session.user.name} email={session.user.email} />
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(pathname)}`}
              className="ml-1 hidden min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-3.5 font-medium text-sm hover:bg-surface-2 md:inline-flex"
            >
              <SignIn aria-hidden className="size-4" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const itemClass =
    "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-[highlighted]:bg-surface-2";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account: ${name}`}
        className="ml-1 grid size-10 place-items-center rounded-full bg-fg font-semibold text-inverse-fg text-sm data-[popup-open]:ring-2 data-[popup-open]:ring-border-strong data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-bg"
      >
        <span aria-hidden>{initials(name)}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <Menu.Popup
            data-surface
            className="min-w-60 origin-[var(--transform-origin)] rounded-[var(--radius-control)] border border-border bg-bg p-1 shadow-card outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="px-3 py-2">
              <p className="truncate font-medium text-sm">{name}</p>
              <p className="truncate text-muted text-xs">{email}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item className={itemClass} onClick={() => router.push("/account")}>
              <UserCircle aria-hidden className="size-4 text-muted" />
              Account and data
            </Menu.Item>
            <Menu.Item
              className={itemClass}
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <SignOut aria-hidden className="size-4 text-muted" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A needle-and-thread "T": the one bespoke mark in an otherwise plain UI. */
function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none">
      <rect width="24" height="24" rx="6" className="fill-fg" />
      <path d="M7 7.5h10M12 7.5v9.5" className="stroke-bg" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14.5 17c1.5-.2 2.5-1 2.5-2.2"
        className="stroke-bg"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
