CREATE TABLE `showdown_history` (
  `id` integer not null primary key autoincrement,
  `game_id` integer not null,
  `hand_id` integer not null,
  `hand_number` integer not null,
  `community_cards` json null,
  `player_info` json null,
  `pot_breakdown` json null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime not null default CURRENT_TIMESTAMP,
  foreign key(`game_id`) references `games`(`id`) on delete CASCADE,
  foreign key(`hand_id`) references `hands`(`id`) on delete CASCADE
)