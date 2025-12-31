#!/usr/bin/env bun
/**
 * Bot player that automatically calls every turn
 * Usage: bun backend/scripts/bot-player.js <roomCode> <botName> <password>
 */

const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3660/api',
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: () => true, // Don't throw on any status
});

function extractSessionCookie(res) {
  const cookies = res?.headers?.['set-cookie'];
  if (!cookies || cookies.length === 0) return null;
  // Need to send ALL cookies (both holdem and holdem.sig)
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function joinOrAuth({ gameId, botName, password }) {
  // First try joining (works for brand new bot player)
  const joinRes = await api.post(`/games/${gameId}/join`, {
    name: botName,
    password,
  });

  if (joinRes.status === 200 || joinRes.status === 201) {
    const sessionCookie = extractSessionCookie(joinRes);
    if (!sessionCookie) {
      throw new Error('No session cookie received from server (join)');
    }
    return { sessionCookie, player: joinRes.data?.player, mode: 'join' };
  }

  // If join fails (already joined / game already started), fall back to auth
  const authRes = await api.post(`/games/${gameId}/auth`, {
    name: botName,
    password,
  });

  if (authRes.status === 200) {
    const sessionCookie = extractSessionCookie(authRes);
    if (!sessionCookie) {
      throw new Error('No session cookie received from server (auth)');
    }
    return { sessionCookie, player: authRes.data?.player, mode: 'auth' };
  }

  const joinMsg = joinRes.data?.error?.message || joinRes.data?.error;
  const authMsg = authRes.data?.error?.message || authRes.data?.error;
  throw new Error(
    `Failed to join/auth (join=${joinRes.status}${joinMsg ? `: ${joinMsg}` : ''}, auth=${authRes.status}${authMsg ? `: ${authMsg}` : ''})`
  );
}

async function main() {
  const roomCode = process.argv[2];
  const botName = process.argv[3] || 'Bot';
  const password = process.argv[4] || 'botpass';

  if (!roomCode) {
    console.error(
      'Usage: bun backend/scripts/bot-player.js <roomCode> [botName] [password]'
    );
    process.exit(1);
  }

  console.log(`🤖 Bot "${botName}" connecting to game ${roomCode}...`);

  try {
    // Get game ID from room code
    const gameInfoRes = await api.get(`/games/room/${roomCode}`);
    if (gameInfoRes.status !== 200) {
      const errorMsg = gameInfoRes.data?.error || `HTTP ${gameInfoRes.status}`;
      throw new Error(`Failed to find game: ${errorMsg}`);
    }
    const gameId = gameInfoRes.data.id;

    let { sessionCookie, player, mode } = await joinOrAuth({
      gameId,
      botName,
      password,
    });

    if (player?.position !== undefined) {
      console.log(
        `✅ Connected as ${botName} (position ${player.position}) via ${mode}`
      );
    } else {
      console.log(`✅ Connected as ${botName} via ${mode}`);
    }
    console.log(`🎮 Waiting for game to start and responding to turns...\n`);

    // Poll loop
    let lastAction = Date.now();
    let consecutiveErrors = 0;

    while (true) {
      try {
        // Get current game state with cookie
        let gameRes = await api.get(`/games/${gameId}`, {
          headers: { Cookie: sessionCookie },
        });

        if (gameRes.status === 401) {
          // Session expired / server restarted: re-auth and retry once
          const relog = await joinOrAuth({ gameId, botName, password });
          sessionCookie = relog.sessionCookie;
          gameRes = await api.get(`/games/${gameId}`, {
            headers: { Cookie: sessionCookie },
          });
        }

        if (gameRes.status !== 200) {
          throw new Error(gameRes.data?.error || 'Failed to get game state');
        }

        const game = gameRes.data;
        consecutiveErrors = 0;

        // Ask the server if we can act. This also lets the server heal a stuck turn pointer.
        if (game.status === 'active') {
          // Throttle actions
          const timeSinceLastAction = Date.now() - lastAction;
          if (timeSinceLastAction < 1000) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 - timeSinceLastAction)
            );
          }

          // Get valid actions
          let actionsRes = await api.get(`/games/${gameId}/actions/valid`, {
            headers: { Cookie: sessionCookie },
          });

          if (actionsRes.status === 401) {
            const relog = await joinOrAuth({ gameId, botName, password });
            sessionCookie = relog.sessionCookie;
            actionsRes = await api.get(`/games/${gameId}/actions/valid`, {
              headers: { Cookie: sessionCookie },
            });
          }

          if (actionsRes.status !== 200) {
            throw new Error('Failed to get valid actions');
          }

          const validActions = actionsRes.data;
          if (validActions && validActions.canAct) {
            // Decide action: prefer check, then call
            let action = 'fold';
            let amount = undefined;

            if (validActions.canCheck) {
              action = 'check';
              console.log(`🤖 [${game.currentRound}] Bot checks`);
            } else if (validActions.canCall) {
              action = 'call';
              console.log(
                `🤖 [${game.currentRound}] Bot calls $${validActions.callAmount}`
              );
            } else {
              console.log(`🤖 [${game.currentRound}] Bot folds`);
            }

            // Submit action
            let actionRes = await api.post(
              `/games/${gameId}/actions`,
              { action, amount },
              { headers: { Cookie: sessionCookie } }
            );

            if (actionRes.status === 401) {
              const relog = await joinOrAuth({ gameId, botName, password });
              sessionCookie = relog.sessionCookie;
              actionRes = await api.post(
                `/games/${gameId}/actions`,
                { action, amount },
                { headers: { Cookie: sessionCookie } }
              );
            }

            if (actionRes.status !== 200) {
              console.error(`❌ Action failed: ${actionRes.data?.error}`);
            }

            lastAction = Date.now();
          }
        }

        // Check game status
        if (game.status === 'completed') {
          console.log('\n🏁 Game completed!');
          if (game.winners && game.winners.length > 0) {
            console.log(
              'Winners:',
              game.winners.map((w) => w.playerName).join(', ')
            );
          }
          break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        consecutiveErrors++;

        if (consecutiveErrors >= 5) {
          console.error(
            '\n❌ Too many consecutive errors, exiting:',
            error.message
          );
          process.exit(1);
        }

        if (consecutiveErrors === 1) {
          console.error('⚠️  Error (will retry):', error.message);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error?.message || error);
    if (error?.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();
