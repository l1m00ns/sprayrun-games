import type { Metadata } from 'next';
import Legal from '@/components/Legal';

export const metadata: Metadata = { title: 'Terms of Service - Reverse Surfers' };

export default function Terms() {
  return (
    <Legal title="Terms of Service">
      <h2>1. Who we are and what this covers</h2>
      <p>Reverse Surfers (the &quot;Game&quot;) is a free-to-play 3D endless runner with optional online features: accounts, ranked and normal matches, parties, friends, private messages, leaderboards, tournaments and support. It is operated by the Reverse Surfers team (the &quot;Operator&quot;). The Operator&apos;s legal name, address and contact details must be entered by whoever hosts the Game and are available from the in-game Support tab.</p>
      <p>By creating an account or using the online features you accept these Terms and the <a href="/privacy">Privacy Policy</a>. You can play the offline modes without an account.</p>

      <h2>2. Who can play</h2>
      <ul>
        <li>You must be at least 13 years old. If you are under the age of digital consent where you live (13 to 16 depending on the country), a parent or guardian must agree to these Terms for you.</li>
        <li>Parents: you can ask for your child&apos;s data to be exported or deleted at any time, from Settings or through Support.</li>
      </ul>

      <h2>3. Your account</h2>
      <ul>
        <li>Keep your password private. You are responsible for what happens on your account. Tell Support if you think it was accessed by someone else.</li>
        <li>One person, one account. Using several accounts to gain an advantage, to avoid a sanction or to manipulate rankings is not allowed.</li>
        <li>Usernames and display names must not be offensive, impersonate someone, or advertise. We can change or remove names that break this rule.</li>
        <li>You can delete your account whenever you want in Settings. Deleting is permanent.</li>
      </ul>

      <h2>4. Fair play</h2>
      <p>The Game is meant to be played as intended. The following are forbidden: cheating tools, automation or bots in online modes, modifying or injecting into the client, exploiting bugs on purpose (report them instead), tampering with scores, network manipulation, boosting or throwing matches, and avoiding a sanction.</p>
      <ul>
        <li><b>How we check.</b> The server validates scores, speed and movement, looks at the network type (VPN, proxy or datacenter connections are not allowed online) and links accounts that share a device. Some decisions are assisted by automated and AI reviewers; they never ban on their own.</li>
        <li><b>Sanctions.</b> Warning, temporary removal from online play, or a ban, depending on the evidence and on repeat behaviour. Cheats from the Secret Menu make a session a practice session: nothing is saved or ranked.</li>
        <li><b>Appeals.</b> You can contest a sanction up to three times from the Support tab, with an AI review (usually under 15 minutes) or a human review (1 to 7 days). Appeals are free.</li>
      </ul>

      <h2>5. Conduct and messages</h2>
      <ul>
        <li>Be respectful. No harassment, hate, threats, sexual content, spam, scams or sharing of personal information of others.</li>
        <li>Private messages are only possible between friends. You can block and report anyone from the conversation. A report sends the reported message and the few before it to a moderator.</li>
        <li>We filter some words automatically and may restrict messaging for accounts that abuse it.</li>
      </ul>

      <h2>6. Virtual items, coins and tournaments</h2>
      <ul>
        <li>Coins and cosmetics are virtual items with no cash value. They are earned by playing and cannot be bought with real money or transferred or sold.</li>
        <li>Some cosmetics are exclusive rewards for tournaments or events. They are granted automatically when the tournament ends and cannot be bought.</li>
        <li>Prices, rewards, rankings, schedules and features can change. A sanctioned account can lose items that were obtained unfairly.</li>
        <li>Tournaments and rankings are decided by the server. In case of a technical problem the Operator may cancel or repeat a match or a tournament.</li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>The Game, its code, characters, music and artwork belong to the Operator or its licensors. The Game is an original work and is not affiliated with any other endless-runner game. You get a personal, non-exclusive, non-transferable licence to play it. You may not copy, sell, reverse engineer for cheating purposes or host your own public copy using our name or logo. Source code published on GitHub is covered by the licence in that repository.</p>

      <h2>8. Availability and changes</h2>
      <p>The Game is provided &quot;as is&quot;. Online services can be unavailable, restarted or reset (especially on free hosting). We may change or end features, and we will try to give notice of major changes. If the online service is permanently closed, offline modes keep working.</p>

      <h2>9. Liability</h2>
      <p>To the extent the law allows, the Operator is not liable for indirect losses, lost progress or interruptions. Nothing in these Terms limits rights you have by law as a consumer, nor liability that cannot be excluded.</p>

      <h2>10. Ending your access</h2>
      <p>You can stop playing and delete your account at any time. We can suspend or end access for breaking these Terms or the law, after a warning when appropriate.</p>

      <h2>11. Changes to these Terms</h2>
      <p>When the Terms change in a way that matters, the version date at the top changes and the Game asks you to read the new version. Continuing to use online features after that means you accept it.</p>

      <h2>12. Law and contact</h2>
      <p>These Terms are governed by the law of the country where the Operator is established, without removing the mandatory consumer protections of the country where you live. Questions, complaints and requests: Support tab in the Game.</p>
    </Legal>
  );
}
