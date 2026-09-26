import './App.css';
import Game from '@/pages/Game';
import { createRunServiceClient } from '@/game/runServiceClient';
import { createGuestCredentialStore } from '@/game/guestCredentialStore';
import { createSoloBoardClient } from '@/game/soloBoardClient';

const runClient = import.meta.env.VITE_RUN_API_BASE_URL
  ? createRunServiceClient({ baseUrl: import.meta.env.VITE_RUN_API_BASE_URL }) : null;
const boardClient = import.meta.env.VITE_LEADERBOARD_API_BASE_URL
  ? createSoloBoardClient({ baseUrl: import.meta.env.VITE_LEADERBOARD_API_BASE_URL }) : null;

function guestStore() {
  try { return createGuestCredentialStore(window.localStorage); } catch { return null; }
}

export default function App() {
  return <Game runClient={runClient} boardClient={boardClient} guestStore={guestStore()} />;
}
