import localFont from 'next/font/local'

// Intel One Mono, the body font, self-hosted from @fontsource-variable/
// intel-one-mono: the build reads it from node_modules instead of fetching
// Google Fonts, so it needs no network. One variable woff2 per subset
// (weights 300–700), each its own family with its own unicode-range; the
// font stack in app/globals.css lists all four, so the browser takes each
// character from the first family whose range holds it and fetches a subset
// only when the page has such a character (the box-drawing set matters for
// `tree` output in code blocks). next/font wants a literal per call.
//
// display 'optional' + preload on the latin file: the font gets a short block
// window and is never swapped in late, so the layout can't shift; the preload
// is what lets a FIRST visit make that window (docs/history.md, the font
// reflow). adjustFontFallback is off: next/font would add an Arial-metric face
// ahead of the monospace fallbacks in the stack.

const intelOneMono = localFont({
  src: '../node_modules/@fontsource-variable/intel-one-mono/files/intel-one-mono-latin-wght-normal.woff2',
  weight: '300 700',
  display: 'optional',
  preload: true,
  adjustFontFallback: false,
  variable: '--font-intel-mono',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
})

const intelOneMonoExt = localFont({
  src: '../node_modules/@fontsource-variable/intel-one-mono/files/intel-one-mono-latin-ext-wght-normal.woff2',
  weight: '300 700',
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-intel-mono-ext',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
})

const intelOneMonoVi = localFont({
  src: '../node_modules/@fontsource-variable/intel-one-mono/files/intel-one-mono-vietnamese-wght-normal.woff2',
  weight: '300 700',
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-intel-mono-vi',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    },
  ],
})

const intelOneMonoSym = localFont({
  src: '../node_modules/@fontsource-variable/intel-one-mono/files/intel-one-mono-symbols2-wght-normal.woff2',
  weight: '300 700',
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-intel-mono-sym',
  declarations: [
    { prop: 'unicode-range', value: 'U+2000-2001,U+2004-2008,U+200A,U+23B8-23BD,U+2500-259F' },
  ],
})

// The four variables, for <html>: app/globals.css builds the stack from them.
export const fontClasses = [intelOneMono, intelOneMonoExt, intelOneMonoVi, intelOneMonoSym].map((f) => f.variable).join(' ')
