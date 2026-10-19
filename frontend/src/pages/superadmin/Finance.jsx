import React from 'react';
import { Wallet, Users, Receipt, ShieldCheck, CreditCard } from 'lucide-react';
import { Shell, Stat, Empty, Loading } from '../../components/Layouts';
import { useOverview } from '../admin/Admin';
import { money } from '../../lib/api';
import './Finance.css';

export function FinanceDashboard() {
  const { data } = useOverview(); const payments = data?.payments || [];
  return <Shell title="Financial command center" kicker="SUPER ADMIN / FINANCE" description="An executive view of browser-local demo records.">{!data ? <Loading/> : <><div className="finance-notice"><ShieldCheck size={20}/><div><strong>Simulation mode is active</strong><p>Figures represent demo registrations only. No real payment, revenue, prize, wallet credit, or withdrawal has occurred.</p></div></div><div className="grid-4"><Stat icon={Receipt} label="Simulated Collection" value={money(data.gross)} delta="Not actual revenue"/><Stat icon={CreditCard} label="Demo Transactions" value={payments.length} tone="cyan" delta="All simulated"/><Stat icon={Wallet} label="Actual Wallet Liability" value="₹0" tone="purple" delta="Wallet disabled"/><Stat icon={Users} label="Student Accounts" value={data.students} tone="green" delta="Browser-local profiles"/></div><div className="grid-2" style={{ marginTop: 22 }}><div className="panel"><div className="panel-head"><h3>Illustrative allocation (60 / 40)</h3><span className="tag">Non-binding model</span></div><div className="allocation-bar"><div style={{ width: '60%' }}/><span/></div><div className="allocation-legends"><div><span className="legend-dot blue"/>Reward allocation (hypothetical)<strong>{money(data.gross * .6)}</strong></div><div><span className="legend-dot cyan"/>Platform allocation (hypothetical)<strong>{money(data.gross * .4)}</strong></div></div><p className="fine-print">These allocations are only a product concept. No prizes will be paid.</p></div><div className="panel"><h3>Production readiness checklist</h3>{['Legal review of paid-entry and prize structure', 'Verified payment provider integration', 'Secure financial ledger and payout KYC', 'Fraud and identity verification'].map((text) => <div key={text} className="finance-check"><span>!</span>{text}</div>)}</div></div></>}</Shell>;
}

export function Transactions() {
  const { data } = useOverview();
  return <Shell title="Demo transactions" kicker="PAYMENT MONITORING" description="Browser-local demo registration records only.">{!data ? <Loading/> : <div className="panel">{data.payments.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction ID</th><th>Exam</th><th>Amount</th><th>Status</th><th>Recorded</th></tr></thead><tbody>{[...data.payments].reverse().map((payment) => <tr key={payment.id}><td>{payment.id}</td><td>{payment.examId}</td><td>{money(payment.amount)}</td><td><span className="tag green">{payment.status}</span></td><td>{new Date(payment.date).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div> : <Empty title="No transactions yet" text="Student registrations create simulated local records here."/>}</div>}</Shell>;
}

export function Audit() {
  const { data } = useOverview();
  return <Shell title="Activity & audit log" kicker="TRANSPARENCY" description="Browser-local administrative and student actions.">{!data ? <Loading/> : <div className="panel">{data.audit.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Action</th><th>Actor ID</th><th>Detail</th><th>Date / Time</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{entry.action}</td><td>{entry.actor}</td><td>{entry.detail}</td><td>{new Date(entry.date).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div> : <Empty title="No logged events yet"/>}</div>}</Shell>;
}
