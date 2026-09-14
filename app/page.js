"use client";

import { useState } from "react";

const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4L19 6.5" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /></svg>;

const questions = [
  ["Is BoloMasti free?", "Yes. You can discover, match and chat on BoloMasti for free. Optional extras are always clearly labelled."],
  ["How do you keep conversations safe?", "We combine active moderation, easy reporting tools, verified profiles and community guidelines that put respect first."],
  ["Can I choose who I talk to?", "Absolutely. Set your interests and preferences, then jump into conversations that feel right for you. Leave any chat instantly."],
  ["Where is BoloMasti available?", "BoloMasti is available anywhere you have an internet connection. Our mobile apps are launching soon."],
];

export default function Home() {
  const [open, setOpen] = useState(null);
  const [menu, setMenu] = useState(false);
  return <main>
    <nav className="nav">
      <a className="logo" href="#home"><span>bolo</span>masti<span className="dot">.</span></a>
      <div className={menu ? "navlinks open" : "navlinks"}>
        <a href="#how">How it works</a><a href="#safety">Safety</a><a href="#stories">Stories</a>
        <a className="nav-cta" href="/connect">Start chatting <Arrow /></a>
      </div>
      <button className="menu" aria-label="Toggle menu" onClick={() => setMenu(!menu)}><i></i><i></i></button>
    </nav>

    <section className="hero" id="home">
      <div className="hero-copy">
        <p className="eyebrow"><Spark /> A little hello can change your day</p>
        <h1>Meet new people.<br /><em>Feel more you.</em></h1>
        <p className="hero-text">Real conversations with people who get your vibe. No pressure, no pretending — just good masti.</p>
        <div className="hero-actions"><a href="/connect" className="button">Start chatting <Arrow /></a><a href="#how" className="text-link">See how it works <span>↓</span></a></div>
        <div className="faces"><div className="avatars"><b>NK</b><b>SP</b><b>RM</b><b>AK</b></div><p><strong>50,000+</strong><br />people are talking today</p></div>
      </div>
      <div className="hero-art" aria-label="Illustration of a happy video chat">
        <div className="sun"></div><div className="squiggle squiggle-one">✦</div><div className="squiggle squiggle-two">⌇</div>
        <div className="phone"><div className="phone-top"><span></span><small>8:41</small><span>•••</span></div><div className="person"><div className="hair"></div><div className="face"><i></i><i></i><b></b></div><div className="shirt"></div></div><div className="callbar"><span>⌁</span><span>◉</span><span className="hang">⌕</span></div></div>
        <div className="bubble bubble-1">You seem fun! ✨</div><div className="bubble bubble-2">Hey, I&apos;m Aanya <span>😊</span></div>
      </div>
    </section>

    <section className="ticker"><span>Talk freely</span><i>✦</i><span>Make friends</span><i>✦</i><span>Share a laugh</span><i>✦</i><span>Be yourself</span><i>✦</i><span>Talk freely</span></section>

    <section className="intro" id="how"><p className="eyebrow coral">CONVERSATIONS, NOT CONNECTIONS</p><h2>Less swiping.<br /><em>More spark.</em></h2><p>BoloMasti makes it easy to move from “hi” to a genuine moment — with people who want the same thing.</p></section>

    <section className="steps">
      <article className="step yellow"><span>01</span><div className="icon-wrap">☻</div><h3>Show your vibe</h3><p>Pick what you’re into. Music, movies, midnight chai — it all counts.</p></article>
      <article className="step purple"><span>02</span><div className="icon-wrap">⌁</div><h3>Find your people</h3><p>We’ll introduce you to someone who shares your energy.</p></article>
      <article className="step green"><span>03</span><div className="icon-wrap">✳</div><h3>Let the masti begin</h3><p>Text, voice or video chat. Stay as long as the conversation flows.</p></article>
    </section>

    <section className="safety" id="safety"><div className="safety-art"><div className="shield">♥</div><div className="safety-card">Your comfort<br />comes first <Check /></div><span className="star">✦</span></div><div className="safety-copy"><p className="eyebrow coral">YOUR SPACE, YOUR RULES</p><h2>Good vibes<br /><em>only.</em></h2><p>We built BoloMasti to feel like the internet should: warm, welcoming and in your control.</p><ul><li><Check />Report or leave a chat anytime</li><li><Check />Real people, actively moderated</li><li><Check />Your privacy stays yours</li></ul><a className="text-link" href="#faq">Read our safety promise <Arrow /></a></div></section>

    <section className="stories" id="stories"><div className="story-head"><div><p className="eyebrow coral">THE WORD ON THE STREET</p><h2>Made for <em>real</em><br />moments.</h2></div><div className="arrows"><button>←</button><button>→</button></div></div><div className="quote-grid"><article><div className="quote-mark">“</div><p>It’s like bumping into a friend of a friend — except they’re exactly your kind of weird.</p><footer><b>Rhea M.</b><span>Delhi</span></footer></article><article className="featured"><div className="quote-mark">“</div><p>I joined for five minutes and ended up talking to someone about old Bollywood songs for two hours.</p><footer><b>Arjun K.</b><span>Mumbai</span></footer></article><article><div className="quote-mark">“</div><p>Finally, an app where I don’t feel like I have to be ‘on’ all the time.</p><footer><b>Meera S.</b><span>Bengaluru</span></footer></article></div></section>

    <section className="faq" id="faq"><p className="eyebrow coral">CURIOUS? WE GOT YOU.</p><h2>Questions, <em>answered.</em></h2><div className="faq-list">{questions.map(([q,a],i)=><div className={open===i?"faq-item active":"faq-item"} key={q}><button onClick={()=>setOpen(open===i?null:i)}>{q}<span>{open===i?"−":"+"}</span></button>{open===i&&<p>{a}</p>}</div>)}</div></section>

    <section className="join" id="join"><span className="float flower">✿</span><span className="float smile">☻</span><p className="eyebrow">YOUR NEXT GOOD CONVERSATION IS WAITING</p><h2>Come as you are.<br /><em>Stay for the masti.</em></h2><a className="button light" href="/connect">Join BoloMasti <Arrow /></a><p className="fine">By joining, you agree to lead with kindness. Always.</p></section>
    <footer className="footer"><a className="logo" href="#home"><span>bolo</span>masti<span className="dot">.</span></a><p>Made with a little bit of masti in India ✦</p><div><a href="#safety">Safety</a><a href="#faq">FAQ</a><a href="mailto:hello@bolomasti.in">Contact</a></div></footer>
  </main>;
}
