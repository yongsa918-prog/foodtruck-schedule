import { useState } from 'react'
import { useAdmin } from '../hooks/useAdminAuth'

export default function AdminLock() {
  const { isAdmin, login, logout } = useAdmin()
  const [showInput, setShowInput] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (login(pw)) {
      setShowInput(false)
      setPw('')
      setError(false)
    } else {
      setError(true)
    }
  }

  if (isAdmin) {
    return (
      <button className="lock-btn unlocked" onClick={logout}>
        <span className="lock-icon">🔓</span>
        <span>편집 중</span>
      </button>
    )
  }

  if (showInput) {
    return (
      <form className="lock-form" onSubmit={handleSubmit}>
        <input
          type="password"
          className={`lock-input ${error ? 'error' : ''}`}
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false) }}
          autoFocus
        />
        <button type="submit" className="lock-submit">확인</button>
        <button type="button" className="lock-cancel" onClick={() => { setShowInput(false); setPw(''); setError(false) }}>취소</button>
      </form>
    )
  }

  return (
    <button className="lock-btn" onClick={() => setShowInput(true)}>
      <span className="lock-icon">🔒</span>
      <span>잠금</span>
    </button>
  )
}
