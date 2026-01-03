import inquirer from 'inquirer'
import type { ValidActions } from './types'

export interface ActionResult {
  action: string
  amount?: number
}

export class ActionSelector {
  showHelp(): void {
    console.log('\n=== Command Reference ===')
    console.log('Your turn:')
    console.log('  c  = check or call (whichever is available)')
    console.log('  b<amt>  = bet (e.g., b10 to bet 10)')
    console.log('  r<amt>  = raise (e.g., r50 to raise to 50)')
    console.log('  f  = fold')
    console.log('  ?  = show this help')
    console.log('\nOther (anytime):')
    console.log('  actions = show available actions')
    console.log('  refresh = update game state')
    console.log('  next/nh = next hand')
    console.log('  quit = leave game')
  }

  async selectAction(actions: ValidActions, isShowdown: boolean): Promise<ActionResult | null> {
    if (isShowdown) {
      const helpText = isShowdown ? '[n]ext hand' : '[c]heck/[c]all'
      const { input } = await inquirer.prompt({
        type: 'input',
        name: 'input',
        message: `Showdown (${helpText}):`,
      })

      const lower = input.toLowerCase().trim()
      if (lower === 'n' || lower === 'nh' || lower === 'next') {
        if (actions.canNextHand) {
          return { action: 'next_hand' }
        }
      }
      return { action: 'back' }
    }

    const helpText = this.getActionHelp(actions)
    const { input } = await inquirer.prompt({
      type: 'input',
      name: 'input',
      message: `> `,
    })

    if (input.trim() === '' || input.toLowerCase() === 'c') {
      if (actions.canCheck) {
        return { action: 'check' }
      }
      if (actions.canCall) {
        return { action: 'call' }
      }
    }

    if (input.toLowerCase() === '?') {
      return { action: 'help' }
    }

    if (input.toLowerCase() === 'f') {
      if (actions.canFold) {
        return { action: 'fold' }
      }
      return { action: 'invalid' }
    }

    // Bet: b<amount>
    if (input.toLowerCase().startsWith('b')) {
      const amount = parseInt(input.slice(1))
      if (!isNaN(amount) && amount > 0 && actions.canBet) {
        return { action: 'bet', amount }
      }
      return { action: 'invalid' }
    }

    // Raise: r<amount>
    if (input.toLowerCase().startsWith('r')) {
      const amount = parseInt(input.slice(1))
      if (!isNaN(amount) && amount > 0 && actions.canRaise) {
        return { action: 'raise', amount }
      }
      return { action: 'invalid' }
    }

    // Full commands
    const result = this.parseCommand(input)
    if (result) {
      return result
    }

    return { action: 'invalid' }
  }

  private getActionHelp(actions: ValidActions): string {
    return '> '
    const parts: string[] = []
    parts.push('[c]heck/[c]all')
    if (actions.canBet) {
      parts.push(`b<amt> to bet`)
    }
    if (actions.canRaise) {
      parts.push(`r<amt> to raise`)
    }
    if (actions.canFold) {
      parts.push(`[f]old`)
    }
    return parts.join(', ')
  }

  parseCommand(command: string): ActionResult | null {
    const lowerInput = command.toLowerCase().trim()

    if (lowerInput === 'quit' || lowerInput === 'q') {
      return { action: 'quit' }
    }

    if (lowerInput === 'actions' || lowerInput === 'a') {
      return { action: 'actions' }
    }

    if (lowerInput.startsWith('bet ')) {
      const parts = lowerInput.split(' ')
      const amountStr = parts[1]
      const amount = amountStr ? parseInt(amountStr) : NaN
      if (amount && !isNaN(amount)) {
        return { action: 'bet', amount }
      }
      return { action: 'invalid' }
    }

    if (lowerInput.startsWith('raise ')) {
      const parts = lowerInput.split(' ')
      const amountStr = parts[1]
      const amount = amountStr ? parseInt(amountStr) : NaN
      if (amount && !isNaN(amount)) {
        return { action: 'raise', amount }
      }
      return { action: 'invalid' }
    }

    const actionMap: Record<string, string> = {
      call: 'call',
      check: 'check',
      fold: 'fold',
      next: 'next',
      nh: 'next_hand',
      advance: 'advance',
      refresh: 'refresh',
      r: 'refresh',
    }

    const action = actionMap[lowerInput]
    if (action) {
      return { action }
    }

    return null
  }
}
