export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      /*
       * Semantic color tokens — dasti v1
       * Référencent les CSS variables définies dans globals.css.
       * Le dark mode est géré par la classe .dark sur <html>.
       */
      colors: {
        // Surface tokens dasti
        bg:          "var(--bg)",
        sf1:         "var(--sf1)",
        sf2:         "var(--sf2)",
        sfr:         "var(--sfr)",
        // Text tokens dasti
        ti:          "var(--ti)",
        tm2:         "var(--tm2)",
        tg2:         "var(--tg2)",
        // Border tokens dasti
        bo:          "var(--bo)",
        bm:          "var(--bm)",
        // Accent tokens (sauge défaut, surchargeables via body.pal-*)
        ac:          "var(--ac)",
        am:          "var(--am)",
        ap:          "var(--ap)",
        as:          "var(--as)",
        fr:          "var(--fr)",
        op:          "var(--op)",
        // Semantic tokens dasti
        ok:          "var(--ok)",
        okb:         "var(--okb)",
        okt:         "var(--okt)",
        er:          "var(--er)",
        erb:         "var(--erb)",
        ert:         "var(--ert)",
        wa:          "var(--wa)",
        wab:         "var(--wab)",
        wat:         "var(--wat)",

        // Backward compat — maintient bg-background, text-foreground, border-accent, etc.
        background:  "var(--sfr)",   // raised surface (cards, panels) — canvas = var(--bg) via [background:var(--bg)]
        foreground:  "var(--ti)",
        primary:     "var(--ac)",    // accent sauge — bg-primary = boutons
        muted:       "var(--tm2)",
        accent:      "var(--ac)",
        hover:       "var(--am)",
        surface:     "var(--sf1)",
        danger:      "var(--er)",
        success:     "var(--ok)",
        warning:     "var(--wa)",
      },

      /*
       * §2 Typography scale — √2 depuis 12px (px fixes dasti)
       */
      fontSize: {
        "tx":  ["12px", { lineHeight: "16px" }],
        "ts":  ["14px", { lineHeight: "20px" }],
        "tb":  ["16px", { lineHeight: "24px" }],
        "tm":  ["20px", { lineHeight: "30px" }],
        "tl":  ["26px", { lineHeight: "36px" }],
        "tx2": ["32px", { lineHeight: "40px" }],
        // Aliases Tailwind classiques (backward compat)
        "xs":   ["12px", { lineHeight: "16px" }],
        "sm":   ["14px", { lineHeight: "20px" }],
        "base": ["16px", { lineHeight: "24px" }],
        "lg":   ["20px", { lineHeight: "30px" }],
        "xl":   ["26px", { lineHeight: "36px" }],
        "2xl":  ["32px", { lineHeight: "40px" }],
        "3xl":  ["42px", { lineHeight: "52px" }],
      },

      /*
       * §1 Spacing — série canonique dasti 4·8·12·16·24·32·40·64
       */
      spacing: {
        '0.5': '2px',
        '1':   '4px',   // --s1
        '2':   '8px',   // --s2
        '3':   '12px',  // --s3
        '4':   '16px',  // --s4
        '5':   '24px',  // --s5
        '6':   '32px',  // --s6
        '7':   '40px',  // --s7
        '8':   '64px',  // --s8
        '9':   '80px',
        '10':  '96px',
        '12':  '128px',
      },

      /*
       * §4 Heights — dasti interactives
       */
      height: {
        'hs':          'var(--hs)',   // 32px
        'hm':          'var(--hm)',   // 40px
        'hb':          'var(--hb)',   // 44px
        'hdr':         'var(--hdr)',  // 54px
        // Backward compat
        'btn-sm':      'var(--hs)',
        'btn-base':    'var(--hm)',
        'btn-primary': 'var(--hb)',
        'btn-tertiary':'var(--hs)',
        'input-base':  'var(--hm)',
        'textarea-base': 'calc(var(--hm) * 3)',
        'header':      'var(--hdr)',
        'footer':      'var(--hs)',
        'toast':       'var(--toast-height)',
        'pill':        'var(--hs)',
      },

      width: {
        'layout-main':    'var(--main-width)',
        'layout-sidebar': 'var(--sidebar-width)',
        'modal-max':      'var(--modal-max-width)',
        'toast':          'var(--toast-max-width)',
      },

      maxWidth: {
        'toast': 'var(--toast-max-width)',
        'modal': 'var(--modal-max-width)',
        'dlg':   '680px',
      },

      /*
       * §3 Border-radius — série dasti
       */
      borderRadius: {
        'rx': 'var(--rx)',  // 4px — décoratif
        'rs': 'var(--rs)',  // 6px — boutons, inputs
        'rm': 'var(--rm)',  // 12px — cards, panels
        'rl': 'var(--rl)',  // 18px — modals
        'rp': 'var(--rp)',  // 999px — pills, badges
        // Aliases standards Tailwind (backward compat)
        'sm': 'var(--rx)',
        'md': 'var(--rs)',
        'lg': 'var(--rm)',
        'xl': 'var(--rl)',
      },

      /*
       * §9 Box shadows — chaudes dasti (hsla(30,20%,8%,…))
       */
      boxShadow: {
        'sha': 'var(--sha)',
        'shb': 'var(--shb)',
        'shc': 'var(--shc)',
        // Aliases standards
        'sm':  'var(--sha)',
        'md':  'var(--shb)',
        'lg':  'var(--shc)',
        'subtle': 'var(--sha)',
        'card':   'var(--shb)',
      },

      /*
       * §10 Transitions
       */
      transitionTimingFunction: {
        'ez':  'var(--ez)',
        'ezb': 'var(--ezb)',
      },

      /*
       * border-accent → --bo (soft border) sans casser bg-accent / text-accent
       */
      borderColor: {
        DEFAULT: "var(--bo)",
        accent: "var(--bo)",
      },
    },
  },

  darkMode: 'class',
  plugins: [],
};
