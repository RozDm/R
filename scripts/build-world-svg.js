// Generates public/world.svg from world-map-country-shapes at build time so
// the runtime doesn't have to ship 85 kB of JSON to draw the map. Re-run when
// the package version bumps:  node scripts/build-world-svg.js
const fs = require('node:fs')
const shapes = require('world-map-country-shapes').default || require('world-map-country-shapes')

const paths = shapes
  .map((c) => `<path id="c-${c.id}" d="${c.shape}"/>`)
  .join('')

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1001" preserveAspectRatio="xMidYMid meet">' +
  paths +
  '</svg>'

fs.writeFileSync('public/world.svg', svg)
console.log(`world.svg: ${shapes.length} countries, ${svg.length} bytes`)
