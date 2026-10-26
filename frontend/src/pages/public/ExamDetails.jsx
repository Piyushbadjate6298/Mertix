import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CalendarDays, Clock3, Users, Trophy, Check, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { SiteHeader, SiteFooter, Loading } from '../../components/Layouts';
import { api, money, friendlyDate } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded. Check your connection and try again.'));
    document.head.appendChild(script);
  });
  return checkoutPromise;
}

export default function ExamDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, token } = useAuth();
  const [exam, setExam] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    Promise.all([api('/exams'), api('/payments/configuration')])
      .then(([examData, config]) => {
        setExam(examData.exams.find((item) => item.id === id) || null);
        setPaymentConfig(config);
      })
      .catch((issue) => setError(issue.message));
  }, [id]);

  async function enroll() {
    if (!user) { nav('/login'); return; }
    if (user.role !== 'student') { setError('Please use a student account to register.'); return; }
    setBusy(true);
    setError('');
    try {
      if (!exam.fee) {
        await api('/exams/register', { method: 'POST', token, body: { examId: id } });
        setConfirmed(true);
        return;
      }
      if (!paymentConfig?.configured) throw new Error('Razorpay Test Mode is not configured. Please contact the administrator.');
      const orderData = await api('/payments/orders', { method: 'POST', token, body: { examId: id } });
      if (orderData.free) { setConfirmed(true); return; }
      await loadRazorpayCheckout();
      let completed = false;
      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'LGW MeritX',
        description: `${orderData.exam.name} · ${String(orderData.mode).toUpperCase()} MODE`,
        order_id: orderData.order.id,
        prefill: { name: user.name, email: user.email },
        theme: { color: '#2447c6' },
        retry: { enabled: true, max_count: 3 },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            if (!completed) setError('Payment was cancelled. Your course is still selected; you can retry when ready.');
            setBusy(false);
          },
        },
        handler: async (response) => {
          try {
            const result = await api('/payments/verify', {
              method: 'POST', token,
              body: {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
            completed = true;
            setReceipt(result);
            setConfirmed(true);
            setError('');
          } catch (issue) {
            setError(issue.message);
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on('payment.failed', async (response) => {
        const reason = response.error?.description || 'Payment failed. Please retry.';
        await api('/payments/failure', { method: 'POST', token, body: { razorpayOrderId: orderData.order.id, reason } }).catch(() => {});
        setError(reason);
        setBusy(false);
      });
      checkout.open();
    } catch (issue) {
      if (issue.message === 'Already registered') setConfirmed(true);
      else setError(issue.message);
      setBusy(false);
    }
  }

  const config = exam?.configuration || {};
  const ruleSummary = Object.entries(config.rules || {}).filter(([key]) => key !== 'subjectOverrides').map(([type, rule]) => `${type.replaceAll('_', ' ')}: +${rule.correct} correct${rule.incorrect ? `, ${rule.incorrect} incorrect` : ', no negative mark'}`).join(' · ');
  const overview = exam ? [['Syllabus', exam.syllabus], ['Subjects', exam.subject], ['Questions', exam.questions], ['Maximum marks', exam.marks], ['Duration', `${exam.duration} minutes`], ['Pattern version', exam.patternVersion ? `Version ${exam.patternVersion}` : 'Legacy practice'], ['Marking', ruleSummary || 'Shown in candidate instructions'], ['Access', exam.fee ? `Paid · ${money(exam.fee)}` : 'Free']] : [];
  const rules = config.instructions || ['Register before starting the mock examination.', 'Answers are securely saved while the attempt is active.', 'The countdown begins only after instruction acceptance.', 'Once submitted, responses cannot be changed.'];

  return <><SiteHeader/><div className="exams-page"><div className="container"><Link to="/exams" className="back-link"><ArrowLeft size={16}/> All Exams</Link>{!exam ? <Loading/> : <div className="details-grid"><div><span className="tag">{exam.type}</span><h1 className="details-title">{exam.title}</h1><p className="section-sub">{exam.description}</p><div className="panel" style={{ marginTop: 28 }}><h3>Examination overview</h3><div className="details-facts">{overview.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{exam.importMode === 'compatible_practice' && <div className="alert">Compatible practice set: the source workbook is preserved without claiming unsupported official question types.</div>}</div><div className="panel" style={{ marginTop: 19 }}><h3>Exam rules & fairness</h3>{rules.map((rule) => <p key={rule} style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: 12, color: '#657b9a' }}><Check size={16} color="#1bc6a5"/>{rule}</p>)}</div></div><aside className="panel details-side"><span className="eyebrow">EXAM AT A GLANCE</span><div className="details-meta"><CalendarDays size={18}/><span>{friendlyDate(exam.date)} · {exam.time}</span></div><div className="details-meta"><Clock3 size={18}/><span>{exam.duration} minutes</span></div><div className="details-meta"><Users size={18}/><span>{exam.registered.toLocaleString('en-IN')} registered</span></div><div className="details-meta"><Trophy size={18}/><span>{exam.marks} maximum marks</span></div><div className="hr"/><small className="muted">REGISTRATION</small><h2 style={{ fontSize: 32, margin: '7px 0' }}>{exam.fee ? money(exam.fee) : 'FREE'}</h2>{exam.fee > 0 && paymentConfig && !paymentConfig.configured && <div className="alert error">Razorpay Test Mode keys are not configured, so payment initiation is disabled.</div>}{receipt ? <div className="payment-success" role="status"><h3>Payment Successful</h3><dl><div><dt>Student</dt><dd>{receipt.studentName}</dd></div><div><dt>Course</dt><dd>{receipt.courseName}</dd></div><div><dt>Amount paid</dt><dd>{money(receipt.payment.amount)}</dd></div><div><dt>Payment ID</dt><dd>{receipt.payment.paymentId}</dd></div><div><dt>Order ID</dt><dd>{receipt.payment.orderId}</dd></div><div><dt>Payment date</dt><dd>{new Date(receipt.payment.date).toLocaleString('en-IN')}</dd></div><div><dt>Enrollment</dt><dd>{receipt.enrollmentConfirmed ? 'Confirmed' : 'Pending'}</dd></div></dl><button className="btn btn-primary" style={{ width: '100%' }} onClick={() => nav('/student')}>Go to My Courses <ArrowRight size={16}/></button></div> : <><label style={{ display: 'flex', gap: 9, alignItems: 'start', fontSize: 12, color: '#64758e', margin: '20px 0' }}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/> I agree to the examination rules and understand that submission is final.</label>{error && <div className="alert error">{error}</div>}{confirmed ? <><div className="alert success">Registration confirmed.</div><button className="btn btn-primary" style={{ width: '100%' }} onClick={() => nav(`/take/${id}`)}>Start Learning / Open Instructions <ArrowRight size={16}/></button></> : <button disabled={!accepted || busy || (exam.fee > 0 && paymentConfig?.configured === false)} className="btn btn-primary" style={{ width: '100%' }} onClick={enroll}>{busy ? 'Please wait…' : exam.fee > 0 ? error ? 'Retry Payment' : 'Pay Now' : 'Register for exam'} <ArrowRight size={16}/></button>}</>}<p style={{ fontSize: 10, textAlign: 'center', color: '#9badc0', marginTop: 15 }}><ShieldCheck size={12} style={{ verticalAlign: 'middle' }}/> Server-verified registration and payment</p></aside></div>}</div></div><SiteFooter/></>;
}
