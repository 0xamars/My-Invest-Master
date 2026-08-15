/**
 * Research-style Future Outlook when AI is unavailable or returns too few items.
 * Public product/strategy themes for THIS issuer’s business type — not a ratio dump.
 */
import { inferOutlookBusinessType } from "@/lib/analysis/narrative/outlook-lock";
import type {
  NarrativeContext,
  NarrativeFutureOutlook,
  NarrativeOutlookItem,
} from "@/lib/analysis/narrative/types";

function item(title: string, body: string): NarrativeOutlookItem {
  return { title, body };
}

function nameOf(ctx: { name?: string | null; symbol?: string }): string {
  const n = ctx.name?.trim();
  if (n) return n.replace(/,?\s+(inc\.?|corp\.?|corporation|ltd\.?|plc)\s*$/i, "");
  return ctx.symbol ?? "This company";
}

const PROFILE_REGION_LABELS: [RegExp, string][] = [
  [/hong kong/, "Hong Kong"],
  [/\bjapan\b/, "Japan"],
  [/\bchina\b/, "China"],
  [/singapore/, "Singapore"],
  [/\bcanada\b/, "Canada"],
  [/united states|\bu\.s\.|\busa\b/, "the United States"],
  [/john hancock/, "John Hancock"],
];

function profileRegions(
  ctx: { description?: string | null; industry?: string | null },
): string {
  const blob = `${ctx.description ?? ""} ${ctx.industry ?? ""}`.toLowerCase();
  const names = PROFILE_REGION_LABELS.filter(([re]) => re.test(blob)).map(
    ([, label]) => label,
  );
  return names.length ? names.join(", ") : "the markets named in the profile";
}

export function buildFallbackOutlook(
  ctx: Partial<NarrativeContext> & { symbol?: string },
): NarrativeFutureOutlook {
  const name = nameOf(ctx);
  const family = inferOutlookBusinessType(ctx);
  const rich =
    ctx.valuationLanguage?.basis === "includes_forward"
      ? "The stock already prices a fair amount of expected growth from those platforms."
      : "The stock already looks full versus today’s earnings, so those platforms have to show up.";

  if (family === "ev_energy") {
    return {
      opportunities: [
        item(
          "FSD and software annuity",
          `Paid driver-assist on the existing fleet is the high-margin path if owners keep the subscription.`,
        ),
        item(
          "Robotaxi and Cybercab",
          `Unsupervised Cybercab rides re-rate the stock if unit economics work at scale.`,
        ),
        item(
          "Energy storage scale",
          `${name} already sells energy alongside vehicles. Storage can offset uneven car sales if project margins hold.`,
        ),
        item(
          "Optimus as early option",
          `Humanoid robotics is extra upside if it leaves the demo stage — not current earnings.`,
        ),
      ],
      risks: [
        item(
          "Capex and cash-burn regime",
          `Factory, energy, and autonomy spend can keep free cash flow weak even when deliveries look fine.`,
        ),
        item(
          "Multiple on unproven cash",
          rich + " If autonomy stays small, the stock re-rates as a car-and-energy company.",
        ),
        item(
          "Execution and competition",
          `Rival EV brands and AV stacks can force price cuts; NHTSA reviews and city permits can delay unsupervised driving.`,
        ),
        item(
          "Dilution and governance",
          `Large share grants or an equity raise spread future cash across more paper.`,
        ),
      ],
    };
  }

  if (family === "semi") {
    return {
      opportunities: [
        item(
          "Custom silicon design-wins",
          `${name} grows if custom chips designed into cloud or networking gear convert from wins to volume.`,
        ),
        item(
          "Optics and high-speed interconnects",
          `Optical links can ride AI cluster build-outs if this is in the mix and pricing holds.`,
        ),
        item(
          "Ethernet and switching",
          `Data-center ethernet can be a second engine if share holds versus merchant rivals.`,
        ),
        item(
          "Cloud cycle recovery",
          `A handful of large cloud buyers ramping spend lifts sockets; a pause at one account shows up fast.`,
        ),
      ],
      risks: [
        item(
          "Customer concentration",
          `A handful of large cloud buyers typically dominate custom programs. A pause at one of those accounts is a growth stall.`,
        ),
        item(
          "Design-win lag",
          `Wins can sit for quarters before they hit sales; the stock can re-rate on that lag.`,
        ),
        item(
          "Rival stacks",
          `Merchant silicon and in-house custom can take sockets on price or power.`,
        ),
        item(
          "AI and cloud spend cycle",
          rich + " A digestion phase in cluster capex cools this end market quickly.",
        ),
      ],
    };
  }

  if (family === "software") {
    return {
      opportunities: [
        item(
          "Cloud and infrastructure",
          `${name}’s cloud franchise is the scale engine if IT budgets stay open.`,
        ),
        item(
          "Workplace and productivity software",
          `Installed desktop and collaboration products can add paid AI if customers renew at higher seats.`,
        ),
        item(
          "Paid AI features",
          `Paid AI add-ons only matter if attach and retention hold after the trial wave.`,
        ),
      ],
      risks: [
        item(
          "Cloud and AI rivalry",
          `Large cloud and software rivals are spending on the same AI budgets; share shifts pressure growth and pricing.`,
        ),
        item(
          "IT budget fatigue",
          `If customers slow cloud migrations or seat expansion, growth cools and the multiple has to live on slower compounding.`,
        ),
        item(
          "Valuation embeds optimism",
          rich + " A growth deceleration would likely re-rate the stock.",
        ),
      ],
    };
  }

  if (family === "treasury_nav") {
    return {
      opportunities: [
        item(
          "Holdings scale",
          `${name}’s story is the size of the bitcoin treasury, not a normal operating company. Adding to the stack only helps if funding does not cut NAV per share.`,
        ),
        item(
          "Operating line as a sidecar",
          `Software or services revenue is small next to the treasury and should not carry the multiple.`,
        ),
        item(
          "Accretive funding",
          `ATM equity or convertibles to buy more bitcoin can work if the stock trades at a premium to NAV.`,
        ),
      ],
      risks: [
        item(
          "Dilution and ATM funding",
          `At-the-market equity and convertibles can dilute holders as fast as the treasury grows.`,
        ),
        item(
          "Debt vs a volatile treasury",
          `Leverage against a swinging bitcoin pile can force sales or a credit event.`,
        ),
        item(
          "Premium to asset value",
          `A premium to NAV can compress even if holdings are unchanged, so the stock falls faster than the treasury.`,
        ),
      ],
    };
  }

  if (family === "early_hardware") {
    return {
      opportunities: [
        item(
          "Private wireless and radios",
          `${name} grows if industrial and defense customers deploy its radios, not just run trials.`,
        ),
        item(
          "Drone and autonomy programs",
          `UAV programs matter if orders convert from demos to fleets.`,
        ),
        item(
          "Order conversion",
          `A lumpy backlog becomes a growth year if customers take delivery.`,
        ),
      ],
      risks: [
        item(
          "Cash burn and funding",
          `Hardware ramps burn cash before scale; ATM or equity raises dilute if orders stay lumpy.`,
        ),
        item(
          "Order lumpiness",
          `A few contracts can make or break a year; a delay hits growth and funding together.`,
        ),
        item(
          "Regulatory and spectrum gates",
          `FCC- or FAA-class spectrum and airspace gates can stall deployments.`,
        ),
      ],
    };
  }

  if (family === "grid_storage") {
    return {
      opportunities: [
        item(
          "Integrated systems",
          `${name} grows if its bundled storage hardware plus software/controls win projects and then commission — not if storage demand rises in the abstract.`,
        ),
        item(
          "Software and services attach",
          `Controls and digital services lift mix if they stay attached after commissioning.`,
        ),
        item(
          "Backlog conversion",
          `Contracted projects only help when they commission on time and at the bid margin.`,
        ),
      ],
      risks: [
        item(
          "Project margins",
          `Bid margins on this backlog can collapse if equipment costs or commissioning overruns hit.`,
        ),
        item(
          "Working capital",
          `Storage projects tie up cash between order and commissioning; a stretched balance sheet is the break.`,
        ),
        item(
          "Commissioning delays",
          `Slipped commissioning on the existing book is a cash and margin miss, not a sector-policy headline.`,
        ),
      ],
    };
  }

  if (family === "insurer") {
    const regions = profileRegions(ctx);
    return {
      opportunities: [
        item(
          "Regional premium growth",
          `${name} can grow if life and health premiums keep expanding in ${regions} and new business stays profitable.`,
        ),
        item(
          "Wealth and retirement products",
          `Retirement, wealth, and protection products are a second engine if persistency holds.`,
        ),
        item(
          "Investment results",
          `Portfolio results can lift profit in a constructive rate backdrop — and reverse in a credit event.`,
        ),
      ],
      risks: [
        item(
          "Investment and credit cycle",
          `A rate drop or credit event hits investment income and book value even if sales look fine.`,
        ),
        item(
          "Slow or uneven premium growth",
          `A stall in ${regions} leaves the stock expensive versus slow compounding.`,
        ),
        item(
          "Guarantee and liability risk",
          `Guaranteed products can soak up capital if markets or longevity move the wrong way.`,
        ),
      ],
    };
  }

  const themes = (ctx.description ?? "").replace(/\s+/g, " ").trim();
  const themeHint = themes
    ? `Public profile lines: ${themes.slice(0, 160)}${themes.length > 160 ? "…" : ""}`
    : "Profile detail is thin, so uncertainty on product mix is high.";

  return {
    opportunities: [
      item(
        "Core demand",
        `${name}’s main products still have to win repeat demand in ${ctx.industry ?? "this industry"}. ${themeHint}`,
      ),
      item(
        "Mix and operating leverage",
        `A better product or geographic mix can lift profits faster than sales if costs stay in line.`,
      ),
      item(
        "Reinvestment and capacity",
        `Capex or R&D builds a longer runway if it converts to revenue; misses become stranded spend.`,
      ),
    ],
    risks: [
      item(
        "Competition",
        `Peers can take share on price or product, hitting the volume the thesis needs.`,
      ),
      item(
        "Execution and cash",
        `If projects slip or working capital rises, cash lags reported profit and dilution often follows.`,
      ),
      item(
        "Cycle and demand",
        `A downturn in ${ctx.industry ?? "the end market"} would cut growth first.`,
      ),
    ],
  };
}

const EV_DISTINCTIVE =
  /fsd|full self[- ]driv|robotaxi|cybercab|energy|storage|humanoid|optimus|unsupervised/i;

function listBlob(items: NarrativeOutlookItem[]): string {
  return items.map((i) => `${i.title} ${i.body}`).join(" ");
}

function spliceTheme(
  items: NarrativeOutlookItem[],
  extra: NarrativeOutlookItem | undefined,
  present: RegExp,
  max = 5,
): NarrativeOutlookItem[] {
  if (!extra) return items;
  if (present.test(listBlob(items))) return items;
  if (items.length < max) return [...items, extra];
  const idx = items.findIndex((i) => !EV_DISTINCTIVE.test(`${i.title} ${i.body}`));
  const at = idx >= 0 ? idx : items.length - 1;
  const next = items.slice();
  next[at] = extra;
  return next;
}

/** Guarantee distinctive EV+energy themes without inventing figures. */
export function fillMissingOutlookThemes(
  outlook: NarrativeFutureOutlook,
  ctx: Partial<NarrativeContext> & { symbol?: string },
): NarrativeFutureOutlook {
  const family = inferOutlookBusinessType(ctx);
  if (family !== "ev_energy") return outlook;
  const fb = buildFallbackOutlook(ctx);
  let opportunities = outlook.opportunities.slice(0, 5);
  const risks = outlook.risks.slice(0, 5);
  opportunities = spliceTheme(
    opportunities,
    fb.opportunities.find((i) => /fsd|software annuity|paid driver/i.test(`${i.title} ${i.body}`)),
    /fsd|full self[- ]driv|software (annuity|attach)|subscription/i,
  );
  opportunities = spliceTheme(
    opportunities,
    fb.opportunities.find((i) => /energy|storage/i.test(`${i.title} ${i.body}`)),
    /energy|storage|solar|generation/i,
  );
  opportunities = spliceTheme(
    opportunities,
    fb.opportunities.find((i) => /autonom|robotaxi|cybercab/i.test(`${i.title} ${i.body}`)),
    /autonom|robotaxi|cybercab|self-driv/i,
  );
  opportunities = spliceTheme(
    opportunities,
    fb.opportunities.find((i) => /humanoid|optimus/i.test(`${i.title} ${i.body}`)),
    /humanoid|optimus/i,
  );
  return { opportunities, risks };
}
