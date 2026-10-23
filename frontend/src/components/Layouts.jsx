import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  BarChart3,
  Trophy,
  Wallet,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  Home,
  BookOpen,
  Users,
  Settings,
  ShieldCheck,
  CreditCard,
  Bell,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import Brand from "./Brand";
import { useAuth } from "../context/AuthContext";
import "./Layouts.css";
export const routes = {
  student: [
    ["/student", "Overview", LayoutDashboard],
    ["/exams", "Explore Exams", ClipboardList],
    ["/student/results", "My Results", BarChart3],
    ["/student/rewards", "Rewards & Wallet", Wallet],
    ["/student/support", "Support", LifeBuoy],
  ],
  teacher: [
    ["/teacher", "Dashboard", LayoutDashboard],
    ["/teacher/import", "Import Question Bank", BookOpen],
    ["/teacher/questions", "Question Bank", BookOpen],
    ["/teacher/papers", "My Papers", ClipboardList],
  ],
  admin: [
    ["/admin", "Dashboard", LayoutDashboard],
    ["/admin/exams", "Exam Management", ClipboardList],
    ["/admin/students", "Students", Users],
    ["/admin/papers", "Paper Reviews", BookOpen],
    ["/admin/question-banks", "Question Bank Reviews", BookOpen],
    ["/admin/import", "Import Question Bank", BookOpen],
    ["/admin/courses", "Courses", GraduationCap],
    ["/admin/configuration", "Platform Configuration", Settings],
    ["/admin/support", "Support Tickets", LifeBuoy],
  ],
  superadmin: [
    ["/superadmin", "Finance Overview", LayoutDashboard],
    ["/superadmin/payments", "Transactions", CreditCard],
    ["/superadmin/audit", "Audit Log", ShieldCheck],
    ["/admin/exams", "Exam Operations", ClipboardList],
  ],
};
export function SiteHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" onClick={close}>
          <Brand />
        </Link>
        <nav
          className={open ? "nav-links expanded" : "nav-links"}
          aria-label="Primary navigation"
        >
          <Link onClick={close} to="/">
            Home
          </Link>
          <a onClick={close} href="/#subjects" aria-label="Browse subjects">
            Subjects
          </a>
          <a onClick={close} href="/#about">
            About Us
          </a>
          <a onClick={close} href="/#contact">
            Contact Us
          </a>
        </nav>
        <div className="header-actions">
          {user ? (
            <Link className="btn btn-primary small" to={"/" + user.role}>
              Dashboard <ArrowUpRight size={15} />
            </Link>
          ) : (
            <>
              <Link className="subtle-link" to="/login">
                Log In
              </Link>
              <Link className="btn btn-primary small" to="/register">
                Start Learning <ArrowUpRight size={15} />
              </Link>
            </>
          )}
          <button
            className="mobile-trigger"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              A focused JEE and NEET practice experience, designed to make every
              attempt useful.
            </p>
          </div>
          <div className="footer-links">
            <a href="/#subjects">Subjects</a>
            <a href="/#about">About Us</a>
            <a href="/#contact">Contact</a>
            <Link to="/login">Demo Login</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Meritx. Learn. Practice. Rise.</span>
          <span>
            Frontend demonstration · Not affiliated with NTA or IITs · No
            real-money payments
          </span>
        </div>
      </div>
    </footer>
  );
}
export function Shell({ children, title, kicker, description, action }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobile, setMobile] = useState(false);
  const links = routes[user?.role] || routes.student;
  return (
    <div className="app-shell">
      <aside className={"app-sidebar " + (mobile ? "show" : "")}>
        <Link to="/" className="sidebar-brand">
          <Brand />
        </Link>
        <div className="sidebar-label">
          {user?.role === "superadmin"
            ? "FINANCE CONSOLE"
            : (user?.role || "student").toUpperCase() + " PORTAL"}
        </div>
        <div className="side-nav">
          {links.map(([href, name, Icon]) => (
            <NavLink
              key={href}
              to={href}
              end
              className={({ isActive }) =>
                "side-link " + (isActive ? "active" : "")
              }
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              {name}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon">
              <GraduationCap size={20} />
            </span>
            <strong>Keep rising.</strong>
            <p>Every mock brings you one step closer.</p>
          </div>
          <button
            className="side-link logout"
            onClick={() => {
              logout();
              nav("/");
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-shade" onClick={() => setMobile(false)} />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <button
            className="mobile-trigger"
            aria-label="Open workspace navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="crumb">
            <Link to="/">Meritx</Link>
            <ChevronRight size={14} />
            <span>{user?.role === "superadmin" ? "Finance" : user?.role}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span /> Browser-local demo
            </span>
            <div className="avatar">{user?.name?.charAt(0) || "M"}</div>
            <div className="top-user">
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </div>
          </div>
        </header>
        <main className="app-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{kicker || "YOUR WORKSPACE"}</span>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
export function Stat({ icon: Icon, label, value, delta, tone = "blue" }) {
  return (
    <div className="stat-card">
      <div className={"stat-symbol " + tone}>
        <Icon size={21} />
      </div>
      <span className="muted-label">{label}</span>
      <strong>{value}</strong>
      {delta && <span className="stat-delta">{delta}</span>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      Loading your workspace...
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Items will appear here as you use the platform.",
}) {
  return (
    <div className="empty-state">
      <BookOpen size={33} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
