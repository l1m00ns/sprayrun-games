// English strings of the play flow (modes, party, friends, search) and of the server messages shown in toasts.
// They are not hard-coded in a dictionary: tools/translate.mjs reads this list and writes public/lang/<code>.json.
export const UI_STRINGS = [
  // categories + modes
  'Limited-time', 'Ranked', 'Normal', 'Other modes', 'Limited time', 'Solo', 'Duos', 'Trios', 'Offline', 'Daily', 'Room',
  'Gold Rush Duel', 'Race, then a 1v1 shootout', 'Mid-race the track warps into an arena: 2:00, one life, Gold Eagle only. First hit wins.',
  'Ranked Solo', 'Ranked Duos', 'Ranked Trios', 'Normal Solo', 'Normal Duos', 'Normal Trios', 'Free for all', '2 v 2', '3 v 3',
  'Free for all, up to 4 runners. Rating moves with your placement.', '2 v 2. You and a partner against another pair: team score decides.', '3 v 3. Your trio against another trio: team score decides.',
  'Free for all, up to 4 runners. No rating at stake.', '2 v 2, just for fun. Queue alone or with a friend.', '3 v 3, just for fun. Bring two friends or get matched.',
  'Classic Run', 'Offline, just you', 'Collect coins and survive as long as you can. Works without a connection.', 'Offline, coins are traps', 'Touch one coin and it is over. Pure dodging.',
  'Same track for everyone', 'One seeded track per day: the same obstacles for every player, on the daily board.', 'Custom Room', 'Code, friends, your rules', 'Create a room, share its code and race your friends on the map you choose.',
  // play flow UI
  'GAME MODE', 'FRIENDS', 'CANCEL', 'CLOSE', 'PLAY OFFLINE INSTEAD', 'PLAY OFFLINE', 'SEARCHING', 'WAITING FOR LEADER', 'Rules', 'Classic', 'Looking for runners', 'Looking for opponents', 'Looking for runners near your rating',
  'MATCH FOUND', 'Your team', 'Rivals', 'YOUR TEAM', 'RIVALS', 'Invite a friend', 'Leave', 'Remove', 'Your friend code', 'COPY', 'Username or friend code', 'ADD', 'Requests', 'Friends', 'Sent',
  'No friends yet. Share your code or add a username.', 'Online', 'In queue', 'In a match', 'INVITE', 'JOIN', 'ACCEPT', 'DECLINE', 'wants to be your friend', 'request sent', 'Remove friend', 'Cancel request',
  'Friend code copied', 'Request sent', 'You are now friends', 'Could not reach the server', 'Sign in (or start an online game once) to use friends.', 'Loading...',
  'The party leader picks the mode', 'Waiting for the party leader', 'Leave the party to play this mode', 'SERVER UNREACHABLE', 'Online modes need a connection. Play an offline run instead?',
  'PARTY INVITE', 'LATER', 'You were removed from the party', 'Party closed', 'REMOVE FRIEND', 'REMOVE', 'KEEP', 'VICTORY', 'DEFEAT', 'DRAW', 'Updating your rating...',
  // messages coming from the server
  // private messages, data rights, legal
  'Messages', 'MESSAGE', 'SEND', 'REPORT', 'BLOCK', 'Write a message', 'Say hello.', 'No conversations yet. Open a friend and press MESSAGE.', 'BLOCK PLAYER', 'REPORT PLAYER', 'SEND REPORT', 'Player blocked',
  'Report sent, thank you', 'Could not send the report', 'Not friends', 'Back', 'Download my data', 'Delete my account', 'Terms of Service', 'Privacy Policy', 'By continuing you accept the', 'and the',
  'DELETE ACCOUNT', 'DELETE FOREVER', 'KEEP MY ACCOUNT', 'Your data was downloaded', 'Could not export your data', 'Sign in first', 'There is no online account to delete', 'Could not delete the account', 'now',
  'Write something first', 'You cannot message yourself', 'Player not found', 'You cannot message this player', 'You can only message friends', 'Messaging is disabled for this account', 'Slow down a little',
  'Message limit reached, try again later', 'You just sent that', 'Too many reports today', 'Wrong password', 'Type DELETE to confirm', 'Deletion failed, nothing was changed', 'Searching', 'Preparing', 'Launch', 'GO!',
  'Backpacks', 'Auras', 'Styles', 'Skins', 'Zigzag Rails', 'The track snakes and rolls', 'A fun mode: the rails swing left and right and roll over hills, and your runner follows the path.', 'Fun', 'Explore', 'Walk the map, no obstacles', 'No trains, no crashes: stroll along the map at your own pace. Move with the arrow keys or WASD, Shift to run.', 'Open world', 'EXPLORE - nothing is saved', 'Daily Sprint', 'Weekly Cup', 'Best Classic run between 17:00 and 19:00 UTC.', 'Best Classic run from Saturday 16:00 to Sunday 22:00 UTC.', 'LIVE', 'UPCOMING', 'RANKING', 'ENDS IN', 'STARTS IN', 'Map', 'Could not load the ranking', 'Friends', 'People you may know', 'Only the party leader can invite', 'You can only invite friends', 'The party is full', 'That player is already in a party', 'That player is offline', 'Invitation sent', 'That party no longer exists',
  'Leave your party first', 'You are in a match', 'You need an invitation', 'The party is busy', 'Only the leader can remove players', 'Only the party leader can change the mode', 'Cancel the search first',
  'Only the party leader can start', 'Linked accounts cannot queue together in ranked', 'Only the party leader can cancel', 'Too many requests, try again later', 'No player with that username or friend code',
  'That is you', 'Already friends', 'Request already sent', 'Too many pending requests', 'Friend list is full', 'No such request', 'Nobody to queue', 'An account in this group cannot queue', 'Cannot queue right now',
];
