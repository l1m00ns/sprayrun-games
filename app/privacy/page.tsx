import type { Metadata } from 'next';
import Legal from '@/components/Legal';

export const metadata: Metadata = { title: 'Privacy Policy - Reverse Surfers' };

export default function Privacy() {
  return (
    <Legal title="Privacy Policy">
      <h2>1. The short version</h2>
      <ul>
        <li>We collect only what the Game needs to work, to keep ranked fair and to keep you safe.</li>
        <li>No advertising, no selling of data, no tracking cookies. We keep lightweight product analytics (sessions, runs, performance) to fix bugs and balance the Game, and you can turn it off in Settings.</li>
        <li>You can download all your data and delete your account yourself, in Settings.</li>
      </ul>

      <h2>2. Who is responsible</h2>
      <p>The data controller is the Operator of the Game (see the Terms; contact through the Support tab in the Game). If you use a copy of the Game hosted by someone else, that host is the controller for that copy.</p>

      <h2>3. What we collect, why, and on what basis</h2>
      <table>
        <thead><tr><th>Data</th><th>Why</th><th>Basis</th></tr></thead>
        <tbody>
          <tr><td>Username, display name, password (stored only as a salted scrypt hash), guest identifier, language</td><td>Create and secure your account, show your name to others</td><td>Contract</td></tr>
          <tr><td>Game progress: coins, cosmetics, level, statistics, runs, scores, rating, match history</td><td>Run the Game, leaderboards, ranked matchmaking</td><td>Contract</td></tr>
          <tr><td>Friends, party invitations, private messages, blocks and reports</td><td>Social features and moderation</td><td>Contract / legitimate interest</td></tr>
          <tr><td>Support tickets, appeals and their messages</td><td>Answer you and review sanctions</td><td>Contract / legitimate interest</td></tr>
          <tr><td>Device and network signals: random device id, screen size, graphics card name, time zone, language, browser, a hash of your IP address and of its network (/24), the network operator and whether it is a VPN, proxy or datacenter</td><td>Detect cheating, duplicate accounts, ban evasion and VPN use in online play. Identifiers are stored as irreversible hashes</td><td>Legitimate interest (fair play and security)</td></tr>
          <tr><td>Technical data: connection time, ping, IP address handled by the server for rate limiting</td><td>Operate and protect the service</td><td>Legitimate interest</td></tr>
          <tr><td>Product analytics: a random session id, pages opened, runs and matches started/finished, map, mode, score, distance, device type, screen size, language, time zone, browser, IP address and frame-rate samples</td><td>Measure stability and performance, find bugs and balance difficulty. IP addresses are shown only on the private admin dashboard and are erased after 30 days</td><td>Legitimate interest (improving the Game); opt out in Settings &gt; Gameplay</td></tr>
        </tbody>
      </table>

      <h2>4. Who else receives data</h2>
      <ul>
        <li><b>Network check.</b> To tell whether a connection is a VPN or datacenter, the server sends your IP address to a lookup service (by default ip-api.com) and compares it with public lists. Offline play never does this.</li>
        <li><b>AI-assisted review.</b> Support messages, appeal texts and fair-play evidence (scores, speeds, counts: not your password) can be processed by AI model providers (OpenRouter and Token Harbor) to draft answers or to review cases. Humans keep the final say on bans, and the providers are asked not to train on the data.</li>
        <li><b>Hosting.</b> The service runs on a hosting provider chosen by the Operator (for example Render for the server and Vercel for the web files). They process data on our behalf.</li>
        <li><b>Other players</b> see your display name, rating, tier, badges and, in matches, your runner. Friends see whether you are online or in a match. Nobody sees your email (we do not collect one) or your IP address.</li>
        <li>We may disclose data if the law requires it or to protect people from serious harm.</li>
      </ul>

      <h2>5. Local storage on your device</h2>
      <p>The Game stores your save, settings, a session token and a random device id in your browser&apos;s local storage, and a random analytics session id in session storage (erased when the tab closes). These are strictly necessary for the Game to work; there are no advertising or tracking cookies. Clearing site data resets offline progress.</p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Account and progress: until you delete the account.</li>
        <li>Private messages: 90 days, or until either side deletes the account.</li>
        <li>Fair-play records of a sanctioned account (irreversible device hashes): kept after deletion for as long as needed to prevent ban evasion, then removed.</li>
        <li>Leaderboard and match rows: kept but anonymised (&quot;Deleted player&quot;) when you delete your account.</li>
        <li>Network lookups: cached for a few days.</li>
        <li>Product analytics: events and performance samples for 90 days; the IP address on a session is erased after 30 days. The opt-out stops all collection immediately.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>You can ask to access, correct, export, delete, restrict or object to the processing of your data, and to withdraw consent where we rely on it. Analytics can be switched off at any time in <b>Settings &gt; Gameplay &gt; Usage analytics</b>. Two buttons in <b>Settings &gt; Account</b> do it instantly: <b>Download my data</b> (a JSON file) and <b>Delete my account</b>. For anything else use the Support tab. You can also complain to your data protection authority.</p>

      <h2>8. Children</h2>
      <p>The Game is not for children under 13. If you are under the age of digital consent in your country, your parent or guardian must agree to this policy. Parents can ask for deletion at any time. We do not show ads and we do not collect email addresses or real names.</p>

      <h2>9. Security</h2>
      <p>Passwords are hashed with scrypt, sessions use signed tokens that can be revoked (&quot;sign out everywhere&quot;), traffic is encrypted when the Game is served over HTTPS, and the server rate-limits and validates requests. No system is perfectly secure: use a unique password and tell Support about any problem.</p>

      <h2>10. International transfers</h2>
      <p>Hosting and AI providers may be located outside your country. Where required we rely on the safeguards those providers offer (such as standard contractual clauses).</p>

      <h2>11. Changes</h2>
      <p>If this policy changes in a way that matters, the version date at the top changes and the Game asks you to read it again.</p>
    </Legal>
  );
}
