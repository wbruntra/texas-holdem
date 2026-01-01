#!/usr/bin/env node
/**
 * Test script to verify auto-check functionality when one player is all-in
 */

const db = require('./db')

async function testAutoCheck() {
  try {
    // Find a recent game with all-in scenarios
    const game = await db('games').where('room_code', 'YGPN4P').first()

    if (!game) {
      console.log('Test game not found')
      return
    }

    console.log('Testing game:', game.room_code)
    console.log('Status:', game.status)
    console.log('Hand number:', game.hand_number)

    // Get hands
    const hands = await db('hands').where('game_id', game.id).orderBy('hand_number')

    console.log('\nTotal hands:', hands.length)

    // Check hand 3 which had the all-in situation
    const hand3 = hands.find((h) => h.hand_number === 3)
    if (hand3) {
      console.log('\n=== Hand 3 Analysis ===')

      const actions = await db('actions').where('hand_id', hand3.id).orderBy('sequence_number')

      console.log('Total actions:', actions.length)
      console.log('\nActions by round:')

      const rounds = ['preflop', 'flop', 'turn', 'river']
      for (const round of rounds) {
        const roundActions = actions.filter((a) => a.round === round)
        console.log(`  ${round}: ${roundActions.length} actions`)
        roundActions.forEach((a) => {
          console.log(
            `    - Player ${a.player_id}: ${a.action_type} ${a.amount > 0 ? '$' + a.amount : ''}`,
          )
        })
      }

      // Check player stacks
      const playerStacks = JSON.parse(hand3.player_stacks_start)
      console.log('\nStarting stacks:')
      playerStacks.forEach((p) => {
        console.log(`  ${p.name}: $${p.chips}`)
      })

      // Check if there were unnecessary checks
      const flopActions = actions.filter((a) => a.round === 'flop')
      const turnActions = actions.filter((a) => a.round === 'turn')
      const riverActions = actions.filter((a) => a.round === 'river')

      // After preflop all-in, there should be no betting actions on later streets
      // only auto-checks or nothing
      console.log('\n=== Analysis ===')
      if (flopActions.length > 0) {
        console.log(
          '⚠️  Flop had actions (should auto-advance):',
          flopActions.map((a) => a.action_type),
        )
      } else {
        console.log('✅ Flop correctly auto-advanced (no actions)')
      }

      if (turnActions.length > 0) {
        console.log(
          '⚠️  Turn had actions (should auto-advance):',
          turnActions.map((a) => a.action_type),
        )
      } else {
        console.log('✅ Turn correctly auto-advanced (no actions)')
      }

      if (riverActions.length > 0) {
        console.log(
          '⚠️  River had actions (should auto-advance):',
          riverActions.map((a) => a.action_type),
        )
      } else {
        console.log('✅ River correctly auto-advanced (no actions)')
      }
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.destroy()
  }
}

testAutoCheck()
