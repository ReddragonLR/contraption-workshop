import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar"><h1>Contraption Workshop</h1></header>
  <main class="stage"><canvas id="game-canvas" width="960" height="600"></canvas></main>
`;
