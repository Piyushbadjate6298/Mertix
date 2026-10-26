import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  GraduationCap,
  LineChart,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../../components/Layouts";
import { api } from "../../lib/api";
import { ExamCard } from "./Exams";
import sliderUpsc from "../../assets/Images/Sliders/8-display.jpg";
import sliderNeet from "../../assets/Images/Sliders/9-display.jpg";
import "./Home.css";

const slides = [
  {
    image: sliderUpsc,
    alt: "UPSC CSE Parivartan Mentorship Programme for integrated prelims and mains preparation",
    href: "/exams",
  },
  {
    image: sliderNeet,
    alt: "NEET Biology Sprint for biology revision, NCERT concepts, and high-yield topics",
    href: "/exams/neet-biology-01",
  },
];

const features = [
  {
    icon: Target,
    title: "Exam-real practice",
    text: "Timed mock exams help you rehearse decisions, pacing, and focus.",
  },
  {
    icon: LineChart,
    title: "Clear performance review",
    text: "See accuracy, score, and answer explanations after each attempt.",
  },
  {
    icon: BrainCircuit,
    title: "Focused question bank",
    text: "Practice the existing JEE and NEET sample questions by subject.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent demo",
    text: "Securely stored practice data, with no real payments or false promises.",
  },
];

export default function Home() {
  const [active, setActive] = useState(0);
  const [exams, setExams] = useState([]);
  const [landing, setLanding] = useState(null);
  const touchStart = useRef(null);
  const change = (next) => setActive((next + slides.length) % slides.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    api('/exams').then((examData) => setExams(examData?.exams || [])).catch(() => {});
    api('/landing-content').then((contentData) => setLanding(contentData?.content?.about_courses || null)).catch(() => {});
  }, []);

  const slide = slides[active];
  return (
    <>
      <SiteHeader />
      <main className="home">
        <section
          className="banner-carousel"
          aria-roledescription="carousel"
          aria-label="Meritx subject highlights"
          aria-live="polite"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") change(active - 1);
            if (event.key === "ArrowRight") change(active + 1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const distance =
              event.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(distance) > 45)
              change(active + (distance < 0 ? 1 : -1));
          }}
          tabIndex="0"
        >
          <div className="banner-stage">
            <Link
              className="banner-link"
              to={slide.href}
              aria-label={`${slide.alt}. Open exam details.`}
              key={slide.image}
            >
              <img src={slide.image} alt={slide.alt} />
            </Link>
            <button
              className="banner-arrow banner-prev"
              type="button"
              onClick={() => change(active - 1)}
              aria-label="Previous slide"
            >
              <ArrowLeft />
            </button>
            <button
              className="banner-arrow banner-next"
              type="button"
              onClick={() => change(active + 1)}
              aria-label="Next slide"
            >
              <ArrowRight />
            </button>
            <div className="banner-dots" aria-label="Choose a slide">
              {slides.map((item, index) => (
                <button
                  type="button"
                  key={item.image}
                  className={index === active ? "active" : ""}
                  onClick={() => setActive(index)}
                  aria-label={`Show slide ${index + 1}`}
                  aria-current={index === active ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="category-strip" id="subjects" aria-label="Available subjects">
          <div className="container category-grid">
            {[
              [GraduationCap, "Physics"],
              [FlaskConical, "Chemistry"],
              [Trophy, "Mathematics"],
              [BookOpen, "Biology"],
            ].map(([Icon, label]) => (
              <Link to="/exams" key={label}>
                <span>
                  <Icon />
                </span>
                <div>
                  <small>EXPLORE</small>
                  <strong>{label}</strong>
                </div>
                <ArrowUpRight className="category-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section courses-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SUBJECT-BASED PRACTICE</span>
                <h2>Choose your next challenge</h2>
                <p>
                  Practice Physics, Chemistry, Mathematics, and Biology in the available Meritx exams.
                </p>
              </div>
              <Link className="section-link" to="/exams">
                Explore all exams <ArrowRight size={16} />
              </Link>
            </div>
            <div className="home-course-grid">
              {exams.slice(0, 4).map((exam) => <ExamCard key={exam.id} exam={exam} />)}
            </div>
          </div>
        </section>

        {landing?.visible !== false && <section className="home-section about-courses"><div className="container"><div className="panel"><span className="section-kicker">MERITX COURSES</span><h2>{landing?.heading || 'About Our Courses'}</h2><p>{landing?.description || 'Structured mock examinations for your target entrance test.'}</p><Link className="btn btn-primary" to="/exams">{landing?.buttonLabel || 'Explore examinations'} <ArrowRight size={16}/></Link></div></div></section>}

        <section className="home-section benefits-section" id="about">
          <div className="container">
            <div className="section-heading centered">
              <div>
                <span className="section-kicker">WHY MERITX</span>
                <h2>Everything important, nothing distracting.</h2>
                <p>
                  A straightforward learning experience shaped around practice
                  and reflection.
                </p>
              </div>
            </div>
            <div className="benefit-grid">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span>
                    <Icon />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="learning-band">
          <div className="container learning-band-grid">
            <div>
              <span className="section-kicker light">LEARN ANYWHERE</span>
              <h2>Your preparation space, always within reach.</h2>
              <p>
                Browse subjects, use demo accounts, attempt the existing sample
                exams, and review your progress across sessions.
              </p>
              <div className="band-checks">
                <span>
                  <CheckCircle2 /> Responsive on every screen
                </span>
                <span>
                  <CheckCircle2 /> Progress stored securely
                </span>
              </div>
              <Link className="btn btn-light" to="/register">
                Create your profile <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="device-art" aria-hidden="true">
              <div className="device-laptop">
                <div>
                  <span />
                  <span />
                  <span />
                </div>
                <main>
                  <aside />
                  <section>
                    <small>MERITX</small>
                    <strong>Learn. Practice. Rise.</strong>
                    <i />
                    <i />
                  </section>
                </main>
              </div>
              <div className="device-phone">
                <span />
                <main>
                  <b>84%</b>
                  <small>Accuracy</small>
                  <i />
                  <i />
                  <i />
                </main>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section faq-section" id="contact">
          <div className="container faq-grid">
            <div>
              <span className="section-kicker">GOOD TO KNOW</span>
              <h2>Built as a transparent learning demo.</h2>
              <p>
                Profiles and practice progress are stored in the configured
                MERITX database. Payments, live ranking, and payouts are not
                enabled.
              </p>
              <Link className="section-link" to="/login">
                Explore a demo account <ArrowRight size={16} />
              </Link>
            </div>
            <div className="faq-list">
              {[
                "How is my progress saved?",
                "Are payments or prizes active?",
                "Can I try the exam flow?",
              ].map((question, index) => (
                <details key={question} open={index === 0}>
                  <summary>
                    {question}
                    <ChevronDown />
                  </summary>
                  <p>
                    {index === 0
                      ? "Your account, registrations, attempts, and support requests are stored by the secure MERITX API."
                      : index === 1
                        ? "No. Any fee or prize information belongs to the original demo data and is clearly presented as illustrative."
                        : "Yes. Use the student demo account, register for an exam, and complete the sample test."}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
