window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  G.Game.init(canvas);
  G.UI.init();
  G.UI.onMenu();
  window.__game = G.Game; // handy for debugging / automated tests
});
