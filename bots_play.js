#!/usr/bin/env bun
/**
 * Two bots play against each other with observer mode
 * One bot plays aggressively (bets $50), one plays conservatively
 * Usage: bun bots_play.js <ROOM_CODE>
 */

const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3660/api',
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
});

function extractSessionCookie(res) {
  const cookies = res?.headers?.['set-cookie'];
  if (!cookies || cookies.length === 0) return null;
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function joinOrAuth({ gameId, botName, password }) {
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

  throw new Error(
    `Failed to join/auth (join=${joinRes.status}, auth=${authRes.status})`
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playGame(gameId, bot1, bot2) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎮 Game ${gameId.substring(0, 8)}... Starting`);
  console.log(`${'='.repeat(60)}\n`);

  let hand = 0;
  let bot1Chips, bot2Chips;

  while (true) {
    try {
      // Get current game state with bot1's credentials
      const gameRes = await api.get(`/games/${gameId}`, {
        headers: { Cookie: bot1.sessionCookie },
      });
      if (gameRes.status !== 200) {
        throw new Error(`Failed to get game state: ${gameRes.status}`);
      }

      const game = gameRes.data;

      // Check if game is completed
      if (game.status === 'completed') {
        const finalState = await api.get(`/games/${gameId}`, {
          headers: { Cookie: bot1.sessionCookie },
        });
        const finalPlayers = finalState.data?.players;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏁 GAME OVER!`);
        console.log(`${'='.repeat(60)}`);
        if (finalPlayers) {
          finalPlayers.forEach((p) => {
            console.log(`  ${p.name}: $${p.chips}`);
          });
        }
        console.log(`${'='.repeat(60)}\n`);
        break;
      }

      // Track chip counts
      const player1 = game.players.find((p) => p.name === bot1.name);
      const player2 = game.players.find((p) => p.name === bot2.name);

      if (game.currentRound && game.handNumber !== hand) {
        hand = game.handNumber;
        console.log(`\n--- Hand #${hand} ---`);
        console.log(
          `${bot1.name}: $${player1.chips} | ${bot2.name}: $${player2.chips}`
        );
        console.log(`Round: ${game.currentRound}`);
      }

      // Play for each bot
      for (const bot of [bot1, bot2]) {
        if (game.status !== 'active') break;

        // Get who's turn it is
        const gameCheck = await api.get(`/games/${gameId}`, {
          headers: { Cookie: bot.sessionCookie },
        });

        if (gameCheck.status !== 200) continue;

        const currentGame = gameCheck.data;
        const botPlayer = currentGame.players.find((p) => p.name === bot.name);

        if (!botPlayer) continue;

        // Check if it's this bot's turn
        if (currentGame.currentPlayerPosition === botPlayer.position) {
          // Get valid actions
          const actionsRes = await api.get(`/games/${gameId}/actions/valid`, {
            headers: { Cookie: bot.sessionCookie },
          });

          if (actionsRes.status !== 200) continue;

          const validActions = actionsRes.data;
          if (validActions && validActions.canAct) {
            let action = 'fold';
            let amount = undefined;

            // Decide action based on bot strategy
            if (bot.strategy === 'aggressive') {
              // Aggressive bot: always try to bet $100 or all-in
              if (validActions.canBet && botPlayer.chips >= 100) {
                action = 'bet';
                amount = 100;
                console.log(`🤖 ${bot.name} (aggressive) bets $100`);
              } else if (
                validActions.canRaise &&
                validActions.maxRaise >= 100
              ) {
                action = 'raise';
                amount = Math.min(100, validActions.maxRaise);
                console.log(`🤖 ${bot.name} (aggressive) raises by $${amount}`);
              } else if (validActions.canCall) {
                action = 'call';
                console.log(
                  `🤖 ${bot.name} (aggressive) calls $${validActions.callAmount}`
                );
              } else if (validActions.canCheck) {
                action = 'check';
                console.log(`🤖 ${bot.name} (aggressive) checks`);
              } else {
                console.log(`🤖 ${bot.name} (aggressive) folds`);
              }
            } else {
              // Conservative bot: check when free, fold 30% when paying, call 70% when paying
              if (validActions.canCheck) {
                action = 'check';
                console.log(`🤖 ${bot.name} (conservative) checks`);
              } else if (validActions.canCall) {
                // 30% chance to fold when required to pay
                if (Math.random() < 0.3) {
                  action = 'fold';
                  console.log(
                    `🤖 ${bot.name} (conservative) folds (30% fold rate)`
                  );
                } else {
                  action = 'call';
                  console.log(
                    `🤖 ${bot.name} (conservative) calls $${validActions.callAmount}`
                  );
                }
              } else {
                console.log(`🤖 ${bot.name} (conservative) folds`);
              }
            }

            // Submit action
            const actionRes = await api.post(
              `/games/${gameId}/actions`,
              { action, amount },
              { headers: { Cookie: bot.sessionCookie } }
            );

            if (actionRes.status !== 200) {
              console.error(`❌ Action failed: ${actionRes.data?.error}`);
            }

            // Delay for observability
            await sleep(1500);
          }
        }
      }

      // Check if we should reveal a card (all-in situation)
      const latestGame = await api.get(`/games/${gameId}`, {
        headers: { Cookie: bot1.sessionCookie },
      });
      if (latestGame.status === 200) {
        const game = latestGame.data;
        const playersWithChips = game.players.filter(
          (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded'
        );

        if (
          playersWithChips.length === 1 &&
          game.currentRound &&
          game.currentRound !== 'preflop' &&
          game.currentRound !== 'showdown'
        ) {
          console.log(`\n🎴 One player all-in, revealing next card...`);
          const activeBot = [bot1, bot2].find((b) => {
            const p = game.players.find((p) => p.name === b.name);
            return (
              p && p.chips > 0 && p.status !== 'out' && p.status !== 'folded'
            );
          });

          if (activeBot) {
            await sleep(1000);
            const revealRes = await api.post(
              `/games/${gameId}/reveal-card`,
              {},
              {
                headers: { Cookie: activeBot.sessionCookie },
              }
            );
            if (revealRes.status === 200) {
              const revealed = revealRes.data;
              console.log(`  Cards: ${revealed.communityCards.length}/5`);
              if (revealed.currentRound === 'showdown') {
                console.log(`  🏆 Moving to showdown!`);
              }
              await sleep(1500);
            }
          }
        }

        // Check if we're at showdown and advance to next hand
        if (game.currentRound === 'showdown') {
          console.log(`\n🏆 Showdown reached! Advancing to next hand...`);
          await sleep(1000);

          const nextHandRes = await api.post(
            `/games/${gameId}/next-hand`,
            {},
            {
              headers: { Cookie: bot1.sessionCookie },
            }
          );

          if (nextHandRes.status === 200) {
            const nextGame = nextHandRes.data;
            if (nextGame.status === 'completed') {
              console.log(`\n✋ Game is now completed. Cannot continue.`);
            } else {
              console.log(`✅ Hand advanced. Starting next hand...`);
              await sleep(1500);
            }
          } else {
            console.error(
              `❌ Failed to advance to next hand: ${nextHandRes.status}`
            );
          }
        }
      }

      await sleep(500);
    } catch (error) {
      console.error('❌ Error during game:', error.message);
      await sleep(2000);
    }
  }
}

async function main() {
  const roomCode = process.argv[2];

  if (!roomCode) {
    console.error('Usage: bun bots_play.js <ROOM_CODE>');
    process.exit(1);
  }

  console.log(`\n🤖 Bot Game Observer - Room: ${roomCode}`);
  console.log('Bot 1: "Aggressive" (bets $100)');
  console.log('Bot 2: "Conservative" (calls/checks)\n');

  try {
    // Get game ID from room code
    const gameInfoRes = await api.get(`/games/room/${roomCode}`);
    if (gameInfoRes.status !== 200) {
      throw new Error(`Failed to find game: ${gameInfoRes.data?.error}`);
    }
    const gameId = gameInfoRes.data.id;

    // Join first bot (aggressive)
    console.log('🔗 Connecting bot 1 (aggressive)...');
    const bot1Login = await joinOrAuth({
      gameId,
      botName: 'AggressiveBot',
      password: 'botpass1',
    });
    const bot1 = {
      name: 'AggressiveBot',
      sessionCookie: bot1Login.sessionCookie,
      strategy: 'aggressive',
    };
    console.log(
      `✅ AggressiveBot joined at position ${bot1Login.player?.position}`
    );

    // Wait a moment
    await sleep(500);

    // Join second bot (conservative)
    console.log('🔗 Connecting bot 2 (conservative)...');
    const bot2Login = await joinOrAuth({
      gameId,
      botName: 'ConservativeBot',
      password: 'botpass2',
    });
    const bot2 = {
      name: 'ConservativeBot',
      sessionCookie: bot2Login.sessionCookie,
      strategy: 'conservative',
    };
    console.log(
      `✅ ConservativeBot joined at position ${bot2Login.player?.position}`
    );

    // Check if game is waiting to be started
    const gameRes = await api.get(`/games/${gameId}`, {
      headers: { Cookie: bot1.sessionCookie },
    });

    if (gameRes.status !== 200) {
      throw new Error(`Failed to check game status: ${gameRes.status}`);
    }

    if (gameRes.data.status === 'waiting') {
      console.log('\n⏳ Game is waiting to start. Starting game...');
      const startRes = await api.post(
        `/games/${gameId}/start`,
        {},
        {
          headers: { Cookie: bot1.sessionCookie },
        }
      );
      if (startRes.status === 200) {
        console.log('✅ Game started!');
        await sleep(1000);
      } else {
        console.error(
          `❌ Failed to start game: ${startRes.status} - ${startRes.data?.error}`
        );
      }
    } else {
      console.log(`\n✅ Game already in status: ${gameRes.data.status}`);
    }

    // Play the game
    await playGame(gameId, bot1, bot2);
  } catch (error) {
    console.error('\n❌ Fatal error:', error?.message || error);
    process.exit(1);
  }
}

main();
