export default function GGWordmark({ className }) {
  return (
    <span className={`gg-wordmark${className ? ' ' + className : ''}`}>
      GLITCH<span className="gg-wordmark__dot" aria-hidden="true" />GANG
    </span>
  )
}

