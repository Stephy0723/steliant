import { useState } from 'react'
import { motion } from 'framer-motion'
import Avatar from '../Avatar/Avatar.jsx'
import RoleBadge from '../RoleBadge/RoleBadge.jsx'
import { Icon } from '../icons/Icons.jsx'
import './PollCard.css'

export default function PollCard({ post }) {
  const { author, time, question, options: initialOptions, likes: initLikes, liked: initLiked, comments } = post
  const [options, setOptions] = useState(initialOptions)
  const [voted, setVoted] = useState(null)
  const [liked, setLiked] = useState(initLiked)
  const [likes, setLikes] = useState(initLikes)

  const totalVotes = options.reduce((s, o) => s + o.votes, 0)

  const vote = (id) => {
    if (voted) return
    setVoted(id)
    setOptions(prev => prev.map(o => o.id === id ? { ...o, votes: o.votes + 1 } : o))
  }

  const toggleLike = () => {
    setLiked(v => !v)
    setLikes(v => liked ? v - 1 : v + 1)
  }

  return (
    <motion.div
      className="gg-poll-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="gg-poll__head">
        <Avatar src={author.avatar} size={38} />
        <div className="gg-poll__author">
          <div className="gg-poll__author-row">
            <span className="gg-poll__nick">{author.nick}</span>
            <RoleBadge role={author.role} compact />
          </div>
          <span className="gg-poll__time">{time}</span>
        </div>
        <span className="gg-poll__type-badge">{Icon.bolt} Encuesta</span>
      </div>

      {/* Question */}
      <p className="gg-poll__question">{question}</p>

      {/* Options */}
      <div className="gg-poll__options">
        {options.map(opt => {
          const pct = totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0
          const isVoted = voted === opt.id
          return (
            <button
              key={opt.id}
              className={`gg-poll__opt ${isVoted ? 'voted' : ''} ${voted ? 'revealed' : ''}`}
              onClick={() => vote(opt.id)}
              disabled={!!voted}
            >
              <div className="gg-poll__opt-bar" style={{ width: voted ? `${pct}%` : '0%' }} />
              <span className="gg-poll__opt-text">{opt.text}</span>
              {voted && <span className="gg-poll__opt-pct">{pct}%</span>}
              {isVoted && <span className="gg-poll__opt-check">{Icon.check}</span>}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="gg-poll__footer">
        <span className="gg-poll__total">{(totalVotes + (voted ? 1 : 0)).toLocaleString()} votos</span>
        <div className="gg-poll__actions">
          <button className={`gg-post-action ${liked ? 'liked' : ''}`} onClick={toggleLike}>
            {Icon.heart} {likes}
          </button>
          <button className="gg-post-action">
            {Icon.msg} {comments}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

