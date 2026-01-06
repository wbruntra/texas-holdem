import inquirer from 'inquirer'
import type { GameState } from './types'
import { api, ApiClient } from './api-client'

export class MenuSystem {
  private api: ApiClient

  constructor(api: ApiClient) {
    this.api = api
  }

  async mainMenu(savedSession?: {
    roomCode: string
    playerName: string
  }): Promise<'create' | 'join' | 'view' | 'exit' | 'reconnect'> {
    const choices = []

    if (savedSession) {
      choices.push({
        name: `Reconnect to last session (Room: ${savedSession.roomCode}, Player: ${savedSession.playerName})`,
        value: 'reconnect',
      })
    }

    choices.push(
      { name: 'Create new game', value: 'create' },
      { name: 'Join existing game', value: 'join' },
      { name: 'View table state (no auth)', value: 'view' },
      { name: 'Exit', value: 'exit' },
    )

    const { choice } = await inquirer.prompt({
      type: 'list',
      name: 'choice',
      message: 'Main Menu',
      choices,
    })
    return choice
  }

  async promptCreateGame(): Promise<{ bigBlind: number; startingChips: number }> {
    const { bigBlind, startingChips } = await inquirer.prompt([
      {
        type: 'input',
        name: 'bigBlind',
        message: 'Big blind amount:',
        default: '10',
        validate: (input: string) => {
          const val = parseInt(input)
          return !isNaN(val) && val > 0 ? true : 'Enter a valid number'
        },
      },
      {
        type: 'input',
        name: 'startingChips',
        message: 'Starting chips:',
        default: '1000',
        validate: (input: string) => {
          const val = parseInt(input)
          return !isNaN(val) && val > 0 ? true : 'Enter a valid number'
        },
      },
    ])
    return { bigBlind, startingChips }
  }

  async confirmJoin(): Promise<boolean> {
    const { join } = await inquirer.prompt({
      type: 'confirm',
      name: 'join',
      message: 'Join this game as a player?',
      default: true,
    })
    return join
  }

  async promptRoomCode(): Promise<string> {
    const { roomCode } = await inquirer.prompt({
      type: 'input',
      name: 'roomCode',
      message: 'Enter room code:',
      validate: (input: string) => {
        return input.trim().length > 0 ? true : 'Room code required'
      },
      filter: (input: string) => input.trim().toUpperCase(),
    })
    return roomCode
  }

  async promptPlayerCredentials(): Promise<{ name: string; password: string }> {
    const { name, password } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter your name:',
        validate: (input: string) => {
          return input.trim().length > 0 ? true : 'Name required'
        },
      },
      {
        type: 'input',
        name: 'password',
        message: 'Enter game password:',
        validate: (input: string) => {
          return input.length >= 4 ? true : 'Password must be at least 4 characters'
        },
      },
    ])
    return { name, password }
  }

  async tableViewOptions(): Promise<'refresh' | 'toggle' | 'quit'> {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'Options',
      choices: [
        { name: 'Refresh', value: 'refresh' },
        { name: 'Toggle auto-refresh (every 2s)', value: 'toggle' },
        { name: 'Quit', value: 'quit' },
      ],
    })
    return action
  }

  async gameCommand(): Promise<string> {
    const { command } = await inquirer.prompt({
      type: 'input',
      name: 'command',
      message: '',
      prefix: '>',
    })
    return command
  }
}
