import { House, ShoppingCart, Tag } from "@phosphor-icons/react";
import type { ChipRole } from "./types";

export interface RoleChipProps {
  role: ChipRole;
}

const CHIP_CONFIG = {
  selling: { label: "Selling", Icon: Tag },
  buying: { label: "Buying", Icon: ShoppingCart },
  sale: { label: "Sale", Icon: House },
} as const;

/** Small neutral pill telling the user which side of a conversation they're on. */
export function RoleChip({ role }: RoleChipProps) {
  const { label, Icon } = CHIP_CONFIG[role];

  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-muted/50 ring-1 ring-border text-muted-foreground text-[11px] font-medium shrink-0">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}
