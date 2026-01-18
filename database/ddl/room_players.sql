CREATE TABLE `room_players` (
  `id` integer not null primary key autoincrement,
  `room_id` integer not null,
  `name` varchar(255) not null,
  `session_token` char(36) not null,
  `password_hash` varchar(255) not null,
  `connected` boolean not null default '1',
  `chips` integer not null default '1000',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime not null default CURRENT_TIMESTAMP,
  foreign key(`room_id`) references `rooms`(`id`) on delete CASCADE
)