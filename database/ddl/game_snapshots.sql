CREATE TABLE `game_snapshots` (
  `id` integer not null primary key autoincrement,
  `game_id` integer not null,
  `hand_number` integer not null,
  `last_sequence_number` integer not null,
  `state` json not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  foreign key(`game_id`) references `games`(`id`) on delete CASCADE
)