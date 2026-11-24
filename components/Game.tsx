'use client';

import { useEffect } from 'react';
import GameUI from './GameUI';

// The Three.js engine is plain ES modules that bind to the ids rendered by <GameUI/>.
// It is imported only in the browser, after React has committed the markup.
export default function Game() {
  useEffect(() => {
    void import('../src/main.js');
  }, []);

  return (
    <>
      <canvas id="c" tabIndex={0} className="fixed inset-0 block h-full w-full touch-none outline-none" />
      <div id="ui" className="pointer-events-none fixed inset-0 font-body text-white select-none">
        <GameUI />
      </div>
    </>
  );
}
