/**
 * Prepzy design configuration — the single source of truth for the application's styling.
 *
 * Edit this file to change colours, typography, spacing, themes or any component's look.
 * Then run `npm run tokens` (also runs automatically before dev/build/storybook).
 *
 * How values work:
 *   - Colour props accept a semantic name ('brand', 'foreground-muted'), a palette step ('brand.700')
 *     or a raw CSS colour ('#fff', 'transparent').
 *   - radius / shadow / fontSize / fontFamily / fontWeight / spacing props accept a token name from
 *     `tokens` ('md', 'card') or a raw CSS value ('10px').
 *   - A value that looks like a token name but doesn't exist fails generation, so typos are caught.
 *
 * Adding things:
 *   - New colour / font size / radius / shadow: add it under `tokens`. It becomes a Tailwind utility too
 *     (tokens.colors.brand[800] → `bg-brand-800`, semantic 'highlight' → `bg-highlight`,
 *     fontSizes.hero → `text-hero`, radius['2xl'] → `rounded-2xl`, shadows.pop → `shadow-pop`).
 *     Only colours defined here exist: Tailwind's default palette (bg-red-500 …) is switched off.
 *   - New theme: add an entry under `themes`; apply it with `data-theme="<name>"` on any element.
 *   - New component variant: add it under `components.<name>.variants`; the component accepts it
 *     as a prop immediately (fully typed), no component code changes needed.
 *   - New component: add `components.<name>` here, then create the React component that uses it.
 *
 * Values marked "proposed" are not from the current brand and need the designer's confirmation.
 */
import { defineDesignConfig } from './src/config/schema.ts';

export const designConfig = defineDesignConfig({
  tokens: {
    colors: {
      brand: {
        25: '#F8F7FF', // study plan / diagnostic: page background
        50: '#F5F3FF',
        75: '#EDEBFA', // dashboard: plan card, chips, light chart bars, active rail item
        100: '#E8E5F9',
        125: '#F3F0FF', // study plan / diagnostic: back buttons, selected rows
        150: '#DBDAF1', // dashboard: chip borders, progress tracks
        175: '#E3E1F4', // study plan / diagnostic: row borders, progress tracks
        200: '#D4CEFB',
        300: '#C9C3ED', // dashboard: decorative dots, hover borders
        400: '#6A5FD0', // dashboard: concept-card gradient top
        450: '#5346B8', // dashboard: raised "Ask" button / CTA gradient top
        500: '#554CA3', // gradient start (auth hero)
        600: '#4C41A2',
        700: '#3D348B',
        800: '#2F2878', // gradient middle (auth hero)
        900: '#241C62', // refer & earn: banner gradient end
        950: '#1A1240', // headings on auth screens
      },
      neutral: {
        0: '#FFFFFF',
        50: '#F8F8FC',
        100: '#F3F4F6', // learn / notes: chip and track backgrounds
        120: '#F1F5F9', // exam palette: not visited
        250: '#E2E8F0', // exam palette: not visited border
        150: '#E6E6F0', // auth dividers / outlines
        200: '#E4E7EC', // proposed: default border
        300: '#D1D5DB', // notes: "not started" dot
        350: '#9CA3AF', // learn / notes: captions, chevrons
        400: '#9090B0', // small caps labels
        500: '#64748B',
        550: '#6B7280', // learn / notes: secondary text
        600: '#4A5565',
        450: '#8D8D8D', // dashboard: chart captions
        650: '#44446A', // auth body text
        700: '#364153',
        800: '#1E2939',
        850: '#353535', // dashboard: section headings
        900: '#1E1E1E',
        950: '#101828',
      },
      accent: {
        50: '#FFF6EB',
        100: '#FFE9CC', // chart: last attempt
        250: '#FFC740', // refer & earn: coin face, copy link
        300: '#FFBD6E', // "Start solving" gradient top
        400: '#FFAA3E',
        500: '#FF8C00',
        600: '#D19A03', // gold stat values
        700: '#E8802F', // "Start solving" gradient bottom
        800: '#8A4B00', // learn: "In progress" pill text
      },
      info: {
        50: '#E3EDFC',
        25: '#F6F9FE', // board exam player: status tiles, question header
        400: '#4285F4', // course progress gradient end
        600: '#1363DF',
        700: '#1158C5', // board exam player: section pills, Save & Next
      },
      // Dark "Ask Socrates" card (NEET dashboard).
      night: {
        700: '#2C2359',
        800: '#171029',
        900: '#0C0918',
        950: '#0A0A0D', // learn: video player backdrop
      },
      // proposed status colours
      success: { 50: '#ECFDF3', 100: '#DCFCE7', 350: '#25D366', 400: '#22C55E', 450: '#2FA36B', 500: '#10B981', 600: '#039855', 700: '#16A34A' },
      warning: { 50: '#FFFAEB', 100: '#FDE7D9', 500: '#EA580C', 600: '#DC6803' },
      danger: { 25: '#FDECEC', 50: '#FEF3F2', 450: '#E5484D', 600: '#D92D20' }, // 25/450: exam review incorrect
      // Board learn / notes pages (chapter, lecture, PYQ and NCERT screens of the previous app).
      learn: {
        ink: '#1C1B2E', // titles
        muted: '#6E6E80', // secondary text
        faint: '#A3A3B2', // empty chapter rows
        handle: '#DCDBE5', // drawer grab handle
        line: '#ECEBF2', // card borders, skeleton bars
        'line-strong': '#E2E0EE', // pill outlines
        card: '#ECECF3', // lesson card border
        soft: '#F1F0F7', // skeletons, number chips
        hover: '#F7F7FA', // row hover, empty boxes
        track: '#ECEAF8', // tab track, banner
        chip: '#EEEDF5', // filter track
        'quiz-soft': '#FFF4E5', // assessment icon tile
        quiz: '#C97A1A', // assessment label
        'ok-soft': '#EAF7EE', // correct option
        'ok-line': '#BFE5CA',
        ok: '#1E7B3A',
        notes: '#F1F0F9', // notes "example" box
      },
      // plans, checkout, billing and the post-signup welcome screen (previous app's purchase pages)
      plan: {
        ink: '#16162E',
        deep: '#251C51',
        violet: '#4B3BA0',
        'violet-deep': '#2E2270',
        navy: '#2E2C6E',
        muted: '#7A7694',
        label: '#8B86B0',
        strike: '#A6A2BC',
        line: '#EBE9F4',
        'line-strong': '#DAD4F0',
        tile: '#F4F3FA',
        'tile-active': '#F5F4FB',
        chip: '#EFECFA',
        gold: '#F5A63C',
        save: '#1F9D63',
        'save-light': '#63D79F',
        'save-deep': '#1F7A4F',
        'save-soft': '#F1F9F4',
        'save-line': '#BFE6CE',
        'card-from': '#1E1450',
        'card-to': '#463699',
        head: '#F3F2FA',
        'head-hl': '#DCD8EC',
        section: '#F8F7FC',
        'section-hl': '#EEECF6',
        'body-hl': '#F1F0F8',
        divider: '#DEDAF0',
        night: '#1B1440',
        'night-panel': '#15102F',
        'night-head': '#100C26',
        'night-text': '#A9A3C8',
        'night-label': '#8A84AD',
        ok: '#3EA455',
        'ok-text': '#6EE7A0',
        fail: '#E23B26',
        'fail-text': '#F0654F',
        pending: '#F3B740',
        warm: '#FFFAF2',
        'warm-line': '#F3E4CC',
        'warm-text': '#8A6A38',
        error: '#C0563C',
        rose: '#E11D48',
        'rose-soft': '#FEF5F5',
        'rose-line': '#F3C2C2',
        'rose-text': '#8A5252',
        'rose-deep': '#B91C1C',
        red: '#DC2626',
        'red-line': '#FCA5A5',
        amber: '#E0A020',
        'amber-line': '#F3D08A',
        'green-line': '#86EFAC',
        alert: '#E5484D',
        'alert-soft': '#FDECEC',
        'alert-line': '#F5B8B8',
        extend: '#1F9254',
        'extend-soft': '#E3F5EA',
        'extend-line': '#B8E6CC',
        receipt: '#F4F3F9',
        panel: '#FAFAFD',
        'panel-line': '#ECECF4',
        page: '#F6F6FB',
        paid: '#1E9E4F',
        'paid-soft': '#EAFBF1',
        'paid-line': '#34C759',
        refund: '#B4690E',
        'refund-soft': '#FFF3E0',
        cbse: '#1F2937',
        expired: '#EF4444',
        'expired-soft': '#FEF2F2',
        'expired-line': '#FBD0D0',
        'renew-text': '#016630',
        'renew-soft': '#F0FDF4',
        'renew-line': '#B9F8CF',
        history: '#F9FAFB',
        'history-line': '#EAEAF6',
        welcome: '#F6F7FB',
        'ring-1': '#ECEAF9',
        'ring-2': '#DEDAF2',
        'ring-3': '#DFF5E1',
        check: '#1E7A45',
        fresh: '#12A150',
        tab: '#EDEBFB',
        'tab-text': '#6B6B95',
        input: '#F8F7FC',
        'input-line': '#E2DDEF',
        'ok-soft': '#EAF7EE',
        'ok-line': '#B7E4C7',
        'err-line': '#F0B4B4',
        'err-text': '#C92A2A',
        applied: '#128554',
        'table-line': '#E7E2D9',
        'table-head': '#FAF9F6',
        'table-row': '#EEEAE4',
        'table-text': '#292442',
        'table-label': '#5B566E',
        'table-note': '#777386',
        'table-topper': '#423A9B',
      },
      // Schools (teacher) portal, ported from the previous app's schools pages.
      schools: {
        'login-to': '#6C63C0', // login gradient end
        peach: '#F6A65C', // "N Students" pill
        orange: '#F6A635', // doubts card, chart colour
        hours: '#F09241', // learning hours, doubts counts
        green: '#348B3E', // stat values
        pink: '#EC4899', // student avatar
        bar: '#8884D8', // weekly time chart bars
        violet: '#9F77DD', // chart colour
        chip: '#ECFDF5', // student chips
        line: '#E5E7EB', // card borders
        faint: '#F9FAFB', // chapter chips
        muted: '#667085', // dropdown email
        menu: '#EAEAF6', // dropdown / drawer borders
        logout: '#DC2626',
        'logout-soft': '#FFF1F1',
        'logout-line': '#FFD5D5',
        error: '#FF0101', // login error box
      },
      // Doubt solver (Socrates) and Atlas chat.
      socrates: {
        page: '#F5F4FA', // solver page background
        ink: '#241D52', // headings
        text: '#1F1A4D', // chat text
        body: '#4A4856', // subject name
        muted: '#6E6B7B', // secondary text
        faint: '#9A98A8', // captions, chevrons
        line: '#E4E0F0', // card borders
        divider: '#EEEDF4', // panel dividers
        chip: '#ECE9FB', // tags, skeletons
        'chip-hover': '#E2DDF8',
        soft: '#F3F1FB', // faint skeletons, panels
        dot: '#D6D2EA', // carousel dots
        gold: '#8A5A12', // selected subject
        error: '#C8352B',
        'panel-from': '#F3F0FD', // character panel gradient
        'panel-to': '#E2DBF8',
        overlay: '#1F1A4D', // drawer overlay
        cover: '#B9B8C2', // book page edges
        'cover-soft': '#ECECEF',
      },
      // Live voice talk (Atlas / lecture tutor / Vedica): talk screen, mini bar, mic sheet, summary.
      voice: {
        ink: '#23213A', // text
        muted: '#5E5A78', // helper text
        faint: '#6E6A8A', // captions
        light: '#EDE9FE', // idle bars, borders, word highlight
        soft: '#F5F3FF', // tutor tiles, control buttons
        page: '#F8F9FA', // checklist / hint pill
        line: '#E4DEFC', // language pill border
        'line-hover': '#D4CBFA',
        radio: '#D9D4EC', // unselected language radio
        amber: '#FFAA3E', // student speaking
        'amber-soft': '#FEF3E7',
        'amber-text': '#7A4A0B',
        ok: '#10B981',
        'ok-light': '#34D399',
        'ok-soft': '#ECFDF5',
        'ok-hover': '#D1FAE5',
        'muted-bg': '#E5E7EB', // muted badge
        danger: '#EF4444', // hang up
        'danger-soft': '#FEF2F2',
        // Vedica "Talk live" buttons (indigo → violet)
        indigo: '#4F46E5',
        'indigo-hover': '#4338CA',
        violet: '#7C3AED',
        'violet-hover': '#6D28D9',
        'indigo-soft': '#EEF2FF',
        'indigo-line': '#E0E7FF',
      },
      // Partners (affiliate) portal: sign-in / sign-up screens and the partner dashboard shell.
      partner: {
        hero: '#453AA0', // brand panel gradient start
        'hero-text': '#D5CFF0',
        'hero-label': '#C8C2EC',
        gold: '#F5B301',
        'gold-hover': '#E5A700',
        warm: '#FBF9F4', // mobile page
        page: '#FBFAFF',
        ink: '#241D52',
        muted: '#6B6B80',
        hover: '#332B75',
        input: '#F8F7FC',
        'input-line': '#E2DDEF',
        placeholder: '#9A97A8',
        error: '#EF4444',
        line: '#E9E7F2',
        tile: '#EDE9FE',
        chip: '#EDEAFB',
        'chip-hover': '#E2DDF7',
        'chip-line': '#DCD9F0',
        'chip-text': '#4A4466',
        disabled: '#CFCAE4',
        mint: '#8EE6B8',
        'mint-soft': '#E8F6EE',
        green: '#128554',
        body: '#4A4856',
        night: '#1A1A2E',
        saffron: '#FF9933',
        'india-green': '#138808',
        canvas: '#FAFAFC', // dashboard page
        rule: '#ECE9F6', // shell borders, stepper track
        border: '#F2F2F2', // dashboard cards
        label: '#7A7690',
        grey: '#8B8B9E',
        nav: '#3A3560',
        icon: '#8B85B8',
        'body-soft': '#5A5580',
        loading: '#EEECF6',
        'card-from': '#4A3FA0',
        'orange-hover': '#F1971F',
        'orange-soft': '#FFF8EC',
        'wa-soft': '#F0FBF3',
        'avatar-from': '#FFD9A1',
        'avatar-to': '#F6A94B',
        amber: '#9A5B00',
        'amber-soft': '#FEF3E7',
        'amber-line': '#F6DCAE',
        'amber-chip': '#F0CFA0',
        'amber-tile': '#FCE4C0',
        ok: '#047857',
        'ok-soft': '#ECFDF5',
        'ok-line': '#BBF0D8',
        'ok-tile': '#D6F5E6',
        red: '#B91C1C',
        'red-soft': '#FEECEC',
        'red-line': '#F6C6C6',
        'red-tile': '#FBD8D8',
        'field-line': '#E3DFF3',
      },
    },
    fonts: {
      sans: "var(--font-poppins), 'Poppins', ui-sans-serif, system-ui, sans-serif",
      // Rounded display face used for headings in the original design.
      display: "var(--font-baloo), 'Baloo 2', var(--font-poppins), ui-sans-serif, sans-serif",
      // Decorative maths symbols and formulas on the "Ask Socrates" card.
      serif: "ui-serif, Georgia, 'Times New Roman', serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
      // Partners portal sign-in / sign-up body text (loaded by app/partners/layout.tsx).
      partner: "var(--font-source-sans), 'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
      // Parents portal sign-in: the previous app rendered it in the browser's default sans face.
      plain: 'Arial, Helvetica, sans-serif',
    },
    // [font-size, line-height]
    fontSizes: {
      xs: ['12px', '16px'],
      sm: ['14px', '22px'],
      md: ['16px', '24px'],
      lg: ['18px', '26px'],
      xl: ['20px', '28px'],
      '2xl': ['24px', '32px'],
      '3xl': ['32px', '40px'],
      '4xl': ['48px', '56px'],
      display: ['64px', '72px'],
    },
    fontWeights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    radius: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      full: '9999px',
    },
    // Tailwind's numeric scale in pages: p-1 = 4px, p-4 = 16px, gap-6 = 24px. Change this to rescale the app.
    spacingUnit: '4px',
    // Named spacing used by component styles below (paddingX: 'md').
    spacing: {
      '2xs': '4px',
      xs: '8px',
      sm: '12px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
    },
    shadows: {
      sm: '0 1px 2px rgb(16 24 40 / 0.06)',
      card: '0 4px 16px rgb(16 24 40 / 0.08)',
      lg: '0 12px 32px rgb(16 24 40 / 0.12)',
      'brand-glow': '0 8px 24px rgb(61 52 139 / 0.35)',
      'focus-ring': '0 0 0 4px rgb(61 52 139 / 0.12)',
      // App shell (ported from the previous app)
      header: '0 0 24px 0 rgb(226 226 226)',
      'bar-up': '0 -2px 10px rgb(0 0 0 / 0.1)',
      raised: '0 6px 14px rgb(61 52 139 / 0.35)',
      'cta-dark': '0 6px 24px 0 rgb(0 0 0 / 0.33)',
      'socrates-card': '0 8px 25px rgb(61 51 140 / 0.10)', // doubt solver cards
      'socrates-book': '0 8px 18px rgb(31 26 77 / 0.25)', // centred textbook
      'socrates-pick': '0 11px 42px rgb(240 178 64 / 0.55), 0 14px 22px rgb(89 56 10 / 0.26)', // selected textbook
      'socrates-sheet': '0 8px 30px rgb(31 26 77 / 0.25)', // Ask sheet, Atlas panel
      'socrates-bubble': '0 2px 8px rgb(31 26 77 / 0.06)', // tutor bubble
      'schools-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', // schools portal cards
      'voice-avatar': '0 10px 24px -12px rgb(61 52 139 / 0.5)', // live talk: tutor photo
      'voice-menu': '0 18px 40px -14px rgb(61 52 139 / 0.4)', // live talk: language menu
      'voice-pill': '0 6px 16px -8px rgb(61 52 139 / 0.7)', // live talk: open language pill
      'voice-bar': '0 16px 32px -16px rgb(35 33 58 / 0.6)', // live talk: mini bar
      'voice-cta': '0 6px 14px -8px rgb(79 70 229 / 0.9)', // Vedica "Talk live"
      'voice-live': '0 4px 12px rgb(61 52 139 / 0.25)', // Atlas "Live chat" pill
      'schools-pop': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', // profile dropdown
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
  },

  // Semantic colours used by components and pages. Themes override these.
  semantic: {
    brand: 'brand.700',
    'brand-hover': 'brand.600',
    'brand-soft': 'brand.50',
    'brand-subtle': 'brand.100',
    'brand-deep': 'brand.800',
    'brand-light': 'brand.500',
    'on-brand': 'neutral.0',
    ink: 'brand.950',
    'foreground-soft': 'neutral.650',
    'foreground-subtle': 'neutral.400',
    line: 'neutral.150',
    gold: 'accent.600',
    canvas: 'neutral.50',
    surface: 'neutral.0',
    foreground: 'neutral.900',
    'foreground-muted': 'neutral.500',
    border: 'neutral.200',
    'border-strong': 'brand.200',
    focus: 'brand.600',
    accent: 'accent.500',
    'accent-soft': 'accent.50',
    info: 'info.600',
    'info-soft': 'info.50',
    success: 'success.600',
    'success-soft': 'success.50',
    warning: 'warning.600',
    'warning-soft': 'warning.50',
    danger: 'danger.600',
    'danger-soft': 'danger.50',
  },

  // Per exam-category themes (chosen from the exam registry). Empty = same as the default.
  themes: {
    board: {},
    competitive: {},
    reference: {},
  },

  components: {
    button: {
      base: {
        fontFamily: 'sans',
        fontSize: 'sm',
        fontWeight: 'semibold',
        radius: 'md',
        gap: 'xs',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'transparent',
        focus: { outline: '2px solid var(--color-focus)', outlineOffset: '2px' },
        disabled: { opacity: 0.5, cursor: 'not-allowed' },
      },
      variants: {
        intent: {
          primary: { background: 'brand', color: 'on-brand', hover: { background: 'brand-hover' } },
          secondary: { background: 'brand-soft', color: 'brand', hover: { background: 'brand-subtle' } },
          outline: {
            background: 'surface',
            color: 'brand',
            borderColor: 'border-strong',
            hover: { background: 'brand-soft' },
          },
          ghost: { background: 'transparent', color: 'brand', hover: { background: 'brand-soft' } },
          accent: { background: 'accent', color: 'on-brand', hover: { background: 'accent.400' } },
          danger: { background: 'danger', color: 'on-brand', hover: { opacity: 0.9 } },
        },
        size: {
          sm: { height: '32px', paddingX: 'sm', fontSize: 'xs' },
          md: { height: '40px', paddingX: 'md' },
          lg: { height: '48px', paddingX: 'lg', fontSize: 'md' },
          // Main call-to-action on auth screens.
          xl: { height: '60px', paddingX: 'lg', fontSize: 'md', fontWeight: 'bold', radius: '14px', shadow: 'brand-glow' },
        },
        width: {
          auto: {},
          full: { width: '100%' },
        },
      },
      defaults: { intent: 'primary', size: 'md', width: 'auto' },
    },

    card: {
      base: {
        background: 'surface',
        color: 'foreground',
        radius: 'xl',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        gap: 'sm',
      },
      variants: {
        appearance: {
          elevated: { borderColor: 'transparent', shadow: 'card' },
          outline: {},
          tinted: { background: 'brand-soft', borderColor: 'border-strong' },
          highlight: { background: 'accent-soft', borderColor: 'accent.400', borderWidth: '2px' },
        },
        padding: {
          none: { padding: '0' },
          sm: { padding: 'sm' },
          md: { padding: 'md' },
          lg: { padding: 'lg' },
        },
      },
      defaults: { appearance: 'elevated', padding: 'md' },
      slots: {
        header: { base: { gap: '2xs' } },
        title: { base: { fontSize: 'lg', fontWeight: 'semibold', color: 'foreground' } },
        description: { base: { fontSize: 'sm', color: 'foreground-muted' } },
        content: { base: { fontSize: 'sm' } },
        footer: { base: { gap: 'xs' } },
      },
    },

    input: {
      base: {
        fontFamily: 'sans',
        fontSize: 'sm',
        color: 'foreground',
        background: 'surface',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        radius: 'md',
        paddingX: 'sm',
        placeholder: { color: 'foreground-muted' },
        hover: { borderColor: 'border-strong' },
        focus: { borderColor: 'brand', outline: '3px solid var(--color-brand-soft)' },
        invalid: { borderColor: 'danger' },
        disabled: { background: 'canvas', opacity: 0.7, cursor: 'not-allowed' },
      },
      variants: {
        size: {
          sm: { height: '32px' },
          md: { height: '40px' },
          lg: { height: '48px', fontSize: 'md', paddingX: 'md' },
        },
      },
      defaults: { size: 'md' },
    },

    // A control with a prefix (country code, icon …) and an input that share one border.
    'input-group': {
      base: {
        background: 'surface',
        color: 'ink',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: 'brand',
        radius: 'lg',
        height: '64px',
        focusWithin: { shadow: 'focus-ring' },
        invalid: { borderColor: 'danger' },
      },
      slots: {
        prefix: {
          base: {
            paddingX: 'md',
            gap: '2xs',
            borderColor: 'line',
            css: { 'border-right-width': '1.5px', 'border-right-style': 'solid' },
          },
        },
        input: { base: { fontSize: 'lg', fontWeight: 'bold', color: 'ink', paddingX: 'sm' } },
      },
    },

    textarea: {
      base: {
        fontFamily: 'sans',
        fontSize: 'sm',
        color: 'foreground',
        background: 'surface',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        radius: 'md',
        padding: 'sm',
        minHeight: '160px',
        placeholder: { color: 'foreground-muted' },
        hover: { borderColor: 'border-strong' },
        focus: { borderColor: 'brand', outline: '3px solid var(--color-brand-soft)' },
        invalid: { borderColor: 'danger' },
        disabled: { background: 'canvas', opacity: 0.7, cursor: 'not-allowed' },
      },
    },

    field: {
      base: { gap: '2xs' },
      slots: {
        label: { base: { fontSize: 'sm', fontWeight: 'medium', color: 'foreground' } },
        hint: { base: { fontSize: 'xs', color: 'foreground-muted' } },
        error: { base: { fontSize: 'xs', color: 'danger' } },
      },
    },

    badge: {
      base: { fontSize: 'xs', fontWeight: 'semibold', radius: 'full', paddingX: 'xs', height: '22px', gap: '2xs' },
      variants: {
        tone: {
          brand: { background: 'brand-soft', color: 'brand' },
          neutral: { background: 'canvas', color: 'foreground-muted' },
          accent: { background: 'accent-soft', color: 'accent' },
          info: { background: 'info-soft', color: 'info' },
          success: { background: 'success-soft', color: 'success' },
          warning: { background: 'warning-soft', color: 'warning' },
          danger: { background: 'danger-soft', color: 'danger' },
        },
      },
      defaults: { tone: 'brand' },
    },

    alert: {
      base: {
        radius: 'lg',
        padding: 'md',
        gap: 'xs',
        fontSize: 'sm',
        color: 'foreground',
        borderWidth: '1px',
        borderStyle: 'solid',
      },
      variants: {
        tone: {
          info: { background: 'info-soft', borderColor: 'info' },
          success: { background: 'success-soft', borderColor: 'success' },
          warning: { background: 'warning-soft', borderColor: 'warning' },
          danger: { background: 'danger-soft', borderColor: 'danger' },
          brand: { background: 'brand-soft', borderColor: 'border-strong' },
        },
      },
      defaults: { tone: 'info' },
      slots: {
        title: { base: { fontWeight: 'semibold' } },
      },
    },

    spinner: {
      base: { color: 'brand' },
      variants: {
        size: {
          sm: { width: '16px', height: '16px' },
          md: { width: '24px', height: '24px' },
          lg: { width: '40px', height: '40px' },
        },
      },
      defaults: { size: 'md' },
    },

    skeleton: {
      base: { background: 'brand-subtle', radius: 'sm' },
    },

    // The fill uses the root's text colour, so `tone` only needs to set `color`.
    progress: {
      base: { background: 'brand-subtle', radius: 'full', height: '8px', color: 'brand' },
      variants: {
        tone: {
          brand: {},
          success: { color: 'success' },
          accent: { color: 'accent' },
          danger: { color: 'danger' },
        },
      },
      defaults: { tone: 'brand' },
      slots: {
        indicator: { base: { background: 'currentColor', radius: 'full' } },
      },
    },

    dialog: {
      base: {},
      slots: {
        overlay: { base: { background: 'rgb(16 24 40 / 0.5)' } },
        content: {
          base: {
            background: 'surface',
            color: 'foreground',
            radius: 'xl',
            shadow: 'lg',
            padding: 'lg',
            gap: 'md',
            width: 'calc(100% - 32px)',
            maxWidth: '480px',
          },
        },
        title: { base: { fontSize: 'xl', fontWeight: 'semibold' } },
        description: { base: { fontSize: 'sm', color: 'foreground-muted' } },
        footer: { base: { gap: 'xs' } },
      },
    },

    tabs: {
      base: { gap: 'md' },
      slots: {
        list: { base: { background: 'brand-soft', radius: 'lg', padding: '2xs', gap: '2xs' } },
        trigger: {
          base: {
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'foreground-muted',
            radius: 'md',
            paddingX: 'md',
            height: '36px',
            hover: { color: 'foreground' },
            selected: { background: 'surface', color: 'brand', shadow: 'sm' },
            focus: { outline: '2px solid var(--color-focus)', outlineOffset: '2px' },
          },
        },
      },
    },

    'option-group': {
      base: { gap: 'sm' },
    },

    // MCQ answer option in the exam player and result review.
    option: {
      base: {
        background: 'surface',
        color: 'foreground',
        fontSize: 'sm',
        radius: 'lg',
        padding: 'sm',
        gap: 'sm',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
        cursor: 'pointer',
        hover: { borderColor: 'border-strong', background: 'brand-soft' },
        selected: { borderColor: 'brand', background: 'brand-soft' },
        focus: { outline: '2px solid var(--color-focus)', outlineOffset: '2px' },
        disabled: { cursor: 'default' },
      },
      variants: {
        result: {
          none: {},
          correct: { borderColor: 'success', background: 'success-soft' },
          incorrect: { borderColor: 'danger', background: 'danger-soft' },
        },
      },
      defaults: { result: 'none' },
      slots: {
        marker: {
          base: {
            width: '28px',
            height: '28px',
            radius: 'full',
            fontSize: 'xs',
            fontWeight: 'semibold',
            background: 'canvas',
            color: 'foreground-muted',
          },
        },
        label: { base: {} },
      },
    },

    // Question number cell in the exam palette.
    // Previous app: 44px rounded squares, two-digit bold numbers.
    'palette-item': {
      base: {
        width: '44px',
        height: '44px',
        radius: 'sm',
        fontSize: 'sm',
        fontWeight: 'bold',
        borderWidth: '1px',
        borderStyle: 'solid',
        cursor: 'pointer',
        focus: { outline: '2px solid var(--color-focus)', outlineOffset: '2px' },
      },
      variants: {
        status: {
          'not-visited': { background: 'neutral.120', borderColor: 'neutral.250', color: 'neutral.500' },
          skipped: { background: 'accent.400', borderColor: 'transparent', color: 'on-brand' },
          answered: { background: 'success.450', borderColor: 'transparent', color: 'on-brand' },
          marked: { background: 'brand', borderColor: 'transparent', color: 'on-brand' },
          // Result review
          correct: { background: 'success.450', borderColor: 'transparent', color: 'on-brand' },
          incorrect: { background: 'danger.450', borderColor: 'transparent', color: 'on-brand' },
          unattempted: { background: 'brand', borderColor: 'transparent', color: 'on-brand' },
          partial: { background: 'accent.400', borderColor: 'transparent', color: 'on-brand' },
        },
        current: {
          no: {},
          yes: { outline: '2px solid var(--color-brand)', outlineOffset: '2px' },
        },
      },
      defaults: { status: 'not-visited', current: 'no' },
    },
  },
});

export default designConfig;
