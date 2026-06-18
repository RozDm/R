// Generates public/world.svg from world-map-country-shapes at build time so
// the runtime doesn't have to ship 85 kB of JSON to draw the map. Re-run when
// the package version bumps:  node scripts/build-world-svg.js
import fs from 'node:fs'
import shapesPkg from 'world-map-country-shapes'

const shapes = shapesPkg.default ?? shapesPkg

// Bake light-grey fill + white stroke as presentation attributes. A path with
// no resolved fill defaults to BLACK, so without this the whole map renders
// black for the instant before the stylesheet applies — or persistently if the
// CSS var ever fails to resolve. Presentation attributes sit at the bottom of
// the cascade, so `.geo-map path` (theme variables) and the data-v intensity
// rules in app/globals.css still win: the live colours stay in CSS, this is
// only the never-black fallback.
const paths = shapes
  .map((c) => `<path id="c-${c.id}" fill="#e5e7eb" stroke="#fff" stroke-width="1" d="${c.shape}"/>`)
  .join('')

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1001" preserveAspectRatio="xMidYMid meet">' +
  paths +
  '</svg>'

fs.writeFileSync('public/world.svg', svg)
console.log(`world.svg: ${shapes.length} countries, ${svg.length} bytes`)
