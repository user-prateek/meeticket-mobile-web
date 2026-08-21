function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

/** Decorative QR stand-in for mock tickets (not a real encoder). */
export function QrCode({ payload = 'meeticket', size = 180, className }) {
  const seed = hashSeed(payload)
  const cells = 21
  const modules = []

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder =
        (x < 7 && y < 7) || (x > cells - 8 && y < 7) || (x < 7 && y > cells - 8)
      const finderOn =
        inFinder &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          x === cells - 1 ||
          x === cells - 7 ||
          y === cells - 1 ||
          y === cells - 7 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= cells - 5 && x <= cells - 3 && y >= 2 && y <= 4) ||
          (x >= 2 && x <= 4 && y >= cells - 5 && y <= cells - 3))

      const bit = ((seed + x * 17 + y * 31) * 2654435761) >>> 24
      const on = inFinder ? finderOn : bit % 3 !== 0
      if (on) modules.push(`${x},${y}`)
    }
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect width={cells} height={cells} fill="#fff" />
      {modules.map((key) => {
        const [x, y] = key.split(',').map(Number)
        return <rect key={key} x={x} y={y} width="1" height="1" fill="#111" />
      })}
    </svg>
  )
}
