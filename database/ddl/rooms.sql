CREATE TABLE `rooms` (
  `id` integer not null primary key autoincrement,
  `room_code` varchar(6) not null,
  `status` text check (`status` in ('waiting',
  'active',
  'closed')) not null default 'waiting',
  `small_blind` integer not null default '5',
  `big_blind` integer not null default '10',
  `starting_chips` integer not null default '1000',
  `current_game_id` integer null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime not null default CURRENT_TIMESTAMP
)