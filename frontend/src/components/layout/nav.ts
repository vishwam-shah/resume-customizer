import { ClockCounterClockwise, type Icon, PlusCircle, UserCircle } from "@phosphor-icons/react";

export type NavItem = { href: string; label: string; icon: Icon; signedInOnly?: boolean };

export const navItems: NavItem[] = [
  { href: "/", label: "New resume", icon: PlusCircle },
  { href: "/history", label: "History", icon: ClockCounterClockwise, signedInOnly: true },
  { href: "/account", label: "Account", icon: UserCircle, signedInOnly: true },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);
