import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/shell/nav";

/** Guards the "no dead navigation" rule: every nav destination must have a page. */
describe("navigation", () => {
  it.each(NAV_ITEMS.map((n) => [n.label, n.href] as const))("%s (%s) has a page", (_label, href) => {
    const segment = href === "/" ? "" : href.slice(1);
    const page = path.join(process.cwd(), "src", "app", "(app)", segment, "page.tsx");
    expect(existsSync(page), `missing ${page}`).toBe(true);
  });

  it("uses unique shortcuts", () => {
    const keys = NAV_ITEMS.map((n) => n.shortcut).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
