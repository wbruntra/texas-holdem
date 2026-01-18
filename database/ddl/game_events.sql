CREATE TABLE `game_events` (
  `id` integer not null primary key autoincrement,
  `game_id` integer not null,
  `hand_number` integer not null default '0',
  `sequence_number` integer not null,
  `event_type` varchar(255) not null,
  `player_id` integer,
  `payload` json not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  foreign key(`game_id`) references `games`(`id`) on delete CASCADE
)