-- A passcode on a shared sequence, like a Stickies private share. NULL = no
-- passcode. passcode_hash is the scrypt hash the lock screen verifies against
-- (lib/passcode.ts); a visitor without the unlock cookie gets the lock screen
-- instead of the diagram.
--
-- The owner wants to SEE the current passcode in the app, and a hash cannot be
-- read back, so passcode_enc keeps an AES-256-GCM sealed copy under AUTH_SECRET,
-- opened only for the owner.
--
-- Additive and idempotent: every existing row stays NULL, so nothing changes
-- until the owner sets a passcode.

alter table public.sequences add column if not exists passcode_hash text;
alter table public.sequences add column if not exists passcode_enc text;
