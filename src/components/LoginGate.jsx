import { useState } from 'react'
import { useAdmin } from '../hooks/useAdminAuth'

export default function LoginGate({ children }) {
  const { isAuthenticated, authenticate } = useAdmin()
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  if (isAuthenticated) return children

  function handleSubmit(e) {
    e.preventDefault()
    const result = authenticate(pw)
    if (result) {
      setPw('')
      setError(false)
    } else {
      setError(true)
    }
  }

  return (
    <div className="login-gate">
      <div className="login-card">
        <div className="login-title">푸드트럭 스케줄</div>
        <div className="login-sub">비밀번호를 입력해주세요</div>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className={`login-input ${error ? 'error' : ''}`}
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false) }}
            autoFocus
          />
          <button type="submit" className="login-btn">입장</button>
        </form>
        {error && <div className="login-error">비밀번호가 올바르지 않습니다</div>}
      </div>
    </div>
  )
}
