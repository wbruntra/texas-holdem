import type { GameState, ValidActions, Player, Pot } from './types'
import { formatCard, formatCards } from './card-utils'

export class Display {
  printWelcome(): void {
    console.log('╔══════════════════════════════════════╗')
    console.log("║      Texas Hold'em Terminal Client    ║")
    console.log('╚══════════════════════════════════════╝')
  }

  printGameState(state: GameState, playerName: string): void {
    console.clear()
    this.printWelcome()
    this.printTableState(state, playerName)
    this.printWinners(state)

    if (state.status === 'active') {
      const me = state.players.find((p) => p.name === playerName)
      if (me) {
        console.log(`\nYour chips: $${me.chips}`)
        console.log(`Your current bet: $${me.currentBet}`)
        const cards = me.holeCards
        if (cards && cards.length > 0) {
          console.log(`Your cards: ${formatCards(cards)}`)
        }
      }
    }
  }

  printWinners(state: GameState): void {
    if (!state.winners || state.winners.length === 0) return

    // Find total pot and winners info
    let totalPot = 0
    const winnerNames: string[] = []

    state.winners.forEach((winnerPos: number) => {
      const winner = state.players.find((p) => p.position === winnerPos)
      if (winner) {
        winnerNames.push(winner.name)
      }
    })

    if (state.pots && state.pots.length > 0) {
      state.pots.forEach((pot: Pot) => {
        totalPot += pot.amount || 0
      })
    } else {
      totalPot = state.pot
    }

    if (winnerNames.length > 0) {
      console.log('\n=== Showdown Results ===')
      const eachWon = Math.floor(totalPot / winnerNames.length)
      winnerNames.forEach((name) => {
        console.log(`${name} won $${eachWon}`)
      })
    }
  }

  printTableState(state: GameState, playerName: string): void {
    let totalPot = 0
    if (state.pots && state.pots.length > 0) {
      state.pots.forEach((pot: Pot) => {
        totalPot += pot.amount || 0
      })
    } else {
      totalPot = state.pot
    }

    console.log(
      `\nRoom: ${state.roomCode} | Hand: ${state.handNumber || 1} | Status: ${state.status}`,
    )
    console.log(
      `Round: ${state.currentRound || 'preflop'} | Pot: $${totalPot} | To Call: $${state.currentBet}`,
    )

    if (state.pots && state.pots.length > 1) {
      state.pots.forEach((pot: Pot, idx: number) => {
        console.log(`  ${idx === 0 ? 'Main' : `Side ${idx}`}: $${pot.amount}`)
      })
    }

    if (state.communityCards && state.communityCards.length > 0) {
      console.log(`Community: ${formatCards(state.communityCards)}`)
    }

    console.log('\nPlayers:')
    state.players.forEach((player: Player) => {
      const statusIcon =
        player.status === 'folded'
          ? '✗'
          : player.status === 'all_in'
            ? '⚡'
            : player.status === 'out'
              ? '○'
              : '●'
      const isMe = player.name === playerName ? ' (YOU)' : ''
      const isCurrent = state.currentPlayerPosition === player.position ? ' ⬅️' : ''
      console.log(
        `  ${statusIcon} ${player.name}${isMe}: $${player.chips}${isCurrent} [bet: $${player.currentBet}] [${player.status}]`,
      )
    })
  }

  printActions(actions: ValidActions): void {
    console.log("\n=== It's Your Turn! ===")
    const actionList: string[] = []

    if (actions.canCheck) actionList.push('[c]heck')
    if (actions.canCall) actionList.push(`[c]all $${actions.callAmount || 0}`)
    if (actions.canBet) actionList.push(`b<amt> bet ($${actions.minBet}-${actions.maxBet})`)
    if (actions.canRaise)
      actionList.push(`r<amt> raise ($${actions.minRaise}-${actions.maxRaise})`)
    if (actions.canFold) actionList.push('[f]old')

    if (actions.reason) {
      console.log(`Status: ${actions.reason}`)
    }

    console.log('Actions: ' + actionList.join(' | '))
    console.log('Type: c=check/call, b<amt>=bet, r<amt>=raise, f=fold')
  }

  printActionsFull(actions: ValidActions): void {
    console.log('\n=== Valid Actions ===')
    console.log(`Can act: ${actions.canAct}`)
    console.log(`Can fold: ${actions.canFold}`)
    console.log(`Can check: ${actions.canCheck}`)
    console.log(
      `Can call: ${actions.canCall}${actions.callAmount !== undefined ? ` ($${actions.callAmount})` : ''}`,
    )
    console.log(
      `Can bet: ${actions.canBet}${actions.minBet !== undefined ? ` (min: $${actions.minBet}, max: $${actions.maxBet})` : ''}`,
    )
    console.log(
      `Can raise: ${actions.canRaise}${actions.minRaise !== undefined ? ` (min: $${actions.minRaise}, max: $${actions.maxRaise})` : ''}`,
    )
    if (actions.reason) {
      console.log(`Note: ${actions.reason}`)
    }
  }

  printNotYourTurn(): void {
    console.log("\n>>> IT'S YOUR TURN <<<")
  }

  printMessage(msg: string): void {
    console.log(msg)
  }

  printError(msg: string): void {
    console.error(msg)
  }
}
