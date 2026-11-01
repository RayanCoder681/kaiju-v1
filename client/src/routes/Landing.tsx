import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../ui/Shell.js';
import { useI18n } from '../ui/I18nProvider.js';

function SignalArtwork({ english }: { english: boolean }) {
  return (
    <div className="signal-art" aria-label="Illustration d'une session Kaiju en direct" role="img">
      <div className="signal-art__grid" />
      <div className="signal-art__topline"><span><i /> {english ? 'LIVE SESSION' : 'SESSION EN DIRECT'}</span><span>FR · 00:42</span></div>
      <div className="signal-art__orbit signal-art__orbit--one" />
      <div className="signal-art__orbit signal-art__orbit--two" />
      <div className="signal-art__creature">
        <svg viewBox="0 0 300 260" fill="none" aria-hidden="true">
          <path d="M54 211 73 124l37 26 40-88 39 88 38-26 20 87H54Z" fill="currentColor" />
          <path d="m78 126 32 24 40-88 39 88 38-24-6 30-32 21-39-67-40 67-32-21-5-30Z" fill="#11170f" opacity=".72" />
          <circle cx="124" cy="174" r="7" fill="#f4f0e6" /><circle cx="178" cy="174" r="7" fill="#f4f0e6" />
          <path d="M132 198q19 13 38 0" stroke="#11170f" strokeWidth="5" strokeLinecap="round" />
          <path d="M43 215h214" stroke="currentColor" strokeWidth="2" opacity=".42" />
        </svg>
      </div>
      <div className="signal-art__caption"><span className="signal-art__number">01</span><span>{english ? <>ONE ROOM.<br />EVERY VOICE.</> : <>UNE SALLE.<br />TOUTES LES VOIX.</>}</span><span className="signal-art__pulse"><i /><i /><i /><i /><i /><i /><i /></span></div>
      <div className="signal-art__float signal-art__float--poll"><span className="signal-art__float-icon">↗</span><span>{english ? 'POLL' : 'SONDAGE'}<br /><b>{english ? 'It’s moving.' : 'Ça bouge.'}</b></span><span className="signal-art__float-dot" /></div>
      <div className="signal-art__float signal-art__float--people"><span className="signal-art__avatars"><i>J</i><i>M</i><i>A</i></span><span><b>28</b><small>{english ? 'in the room' : 'dans la salle'}</small></span></div>
    </div>
  );
}

export function Landing() {
  const { t, locale } = useI18n();
  const english = locale === 'en';
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) navigate(`/join?code=${encodeURIComponent(clean)}`);
  };

  return (
    <Shell>
      <div className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="eyebrow"><span className="eyebrow__line" />{english ? 'GIVE EVERYONE A VOICE' : 'LA PARTICIPATION PREND LA PAROLE'}</p>
            <h1>{english ? <>The room<br />is <em>yours.</em></> : <>La salle<br />est <em>à vous.</em></>}</h1>
            <p className="landing-intro">{english ? 'Quizzes, questions, ideas. Kaiju turns every phone into a voice in the room — live, with no fuss.' : 'Quiz, questions, idées. Kaiju transforme chaque téléphone en voix dans la salle — en direct, simplement.'}</p>
            <form onSubmit={onSubmit} className="join-panel">
              <label htmlFor="code" className="join-panel__label"><span className="join-panel__step">01</span>{t('join.enterCode')}</label>
              <div className="join-panel__controls">
                <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="EX. 739 421" autoComplete="off" maxLength={12} />
                <button type="submit" aria-label={t('common.join')}><span>{t('common.join')}</span><b aria-hidden="true">↗</b></button>
              </div>
              <p className="join-panel__hint"><span className="join-panel__lock" aria-hidden="true">⌑</span>{english ? 'No account. No app. Just the code.' : 'Pas de compte. Pas d’application. Juste le code.'}</p>
            </form>
            <div className="host-cta"><span>{english ? 'Hosting a session?' : 'Vous animez la séance ?'}</span><Link to="/host">{english ? 'Open the control room' : 'Ouvrir la régie'} <span aria-hidden="true">→</span></Link></div>
          </div>
          <SignalArtwork english={english} />
          <div className="landing-index"><span>01 / 03</span><span>{english ? 'MADE FOR SHARED MOMENTS' : 'FAIT POUR LES MOMENTS ENSEMBLE'}</span><span>{english ? 'SCROLL TO EXPLORE ↓' : 'SCROLL POUR DÉCOUVRIR ↓'}</span></div>
        </section>

        <section className="landing-flow" aria-label={english ? 'How it works' : 'Comment ça marche'}>
          <div className="landing-flow__heading"><p className="eyebrow"><span className="eyebrow__line" />{english ? 'THREE STEPS, THAT’S IT' : 'TROIS GESTES, ET C’EST PARTI'}</p><p>{english ? <>Technology steps aside.<br /><em>Conversation takes over.</em></> : <>La technologie s’efface.<br /><em>La conversation commence.</em></>}</p></div>
          <div className="flow-steps">
            <article><span className="flow-steps__num">01</span><span className="flow-steps__icon">⌁</span><h2>{english ? 'Join in' : 'On se connecte'}</h2><p>{english ? 'Scan a QR code or enter a short code. Join right from your phone.' : 'Un QR code ou un code court. Chacun rejoint depuis son téléphone.'}</p></article>
            <article><span className="flow-steps__num">02</span><span className="flow-steps__icon">✳</span><h2>{english ? 'Take part' : 'On participe'}</h2><p>{english ? 'A quiz, a vote or a question: everyone gets a say.' : 'Un quiz, un vote ou une question : tout le monde a sa place.'}</p></article>
            <article><span className="flow-steps__num">03</span><span className="flow-steps__icon">↗</span><h2>{english ? 'Move forward' : 'On fait avancer'}</h2><p>{english ? 'Answers appear live. Ideas turn into conversation.' : 'Les réponses apparaissent en direct. Les échanges prennent forme.'}</p></article>
          </div>
        </section>
        <footer className="landing-footer"><Link to="/" className="landing-footer__brand">KAIJU<span>®</span></Link><span>{english ? 'MADE TO LEARN, SHARE, LISTEN.' : 'FAIT POUR APPRENDRE, PARTAGER, S’ÉCOUTER.'}</span><Link to="/host">{english ? 'HOST SPACE' : 'ESPACE ORGANISATEUR'} ↗</Link></footer>
      </div>
    </Shell>
  );
}
