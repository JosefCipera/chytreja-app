// ── TOC HUD config — static per-node PROBLEM + ACTION ─────────────────────
// AI will later select the active problem dynamically.
// For now: first item = default problem shown.

export const TOC_NODE_CONFIG = {

  // ── Hlavní uzel ─────────────────────────────────────────────────────────
  toc: {
    problems: ['TOK', 'Přetížené omezení', 'Skryté úzké místo'],
    warning: 'Nerovnoměrný tok způsobuje ztráty.',
    action: {
      label: 'ANALÝZA SYSTÉMU',
      chips: [
        { label: '5 kroků TOC',      href: null },
        { label: 'Mapa průtoku',     href: null },
        { label: 'Identifikuj omezení', href: null },
      ],
    },
  },

  // ── Výroba ──────────────────────────────────────────────────────────────
  vyroba_toc: {
    problems: ['Plnění termínů', 'Vytížení kapacit', 'Chybějící materiál', 'Kvalita'],
    warning: 'Nedodržení plánu = ztráta průtoku.',
    action: {
      label: 'PLÁNOVÁNÍ',
      chips: [
        { label: 'Plán výroby',      href: '/app/toc-vyroba.html' },
        { label: 'Hlavní plán',      href: null },
        { label: 'Plán kooperací',   href: null },
      ],
    },
  },

  kapacity_toc: {
    problems: ['Přetížení strojů', 'Nedostatek lidí', 'Chybějící kompetence'],
    warning: 'Přetížené kapacity blokují tok zakázek.',
    action: {
      label: 'KAPACITY',
      chips: [
        { label: 'Kapacitní plán',   href: null },
        { label: 'Přesčasy',         href: null },
        { label: 'Kooperace',        href: null },
      ],
    },
  },

  material_toc: {
    problems: ['Nedodávky', 'Kvalita vstupů', 'Zásoby pod normou'],
    warning: 'Chybějící materiál zastavuje výrobu.',
    action: {
      label: 'ZÁSOBOVÁNÍ',
      chips: [
        { label: 'Plán nákupu',      href: null },
        { label: 'Alternativní dodavatel', href: null },
        { label: 'Pojistná zásoba',  href: null },
      ],
    },
  },

  terminy_toc: {
    problems: ['Plnění termínů zakázek', 'Zpoždění ve výrobě', 'Přislíbené vs. skutečné termíny'],
    warning: 'Nedodržení termínů = ztráta zákazníka i průtoku.',
    action: {
      label: 'TERMÍNY',
      chips: [
        { label: 'Přehled zakázek',  href: null },
        { label: 'Kritický řetěz',   href: null },
        { label: 'Eskalace',         href: null },
      ],
    },
  },

  kvalita_toc: {
    problems: ['Zmetkovitost', 'Reklamace zákazníků', 'NCR otevřené'],
    warning: 'Zmetky spotřebovávají kapacitu bez průtoku.',
    action: {
      label: 'KVALITA',
      chips: [
        { label: 'Analýza příčin',   href: null },
        { label: 'Kontrolní plán',   href: null },
        { label: 'Nápravná opatření', href: null },
      ],
    },
  },

  opravy_toc: {
    problems: ['Neplánované odstávky', 'Nízké MTBF', 'Odložená údržba'],
    warning: 'Neplánované odstávky jsou nejdražší ztrátou průtoku.',
    action: {
      label: 'ÚDRŽBA',
      chips: [
        { label: 'Plán preventivní údržby', href: null },
        { label: 'Analýza poruch',    href: null },
        { label: 'Náhradní díly',     href: null },
      ],
    },
  },

  // ── Finance ─────────────────────────────────────────────────────────────
  finance_toc: {
    problems: ['Klesající zisk', 'Klesající ROI', 'Klesající CF'],
    warning: 'Zhoršení globálních ukazatelů = zhoršení firmy jako celku.',
    action: {
      label: 'FINANČNÍ SIMULACE',
      chips: [
        { label: 'Hodnocení přínosů', href: null },
        { label: 'Analýza průtoku',   href: null },
        { label: 'T / I / OE přehled', href: null },
      ],
    },
  },

  prutok_toc: {
    problems: ['Klesající marže', 'Ztráta zakázek', 'Nízká prodejní cena'],
    warning: 'Klesající průtok ohrožuje celý systém.',
    action: {
      label: 'PRŮTOK (T)',
      chips: [
        { label: 'Analýza marže',    href: null },
        { label: 'Cenová strategie', href: null },
        { label: 'Pipeline zakázek', href: null },
      ],
    },
  },

  zasoby_toc: {
    problems: ['Nadměrné zásoby', 'Vysoké WIP', 'Pomalá obrátka'],
    warning: 'Vázaný kapitál snižuje dostupné cash.',
    action: {
      label: 'ZÁSOBY (I)',
      chips: [
        { label: 'Analýza WIP',      href: null },
        { label: 'Obratovost zásob', href: null },
        { label: 'Min-max zásoby',   href: null },
      ],
    },
  },

  naklady_toc: {
    problems: ['Rostoucí fixní náklady', 'Přesčasy mimo plán', 'Energie mimo plán'],
    warning: 'Rostoucí OE bez růstu T = zhoršování zisku.',
    action: {
      label: 'PROVOZNÍ NÁKLADY',
      chips: [
        { label: 'Analýza OE',       href: null },
        { label: 'Úsporná opatření', href: null },
        { label: 'Benchmark nákladů', href: null },
      ],
    },
  },

  cashflow_toc: {
    problems: ['Pozdní platby od zákazníků', 'Krátká splatnost dodavatelů', 'Výkyvy cash'],
    warning: 'Špatný cash flow blokuje provoz i investice.',
    action: {
      label: 'CASH FLOW',
      chips: [
        { label: 'Cash flow plán',   href: null },
        { label: 'Pohledávky',       href: null },
        { label: 'Platební podmínky', href: null },
      ],
    },
  },

  // ── Ostatní uzly ────────────────────────────────────────────────────────
  ccpm: {
    problems: ['Zpoždění projektů', 'Multitasking zdrojů', 'Nejistota termínů'],
    warning: 'Multitasking ničí projekty rychleji než technické problémy.',
    action: {
      label: 'PROJEKTY (CCPM)',
      chips: [
        { label: 'Kritický řetěz',   href: null },
        { label: 'Buffer management', href: null },
        { label: 'Prioritizace',     href: null },
      ],
    },
  },

  strategie_toc: {
    problems: ['Nejasná strategie', 'Rozptýlené zdroje', 'Chybějící focus'],
    warning: 'Bez focusu na omezení nelze zrychlit růst.',
    action: {
      label: 'STRATEGIE (SFS)',
      chips: [
        { label: 'Co změnit',        href: null },
        { label: 'Na co změnit',     href: null },
        { label: 'Jak to provést',   href: null },
      ],
    },
  },

  marketing_toc: {
    problems: ['Slabá pipeline', 'Nízká konverze', 'Nejasná hodnotová nabídka'],
    warning: 'Omezení na straně trhu brzdí průtok stejně jako výroba.',
    action: {
      label: 'MARKETING (MA)',
      chips: [
        { label: 'Mafia Offer',      href: null },
        { label: 'Analýza trhu',     href: null },
        { label: 'Segmentace',       href: null },
      ],
    },
  },
};

/** Vrací config pro daný TOC uzel. Fallback pro neznámé uzly. */
export function getTocConfig(nodeId) {
  return TOC_NODE_CONFIG[nodeId] ?? {
    problems: ['Identifikuj omezení'],
    warning: 'Omezení brzdí průtok celého systému.',
    action: {
      label: 'ANALÝZA',
      chips: [{ label: '5 kroků TOC', href: null }],
    },
  };
}
