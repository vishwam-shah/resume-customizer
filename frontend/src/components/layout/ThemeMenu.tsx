"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type ThemeChoice = "system" | "light" | "dark";

const options: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Desktop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyChoice(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}

export function ThemeMenu() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(readChoice()), []);

  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyChoice("system");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [choice]);

  const current = options.find((o) => o.value === choice) ?? options[0];
  const CurrentIcon = current.icon;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Theme: ${current.label}`}
        className="grid size-11 place-items-center rounded-[var(--radius-control)] text-muted hover:bg-surface-2 hover:text-fg data-[popup-open]:bg-surface-2 data-[popup-open]:text-fg"
      >
        <CurrentIcon aria-hidden className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6}>
          <Menu.Popup
            data-surface
            className="min-w-40 origin-[var(--transform-origin)] rounded-[var(--radius-control)] border border-border bg-bg p-1 shadow-card outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <Menu.GroupLabel className="px-3 pt-2 pb-1 text-subtle text-xs">Theme</Menu.GroupLabel>
            <Menu.RadioGroup
              value={choice}
              onValueChange={(value) => {
                setChoice(value as ThemeChoice);
                applyChoice(value as ThemeChoice);
              }}
            >
              {options.map(({ value, label, icon: Icon }) => (
                <Menu.RadioItem
                  key={value}
                  value={value}
                  closeOnClick
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-[highlighted]:bg-surface-2"
                >
                  <Icon aria-hidden className="size-4 text-muted" />
                  <span className="flex-1">{label}</span>
                  <Menu.RadioItemIndicator>
                    <Check aria-hidden className="size-4" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
