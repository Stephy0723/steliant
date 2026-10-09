/**
 * BouncyText — Wordmark letter-by-letter bouncy entrance.
 *
 * Props:
 *  text         string   — characters to animate
 *  highlightFrom number  — chars at this index and above get --accent color (-1 = none)
 *  font         string   — CSS font-family override (default: var(--font-display))
 *                          For a bubbly look use "Fredoka" or "Baloo 2" (add Google Font link)
 *  baseDelay    number   — seconds before the first letter starts  (default 0)
 *  stagger      number   — seconds between each letter             (default 0.07)
 *  className    string   — extra class on the wrapper span
 *  onComplete   function — called when the last letter's spring settles
 */
import { motion } from 'framer-motion'
import './BouncyText.css'

// Evaluate once at module load — never changes during session
const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function BouncyText({
  text         = '',
  highlightFrom = -1,
  font,
  baseDelay    = 0,
  stagger      = 0.07,
  className    = '',
  onComplete,
}) {
  const chars = [...text]           // split handles emoji / surrogate pairs
  const last  = chars.length - 1

  // Each letter renders as its own text node — a browser translator can mistake
  // a lone char (e.g. "A") for a word and swap it, so this is marked non-translatable.
  return (
    <span
      className={`bt-word ${className}`}
      style={font ? { fontFamily: font } : undefined}
      aria-label={text}
      translate="no"
    >
      {chars.map((ch, i) => {
        const delay    = baseDelay + i * stagger
        const isAccent = highlightFrom >= 0 && i >= highlightFrom
        const isLast   = i === last

        /* ── REDUCED MOTION: plain fade ─────────────────────── */
        if (PREFERS_REDUCED) {
          return (
            <motion.span
              key={i}
              className={`bt-char${isAccent ? ' bt-char--accent' : ''}`}
              aria-hidden="true"
              translate="no"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay }}
              onAnimationComplete={isLast ? onComplete : undefined}
              data-char={ch === ' ' ? ' ' : ch}
            />
          )
        }

        /* ── FULL BOUNCY ANIMATION ───────────────────────────── */
        return (
          <motion.span
            key={i}
            className={`bt-char${isAccent ? ' bt-char--accent' : ''}`}
            aria-hidden="true"
            translate="no"
            initial={{
              y:       -320,
              scaleY:  0.92,
              scaleX:  1.04,
              opacity: 0,
            }}
            animate={{
              y:      0,
              scaleY: [0.92, 0.90, 1.06, 0.97, 1.01, 1.00],
              scaleX: [1.04, 1.07, 0.95, 1.02, 0.99, 1.00],
              opacity: 1,
            }}
            transition={{
              y: {
                type:      'spring',
                stiffness: 260,
                damping:   10,
                mass:      0.8,
                delay,
              },
              scaleY: {
                duration: 0.72,
                times:    [0, 0.36, 0.54, 0.72, 0.87, 1],
                ease:     'easeOut',
                delay,
              },
              scaleX: {
                duration: 0.72,
                times:    [0, 0.36, 0.54, 0.72, 0.87, 1],
                ease:     'easeOut',
                delay,
              },
              opacity: { duration: 0.06, delay },
            }}
            // Fire onComplete when the last letter's animation finishes.
            // Framer Motion fires this once ALL properties on this element settle.
            onAnimationComplete={isLast ? onComplete : undefined}
            data-char={ch === ' ' ? ' ' : ch}
          />
        )
      })}
    </span>
  )
}

