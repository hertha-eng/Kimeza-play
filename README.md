# Kimeza Play

Kimeza Play is a digital gaming and fellowship platform designed for Rotary and Rotaract clubs.

## Product direction

- One shared application for web, Android, iPhone and tablets.
- One shared Supabase backend and account system across devices.
- Platform-managed districts, zones and approved clubs.
- Friendly gameplay alongside separately authorised official competitions.
- Individual, Buddy Group, club, zone and district records.
- Explicit representation selection before a match can contribute to an organisation's leaderboard.
- Auditable scoring and membership history.

## Technology

- Expo and React Native
- Expo Router
- TypeScript
- Supabase Auth, PostgreSQL and Realtime
- GitHub for source control

## Repository structure

- `app/` — application routes and screens
- `src/lib/` — shared client integrations
- `supabase/migrations/` — version-controlled database schema

## Getting started

1. Install Node.js and a compatible npm version.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add the Supabase project URL and publishable key to `.env`.
5. Run `npx expo start`.

Never commit real environment files, passwords, Supabase secret keys or service-role keys.

## Current status

The initial cross-platform app shell and first database foundation migration are committed. Authentication screens, secure membership workflows, game rooms, competition administration and score-writing functions are being implemented in stages.