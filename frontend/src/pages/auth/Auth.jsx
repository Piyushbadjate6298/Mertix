import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, User, GraduationCap, Shield } from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Auth.css';

const demos = [
  ['Student', 'student@meritx.demo', 'Student@123'],
  ['Teacher', 'teacher@meritx.demo', 'Teacher@123'],
  ['Admin', 'admin@meritx.demo', 'Admin@123'],
  ['Super Admin', 'superadmin@meritx.demo', 'Super@123'],
];

export default function Auth({ register = false }) {
  const { login, googleLogin, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const googleBox = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [target, setTarget] = useState('JEE Main');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.registered ? 'Registration successful! Please sign in to your workspace.' : '');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || !googleBox.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBox.current) return;
      googleBox.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            const user = await googleLogin(credential, target);
            nav('/' + user.role);
          } catch (issue) {
            setError(issue.message);
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBox.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: register ? 'signup_with' : 'continue_with',
        width: 320,
      });
    };
    if (window.google?.accounts?.id) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleLogin, target, register, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (register) {
        await api('/auth/register', {
          method: 'POST',
          body: { name, email, password, target, role },
        });
        nav('/login', { state: { registered: true } });
      } else {
        const u = await login(email, password);
        nav('/' + u.role);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/">
          <Brand />
        </Link>
        <div className="auth-message">
          <div className="auth-kicker">THE MERITX EXPERIENCE</div>
          <h1>
            The next big
            <br />
            achievement
            <br />
            <span>starts with you.</span>
          </h1>
          <p>Prepare with purpose. Practice with confidence. Make every attempt count.</p>
          <div className="auth-highlight">
            <CheckCircle2 size={19} /> Realistic mock tests <CheckCircle2 size={19} /> Integrated student wallet
          </div>
        </div>
        <div className="auth-left-bottom">MERITX · LEARN. PRACTICE. RISE.</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/" className="auth-back">
            ← Back to website
          </Link>
          <span className="eyebrow">WELCOME TO MERITX</span>
          <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-sub">
            {register
              ? 'Join as a Student, Teacher, or Administrator.'
              : 'Enter your credentials to access your secure MERITX workspace.'}
          </p>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={submit}>
            {register && (
              <>
                <div className="field">
                  <label>I am registering as</label>
                  <div className="role-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      className={`btn ${role === 'student' ? 'btn-primary' : 'btn-soft'}`}
                      style={{ padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setRole('student')}
                    >
                      <User size={15} /> Student
                    </button>
                    <button
                      type="button"
                      className={`btn ${role === 'teacher' ? 'btn-primary' : 'btn-soft'}`}
                      style={{ padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setRole('teacher')}
                    >
                      <GraduationCap size={15} /> Teacher
                    </button>
                    <button
                      type="button"
                      className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-soft'}`}
                      style={{ padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setRole('admin')}
                    >
                      <Shield size={15} /> Admin
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </>
            )}

            <div className="field">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@example.com"
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <div className="password-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  minLength={register ? 8 : 1}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {register && role === 'student' && (
              <div className="field">
                <label>Target Examination</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option>JEE Main</option>
                  <option>JEE Advanced</option>
                  <option>NEET UG</option>
                  <option>MHT-CET</option>
                </select>
              </div>
            )}

            <button className="btn btn-primary auth-submit" disabled={loading || busy}>
              {busy ? (register ? 'Creating account...' : 'Signing in...') : register ? 'Create Account' : 'Sign In'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="auth-google-divider">
                <span>or</span>
              </div>
              <div className="auth-google-button" ref={googleBox} />
            </>
          )}

          <p className="switch-auth">
            {register ? 'Already have an account?' : 'New to Meritx?'}{' '}
            <Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link>
          </p>

          {!register && (
            <div className="demo-login">
              <div className="demo-head">
                <ShieldCheck size={17} />
                <div>
                  <strong>Explore demo accounts</strong>
                  <small>Click any account to fill credentials</small>
                </div>
              </div>
              <div className="demo-accounts">
                {demos.map(([roleLabel, e, p]) => (
                  <button
                    type="button"
                    key={roleLabel}
                    onClick={() => {
                      setEmail(e);
                      setPassword(p);
                      setError('');
                    }}
                  >
                    {roleLabel} <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
