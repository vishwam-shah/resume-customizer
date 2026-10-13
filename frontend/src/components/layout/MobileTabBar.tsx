"use client";

import { SignIn } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/authClient";
import { cn } from "@/lib/format";
import { isActive, navItems } from "./nav";

/** App-style bottom navigation on phones, clear of the home indicator. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const items = navItems.filter((item) => !item.signedInOnly || signedIn);

  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-30 border-border border-t bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "font-semibold text-fg" : "text-muted",
                )}
              >
                <Icon aria-hidden weight={active ? "fill" : "regular"} className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
        {!signedIn ? (
          <li className="flex-1">
            <Link
              href={`/sign-in?next=${encodeURIComponent(pathname)}`}
              aria-current={pathname === "/sign-in" ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-muted text-xs"
            >
              <SignIn aria-hidden className="size-6" />
              Sign in
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
