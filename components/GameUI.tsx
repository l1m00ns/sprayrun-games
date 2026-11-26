// Game UI shell. Markup ported from the original HTML UI; ids are the contract with the engine (src/main.js).
export default function GameUI() {
  return (
    <>
      <canvas id="c" tabIndex={0}></canvas>
      <div id="ui">
        <div id="loading" className="screen">
          <div className="load-scene" aria-hidden="true"><i></i><i></i><i></i></div>
          <div className="box">
            <img className="load-logo" src="/logo.png" alt="Reverse Surfers" />
            <p className="load-tag">RUN - DODGE - OWN THE RAILS</p>
            <div className="load-track" aria-hidden="true">
              <span className="load-rail a"></span><span className="load-rail b"></span><span className="load-ties"></span>
              <i id="loadBar"></i>
              <b className="load-car"><u></u><u></u></b>
            </div>
            <div className="load-row"><span id="loadTxt">Loading fonts…</span><span id="loadPct">0%</span></div>
            <p id="loadTip" className="tip"></p>
            <div className="load-foot"><span id="loadGpu">AUTO</span><span id="loadVer"></span></div>
          </div>
        </div>

        <div id="topbar" className="hidden">
          <button className="tb-logo" id="tbLogo" aria-label="Home"><img src="/logo.png" alt="Reverse Surfers" /></button>
          <nav id="tbTabs">
            <button className="tb-tab sel" data-tab="play"><span className="tb-ic" data-ic="home" data-duo="" data-s="22"></span><span className="tb-lbl">PLAY</span></button>
            <button className="tb-tab" data-tab="shop"><span className="tb-ic" data-ic="shop" data-duo="" data-s="22"></span><span className="tb-lbl">SHOP</span></button>
            <button className="tb-tab" data-tab="career"><span className="tb-ic" data-ic="career" data-duo="" data-s="22"></span><span className="tb-lbl">CAREER</span></button>
            <button className="tb-tab" data-tab="leaderboard"><span className="tb-ic" data-ic="ranking" data-duo="" data-s="22"></span><span className="tb-lbl">LEADERBOARD</span></button>
            <button className="tb-tab" data-tab="events"><span className="tb-ic" data-ic="events" data-duo="" data-s="22"></span><span className="tb-lbl">EVENTS</span><i className="tb-badge" id="tbEvBadge"></i></button>
            <button className="tb-tab" data-tab="updates"><span className="tb-ic" data-ic="updates" data-duo="" data-s="22"></span><span className="tb-lbl">UPDATES</span><i className="tb-badge" id="tbUpBadge"></i></button>
            <button className="tb-tab" data-tab="support"><span className="tb-ic" data-ic="support" data-duo="" data-s="22"></span><span className="tb-lbl">SUPPORT</span></button>
          </nav>
          <button id="tbMenu" className="btn round sm tb-menu" aria-label="Open menu" aria-expanded="false"><span className="tb-bars"><i></i><i></i><i></i></span></button>
          <div id="tbDrawer" className="hidden" aria-hidden="true"></div>
          <div className="tb-right">
            <span className="pill online" id="mOnline"><span className="dotlive off"></span>Offline</span>
            <div className="pill tb-coins"><span className="coin-i"></span><span id="mCoins">0</span></div>
            <button className="tb-level" id="tbLevel" title="Career"><b id="tbLv">LV 1</b><span className="tb-xp"><i id="tbXp"></i></span></button>
            <button className="tb-acct" id="tbAcct"><span className="tb-avatar" id="tbAvatar">?</span><b id="tbName">Sign in</b></button>
            <button className="btn round sm" id="tbFriends" title="Friends"><span data-ic="users" data-s="22"></span><i className="tb-badge" id="tbFrBadge"></i></button>
            <button className="btn round sm" id="tbLang" title="Language"><img id="tbLangFlag" className="flag-btn" src="/flags/gb.svg" alt="" /><b id="tbLangCode">EN</b></button>
            <button className="btn round sm" id="btnSettings" title="Settings"><span data-ic="settings" data-s="22"></span></button>
          </div>
        </div>
        <div id="hubpage" className="hidden"><div id="hubBody"></div></div>

        <div id="menu" className="screen hidden">
          <div id="m-missions" className="card"><h3>MISSIONS <em id="mLevel">LV 1</em></h3><div id="mList"></div></div>
          <div id="m-stats" className="card"><h3>RECORDS</h3>
            <div><span>Best score</span><b id="mBest">0</b></div>
            <div><span>Best distance</span><b id="mDist">0 m</b></div>
            <div><span>Runs</span><b id="mRuns">0</b></div>
            <div><span>Hoverboards</span><b id="mBoards">0</b></div>
          </div>
          <div id="m-bottom">
            <div id="partyStrip" className="hidden"></div>
            <button className="modecard" id="modeCard"></button>
            <button className="btn go" id="playBtn">PLAY</button>
            <div className="picker">
              <button className="btn round" id="prevChar">◀</button>
              <div className="name ink"><b id="charName">Kit</b><small id="charTag"></small></div>
              <button className="btn round" id="nextChar">▶</button>
            </div>
            <button className="btn green sm" id="unlockBtn" style={{ display: 'none' }}>UNLOCK</button>
          </div>
          <div id="m-maps" className="card"><h3>MAP</h3><div id="mapList"></div></div>
          <div id="m-modes" className="card"><h3>MODE</h3><div id="modeList"></div></div>
          <div id="m-side-btns"><button className="btn purple" id="btnOnline">ONLINE</button><button className="btn green" id="btnDaily">DAILY RUN</button><button className="btn neon hidden-ltm" id="btnNeon">NEON RUSH</button></div>
          <div className="hint"><kbd>←</kbd> <kbd>→</kbd> lanes &nbsp; <kbd>↑</kbd>/<kbd>Space</kbd> jump &nbsp; <kbd>↓</kbd> roll<br /><kbd>Space</kbd>×2 or <kbd>B</kbd> hoverboard &nbsp; <kbd>P</kbd> pause &nbsp; <kbd>M</kbd> mute</div>
        </div>

        <div id="hud" className="screen hidden">
          <div id="h-guard"></div>
          <div id="h-left"><button className="btn round" id="btnPause"><svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg></button></div>
          <div id="h-score"><div className="n ink" id="hScore">0</div><div className="sub"><span className="chip mul" id="hMul">x1</span><span className="chip" id="hDist">0 m</span><span className="chip" id="hTime">0:00</span><span className="chip dbl" id="hDbl" style={{ display: 'none' }}>2x</span></div></div>
          <div id="h-right"><div className="pill" id="hCoinPill"><span className="coin-i"></span><span id="hCoins">0</span></div><div className="pill nocoin" id="hNoCoin" style={{ display: 'none' }}>NO COIN</div></div>
          <div id="h-warn"><i id="warn0">!</i><i id="warn1">!</i><i id="warn2">!</i></div>
          <div id="h-powers"></div>
          <div id="h-mp" className="hidden"></div>
          <div id="hPing" style={{ display: 'none' }}></div>
          <div id="h-count"></div>
          <div id="h-say"></div>
          <div id="h-missions" className="card"></div>
          <button className="btn" id="h-boardBtn" title="Hoverboard (B)"><span id="hBoardIc" className="board-ic"></span><small id="hBoards">0</small></button>
          <div id="h-toast" className=" ink"></div>
          <div id="h-tut" className=" ink"></div>
          <div id="h-cheat" className="hidden"></div>
          <div id="h-event" className="hidden">NEON RUSH</div>
          <div id="h-boost" className="hidden"></div>
          <div id="drBanner" className="hidden"><b id="drbT"></b><small id="drbS"></small></div>
        </div>

        <div id="pause" className="screen modal hidden"><div className="panel"><h2 className="ink">PAUSED</h2>
          <div className="row"><button className="btn go" id="btnResume">RESUME</button><button className="btn" id="btnRestart">RESTART</button><button className="btn red" id="btnQuit">HOME</button></div></div></div>

        <div id="over" className="screen modal hidden"><div className="panel"><h2 className=" ink">GAME OVER</h2>
          <div className="newbest ink" id="oNew" style={{ display: 'none' }}>★ NEW BEST! ★</div>
          <div className="stat"><span>Score</span><b id="oScore">0</b></div>
          <div className="stat"><span>Best</span><b id="oBest">0</b></div>
          <div className="stat"><span>Coins</span><b id="oCoins">0</b></div>
          <div className="stat"><span>Distance</span><b id="oDist">0 m</b></div>
          <div className="stat"><span>Time</span><b id="oTime">0:00</b></div>
          <div className="err" id="oMode" style={{ minHeight: '0', margin: '4px 0' }}></div>
          <div className="stage-note" id="oOnline"></div>
          <div className="card" style={{ marginTop: '12px' }}><h3>MISSIONS</h3><div id="oMissions"></div></div>
          <div className="row"><button className="btn green" id="btnRevive" style={{ display: 'none' }}>REVIVE</button><button className="btn go" id="btnAgain">PLAY AGAIN</button><button className="btn" id="btnHome">HOME</button></div></div></div>

        <div id="lobby" className="screen modal hidden"><div className="panel" style={{ width: 'min(94vw,720px)' }}>
          <h2 className=" ink">ONLINE</h2>
          <div className="tabs"><button className="tab sel" id="tabBtnPlay">PLAY</button><button className="tab" id="tabBtnBoard">LEADERBOARD</button></div>
          <div id="tabPlay">
            <div className="lob-row me"><b id="pfName">Offline</b><span className="tag" id="pfTier">-</span><span id="pfRating" style={{ marginLeft: 'auto', fontFamily: 'var(--font)', color: 'var(--yellow)' }}>-</span><button className="btn sm" id="btnRename">EDIT</button></div>
            <div id="lobConnect">
              <div className="stage-note" id="rankedNote"></div>
              <div className="stage-note">Ranked pairs you with runners of your level. Same track for everyone &mdash; best score wins.</div>
              <input className="txt" id="lobName" maxLength={14} placeholder="Your name" style={{ margin: '6px 0' }} />
              <input className="txt" id="lobCode" maxLength={4} placeholder="Room code (optional)" style={{ margin: '6px 0', textTransform: 'uppercase' }} />
              <div className="err" id="lobErr"></div>
              <div className="row" style={{ marginTop: '6px' }}><button className="btn go" id="btnRanked">RANKED</button><button className="btn green" id="btnQuick">QUICK MATCH</button><button className="btn purple" id="btnCreate">CREATE ROOM</button><button className="btn" id="btnJoin">JOIN CODE</button></div>
            </div>
            <div id="lobSearch" style={{ display: 'none' }}>
              <div className="code-big" id="srchTime" style={{ fontSize: '56px', letterSpacing: '2px' }}>0:00</div>
              <div className="stage-note" id="srchNote"></div>
              <div className="row"><button className="btn red" id="btnCancelSearch">CANCEL</button></div>
            </div>
            <div id="lobRoom" style={{ display: 'none' }}>
              <div className="code-big" id="lobRoomCode">----</div>
              <div className="stage-note" id="lobMapNote"></div>
              <div id="lobPlayers"></div>
              <div className="set-row" id="lobMapRow"><span>Map</span><select id="lobMap"></select></div>
              <div className="row"><button className="btn green" id="btnReady">READY</button><button className="btn go" id="btnStartRace" style={{ display: 'none' }}>START RACE</button><button className="btn red" id="btnLeaveRoom">LEAVE</button></div>
            </div>
          </div>
          <div id="tabBoard" style={{ display: 'none' }}><div id="boardChips"></div><div id="periodChips"></div><div id="boardRows" style={{ maxHeight: '44vh', overflow: 'auto', marginTop: '8px' }}></div></div>
          <div className="row" id="lobClose"><button className="btn sm" id="btnLobClose">BACK</button></div>
        </div></div>

        <div id="specTag" className="hidden"><i className="dotlive"></i><b>SPECTATING</b><span id="specName"></span><button id="specExit">BACK TO RESULTS</button></div>
        <div id="mpres" className="screen modal hidden"><div className="panel">
          <h2 className=" ink" id="mpTitle">RACE OVER</h2>
          <div className="stage-note" id="mpWait"></div>
          <div id="mpRank"></div>
          <div className="row"><button className="btn" id="btnMpSpec" style={{ display: 'none' }}>SPECTATE</button><button className="btn go" id="btnMpLobby">BACK TO LOBBY</button><button className="btn red" id="btnMpLeave">LEAVE</button></div>
        </div></div>

        <div id="shop" className="screen modal hidden"><div className="panel"><h2 className=" ink">SHOP</h2>
          <div className="pill" style={{ margin: '0 auto 14px', display: 'flex', width: 'fit-content' }}><span className="coin-i"></span><span id="sCoins">0</span></div>
          <div className="grid2" id="shopGrid"></div>
          <div className="row"><button className="btn" id="btnShopClose">BACK</button></div></div></div>

        <div id="settings" className="screen modal hidden"><div className="panel" style={{ width: 'min(94vw,780px)' }}><h2 className="ink">SETTINGS</h2>
          <div className="tabs" id="setTabs"></div>
          <div id="setBody"></div>
          <p className="sec-hint" id="setVer"></p>
          <p className="legal-row"><a href="/terms" target="_blank" rel="noopener">Terms of Service</a> · <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> &nbsp; <button className="linkbtn" id="btnExport">Download my data</button> · <button className="linkbtn danger" id="btnDeleteAcct">Delete my account</button></p>
          <div className="row"><button className="btn red sm" id="btnReset">RESET PROGRESS</button><button className="btn" id="btnSetClose">BACK</button></div></div></div>

        <div id="dlg" className="screen modal hidden" role="dialog" aria-modal="true"><div className="panel dlg-panel">
          <h2 className="ink" id="dlgTitle">CONFIRM</h2>
          <p id="dlgMsg" className="stage-note"></p>
          <input className="txt" id="dlgInput" style={{ display: 'none' }} autoComplete="off" />
          <div className="err" id="dlgErr"></div>
          <div className="row"><button className="btn" id="dlgNo">CANCEL</button><button className="btn go" id="dlgYes">OK</button></div></div></div>

        <div id="modePick" className="screen modal hidden"><div className="panel mp-panel" style={{ width: 'min(96vw,900px)' }}><h2 className="ink">GAME MODE</h2><div id="mpCats"></div><div id="mpBody"></div><div className="row mp-close-row"><button className="btn go" id="mpClose">CLOSE</button></div></div></div>
        <div id="friends" className="screen modal hidden"><div className="panel" style={{ width: 'min(94vw,680px)' }}><h2 className="ink">FRIENDS</h2><div id="frBody"></div><div className="row"><button className="btn go" id="frClose">CLOSE</button></div></div></div>
        <div id="searchOv" className="screen modal hidden"><div className="panel" style={{ width: 'min(92vw,520px)' }}><div id="soBody"></div><div className="row"><button className="btn red" id="soCancel">CANCEL</button><button className="btn sm" id="soOffline" style={{ display: 'none' }}>PLAY OFFLINE INSTEAD</button></div></div></div>
        <div id="duelhud" className="hidden">
          <div id="dTop">
            <div className="dside"><b id="dMeName">YOU</b><div className="dbar"><i id="dMeBar"></i></div></div>
            <div id="dTimer">2:00</div>
            <div className="dside right"><b id="dFoeName">RIVAL</b><div className="dbar foe"><i id="dFoeBar"></i></div></div>
          </div>
          <div id="dCross" className="cross"></div>
          <div id="dHit"></div>
          <div id="dHurt"></div>
          <div id="dMsg"></div>
          <div id="dFeed"></div>
          <div id="dBottom"><div id="dHp"><span id="dHpNum">100</span><div className="dbar big"><i id="dHpBar"></i></div></div><div id="dAmmo"><b id="dAmmoNum">7</b><span>/ 7</span><small id="dAmmoHint"></small></div></div>
          <div id="dLock" className="hidden">CLICK TO AIM &middot; WASD move &middot; SPACE jump &middot; R reload &middot; RIGHT CLICK scope</div>
        </div>
        <div id="warp"><i></i><b>GOLD RUSH</b></div>
        <div id="duelres" className="screen modal hidden"><div className="panel"><h2 className="ink" id="drTitle">VICTORY</h2><div className="stage-note" id="drSub"></div><div id="drStats"></div><div className="row"><button className="btn go" id="drAgain">PLAY AGAIN</button><button className="btn" id="drHome">HOME</button></div></div></div>
        <div id="langModal" className="screen modal hidden"><div className="panel" style={{ width: 'min(92vw,460px)' }}><h2 className="ink">LANGUAGE</h2><div className="obcards big" id="langList"></div><div className="row"><button className="btn" id="langClose">CLOSE</button></div></div></div>
        <div id="onboard" className="screen modal hidden"><div className="panel" style={{ width: 'min(94vw,720px)' }}><div id="obDots"></div><div id="obBody"></div><div className="row"><button className="btn" id="obBack">BACK</button><button className="btn go" id="obNext">CONTINUE</button></div></div></div>
        <div id="fpsMeter" className="hidden"></div>
        <div id="dbgPanel" className="hidden"></div>
        <div id="fade" className="fade"></div>
      </div>
      <canvas id="confetti" />
    </>
  );
}
