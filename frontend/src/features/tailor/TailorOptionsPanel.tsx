"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Collapsible } from "@base-ui/react/collapsible";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { CaretDown, Check, SlidersHorizontal } from "@phosphor-icons/react";
import { useId } from "react";
import type { Section, Tone } from "@/lib/api/types";
import { allSections, type TailorOptions } from "../workspace/workspaceState";

const CheckboxRoot = Checkbox.Root;
const RadioRoot = Radio.Root;

export const sectionLabels: Record<Section, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
};

const toneOptions: Array<{ value: Tone; label: string; description: string }> = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Clear and specific, no hype.",
  },
  {
    value: "confident",
    label: "Confident",
    description: "Impact and ownership first.",
  },
  {
    value: "concise",
    label: "Concise",
    description: "Shorter, one-line bullets.",
  },
];

type Props = {
  defaultOpen?: boolean;
  options: TailorOptions;
  onChange: (options: Partial<TailorOptions>) => void;
};

export function summarizeOptions({ sections, tone }: TailorOptions): string {
  const what =
    sections.length === allSections.length
      ? "All sections"
      : sections.map((s) => sectionLabels[s]).join(", ");
  return `${what} · ${toneOptions.find((t) => t.value === tone)?.label} tone`;
}

export function TailorOptionsPanel({ defaultOpen = false, options, onChange }: Props) {
  const id = useId();

  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className="rounded-[var(--radius-card)] border border-border"
    >
      <Collapsible.Trigger className="group flex min-h-13 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 text-left hover:bg-surface">
        <SlidersHorizontal aria-hidden className="size-5 text-muted" />
        <span className="flex-1">
          <span className="font-medium">Customize</span>
          <span className="ml-2 text-muted text-sm">{summarizeOptions(options)}</span>
        </span>
        <CaretDown
          aria-hidden
          className="size-4 text-muted transition-transform group-data-[panel-open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <div className="grid gap-6 border-border border-t px-4 py-5 sm:grid-cols-2">
          <div>
            <p id={`${id}-sections`} className="font-medium text-sm">
              Sections to tailor
            </p>
            <p id={`${id}-sections-hint`} className="mt-0.5 text-muted text-sm">
              Unselected sections stay exactly as written.
            </p>
            <CheckboxGroup
              aria-labelledby={`${id}-sections`}
              aria-describedby={`${id}-sections-hint`}
              value={options.sections}
              onValueChange={(value) => {
                // At least one section, or there is nothing to tailor.
                if (value.length > 0) onChange({ sections: value as Section[] });
              }}
              className="mt-3 grid grid-cols-2 gap-1"
            >
              {allSections.map((section) => {
                const only = options.sections.length === 1 && options.sections[0] === section;
                return (
                  <label
                    key={section}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface"
                  >
                    <CheckboxRoot
                      value={section}
                      disabled={only}
                      className="grid size-5 place-items-center rounded border border-border-strong data-[checked]:border-fg data-[checked]:bg-fg data-[disabled]:opacity-60"
                    >
                      <Checkbox.Indicator>
                        <Check aria-hidden weight="bold" className="size-3.5 text-inverse-fg" />
                      </Checkbox.Indicator>
                    </CheckboxRoot>
                    <span className="text-sm">
                      {sectionLabels[section]}
                      {only ? <span className="sr-only"> (at least one is required)</span> : null}
                    </span>
                  </label>
                );
              })}
            </CheckboxGroup>
          </div>

          <div>
            <p id={`${id}-tone`} className="font-medium text-sm">
              Tone
            </p>
            <RadioGroup
              aria-labelledby={`${id}-tone`}
              value={options.tone}
              onValueChange={(value) => onChange({ tone: value as Tone })}
              className="mt-3 grid gap-1"
            >
              {toneOptions.map((tone) => (
                <label
                  key={tone.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface"
                >
                  <RadioRoot
                    value={tone.value}
                    className="grid size-5 shrink-0 place-items-center rounded-full border border-border-strong data-[checked]:border-fg"
                  >
                    <Radio.Indicator className="size-2.5 rounded-full bg-fg" />
                  </RadioRoot>
                  <span className="text-sm">
                    <span className="font-medium">{tone.label}</span>
                    <span className="text-muted"> · {tone.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
