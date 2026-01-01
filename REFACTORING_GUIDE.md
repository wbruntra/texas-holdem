# PlayerView Refactoring Documentation

## Overview

The `PlayerView` component has been refactored to separate **business logic** from **presentation**. This makes the codebase more maintainable, testable, and easier to modify in the future.

## Architecture

### Layer 1: Data & Logic (`usePlayerGameLogic` hook)

**File:** `frontend/src/hooks/usePlayerGameLogic.ts`

This custom hook encapsulates all data-fetching and state management logic:

- WebSocket connection and fallback polling
- Game state management
- Player authentication and join logic
- Action handlers (fold, check, bet, call, raise, etc.)
- Valid actions calculation
- Local storage management
- Error handling

**Key responsibilities:**

- Communicating with the backend API
- Managing WebSocket/polling connection lifecycle
- Maintaining game state
- Providing handler functions for game actions

### Layer 2: Presentation (`PlayerViewDisplay` component)

**File:** `frontend/src/components/PlayerViewDisplay.tsx`

This component is **pure presentation** - it receives all data and callbacks as props and renders the UI. It has no API calls, no state management, and no side effects.

**Key responsibilities:**

- Rendering the UI based on props
- Calling event handlers when user interacts
- No business logic

### Layer 3: Controller (`PlayerView` page component)

**File:** `frontend/src/pages/PlayerView.tsx`

This is a thin orchestration layer that:

- Gets the route parameter (`roomCode`)
- Manages local UI state (player name, password, joined status)
- Calls the `usePlayerGameLogic` hook
- Maps hook data to the display component props
- Handles the join workflow

## Styling

### Styles Module

**File:** `frontend/src/styles/playerViewStyles.ts`

All style objects are exported from a single module:

- `buttonBaseStyle` - Common button properties
- `buttonStyles` - Color variants (primary, danger, bet, raise, etc.)
- `containerStyles` - Layout containers
- `cardStyles` - Card styling
- `inputStyles` - Form input styling
- `errorStyles` - Error message styling

This allows easy theming and consistent styling across the component.

### Slider Styles

**File:** `frontend/src/styles/sliderStyles.ts`

Static slider CSS is exported as a string constant, while dynamic colors are injected via inline styles in the component.

## Data Flow

```
PlayerView (page)
  ├─ usePlayerGameLogic (hook) ──── manages all logic/state
  │  ├─ WebSocket connection
  │  ├─ API calls
  │  └─ State management
  └─ PlayerViewDisplay (component) ──── pure presentation
     ├─ HorizontalSlider (component)
     └─ renders UI with callbacks
```

## Benefits

### 1. **Easier Testing**

- Can test logic hook independently
- Can test presentation component with mock props
- No need to mock WebSocket in display tests

### 2. **Better Maintenance**

- Logic changes don't affect presentation
- UI tweaks don't require touching business logic
- Easy to find where specific functionality lives

### 3. **Reusability**

- Can reuse `usePlayerGameLogic` hook with different UI components
- Can use `PlayerViewDisplay` with different data sources
- Display component could be used in desktop app, mobile, etc.

### 4. **Styling**

- All styles in one place for easy theming
- Can swap style files for different themes
- No inline styles scattered throughout JSX

### 5. **Future Enhancements**

- Easy to add caching layer to hook
- Easy to add analytics/logging
- Easy to add new displays or variations
- Easy to migrate to state management library (Redux, Zustand, etc.)

## File Structure

```
frontend/src/
├── hooks/
│   └── usePlayerGameLogic.ts    (logic & data fetching)
├── components/
│   ├── PlayerViewDisplay.tsx    (pure presentation)
│   └── HorizontalSlider.tsx     (presentational)
├── pages/
│   └── PlayerView.tsx           (orchestration)
└── styles/
    ├── playerViewStyles.ts      (styling objects)
    └── sliderStyles.ts          (slider CSS)
```

## Making Future Changes

### To change game logic:

1. Edit `usePlayerGameLogic.ts`
2. Add/modify hook return values
3. Update `PlayerView.tsx` to use new values
4. Update display component props as needed

### To change UI styling:

1. Edit `playerViewStyles.ts` or `sliderStyles.ts`
2. Import and apply styles in `PlayerViewDisplay.tsx`
3. No other files need to change

### To change UI layout/markup:

1. Edit `PlayerViewDisplay.tsx`
2. Receive any new data via props
3. No changes to logic needed

### To add a new feature:

1. Add logic to `usePlayerGameLogic.ts`
2. Add state/handlers to hook return
3. Pass to `PlayerViewDisplay` as props
4. Render in `PlayerViewDisplay.tsx`

## Next Steps for Further Refactoring

1. **Convert styles to CSS modules** - Move `playerViewStyles.ts` exports to actual `.module.css` files
2. **Move slider CSS to file** - Convert `sliderStyles.ts` to a `.css` file
3. **Extract sub-components** - Split `PlayerViewDisplay` into smaller components (ShowdownSection, ActionButtons, etc.)
4. **Add state management** - Consider Zustand or Redux if complexity grows
5. **Add type safety** - Create dedicated types file for all interfaces
