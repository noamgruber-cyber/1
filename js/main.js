function startGame() {
  const canvas = document.getElementById('game');
  G.Game.init(canvas);
  G.UI.init();
  G.UI.onMenu();
  window.__game = G.Game; // handy for debugging / automated tests
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', startGame);
else startGame();
