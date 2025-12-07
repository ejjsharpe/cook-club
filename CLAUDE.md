# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cook Club is a social recipe sharing mobile application built as an Nx monorepo. The architecture consists of:

- **React Native mobile app** (Expo 54) for iOS/Android
- **Cloudflare Workers backend** (Hono + tRPC)
- **Shared packages** for database, tRPC, and recipe scraping
- **Package manager**: Bun 1.2.3
- **Monorepo tool**: Nx 22.1.1

## Development Commands

### Root-level Commands (runs across all workspaces)

```bash
bun run dev            # Start all dev servers
bun run build          # Build all workspaces
bun run lint           # Lint all workspaces
bun run test           # Test all workspaces
bun run check-types    # Type check all workspaces
bun run ios            # Run iOS simulator
bun run android        # Run Android emulator
```

### Native App (`apps/native/`)

```bash
cd apps/native
bun run dev            # Run iOS simulator
bun run start          # Start Expo dev server
bun run ios            # Run iOS
bun run android        # Run Android
bun run web            # Run Expo web
bun run lint           # Lint and check formatting
bun run format         # Auto-fix linting and formatting
bun run build:dev      # EAS development build
bun run build:preview  # EAS preview build
bun run build:prod     # EAS production build
```

### Server (`apps/server/`)

```bash
cd apps/server
bun run dev            # Start Wrangler dev server
bun run deploy         # Deploy to Cloudflare Workers
```

### Database (`packages/db/`)

```bash
cd packages/db
bun run generate       # Generate migrations from schema
bun run migrate        # Apply migrations
bun run push           # Push schema directly to database
bun run seed           # Seed database with sample data
```

## Architecture

### Monorepo Structure

```
apps/
  native/         # Expo React Native mobile app
  server/         # Cloudflare Workers backend (Hono + tRPC)
packages/
  db/             # Drizzle ORM schemas and database client
  trpc/           # tRPC routers, context, and client utilities
  recipe-scraper/ # Web scraping for recipe structured data
tooling/
  typescript/     # Shared TypeScript config
  eslint/         # Shared ESLint config
```

### Technology Stack

**Frontend (Native App)**:

- React Native 0.81.5 with Expo 54
- React 19.1.0
- TanStack React Query for server state management
- tRPC for type-safe API calls
- Better Auth for authentication
- React Navigation for routing
- React Native Unistyles for theming
- React Native Reanimated for animations
- MMKV for local storage
- Legend List for performant list rendering

**Backend**:

- Cloudflare Workers (Node.js compatible mode)
- Hono web framework
- tRPC server with HTTP adapter
- Better Auth for sessions and OAuth

**Database**:

- PostgreSQL via Neon (serverless)
- Drizzle ORM for schema and migrations
- Neon WebSocket driver for Cloudflare Workers (provides session and transaction support)

### Authentication Flow

1. Better Auth handles OAuth (Google, Facebook) and email/password sign-up
2. Session tokens stored in database (`session` table)
3. Mobile app sends auth cookies in request headers
4. Server middleware extracts session from headers
5. Context provides authenticated user to tRPC procedures

Authentication routes are handled at `/api/auth/*` on the server. The mobile app uses `@better-auth/expo` for client integration.

### tRPC Architecture

The tRPC router (`packages/trpc/src/server/index.ts`) aggregates feature-based routers:

- `user`: User queries (get current user)
- `recipe`: Recipe operations (scrape, create, list, detail, like, recommendations)
- `follows`: Follow/unfollow operations
- `collection`: Collection management (create, add/remove recipes)

**Procedure Types**:

- `publicProcedure`: No authentication required
- `authedProcedure`: Requires authenticated user in context

**Context** (`packages/trpc/src/server/context.ts`):
Provides each request with: `db`, `auth`, `user`, `env`, `request`

### Database Schema

Key tables (in `packages/db/schemas/`):

**Authentication** (`auth-schema.ts`):

- `user`: Core user data (id, email, name, image)
- `session`: Login sessions with tokens
- `account`: OAuth provider accounts
- `verification`: Email verification tokens

**Recipes** (`recipe-schema.ts`):

- `recipes`: Main recipe table (name, times, servings, nutrition, sourceUrl)
- `recipeImages`: 1-to-many images per recipe
- `recipeIngredients`: Ingredients with index ordering
- `recipeInstructions`: Steps with index ordering
- `collections`: User-created recipe collections
- `recipeCollections`: Join table for recipes in collections
- `userLikes`: User likes on recipes
- `tags`: Taxonomy (cuisine, meal_type, occasion)
- `recipeTags`: Join table for recipe categorization

**Social** (`follows-schema.ts`):

- `follows`: User-to-user follower relationships

All schemas use cascading deletes (`onDelete: 'cascade'`) and strategic indexes on frequently queried columns.

### State Management Patterns

- **Server State**: TanStack React Query with tRPC integration
  - Infinite queries for paginated lists (recommended recipes, user recipes)
  - Optimistic updates for likes (with rollback on error)
- **Authentication State**: Better Auth sessions + `SignedInContext` provider
- **Local Persistence**: MMKV for measurement preferences and other local data
- **Navigation State**: React Navigation with typed screen params

### API Patterns

**Recipe Scraping**:
The `recipe.scrapeRecipe` endpoint uses `@repo/recipe-scraper` to extract structured data from recipe URLs. It parses JSON-LD and Schema.org microdata.

**Pagination**:
Uses cursor-based pagination for infinite scroll. Key queries:

- `recipe.getRecommendedRecipes`: Paginated feed with tag/time/search filters
- `recipe.getUserRecipes`: User's recipes with search and pagination

**Validation**:
Uses Arktype for runtime validation on tRPC inputs/outputs.

## Key Development Notes

### Native App Structure (`apps/native/src/`)

- `screens/`: Main app screens (Home, Discover, MyRecipes, RecipeDetail, EditRecipe, etc.)
- `navigation/`: Stack and tab navigators
- `api/`: tRPC hooks organized by feature (auth, recipe, collection)
- `hooks/`: Custom hooks (useDebounce, useRecipeMeasurementConversion, useRecipeSave)
- `lib/`: Providers and utilities
  - `authClient.tsx`: Better Auth client setup
  - `trpc.tsx`: tRPC provider with HTTP batch link
  - `sessionContext.tsx`: Session state management
  - `reactQuery.tsx`: React Query provider
- `components/`: Reusable UI components
- `styles/`: Unistyles theme, colors, fonts
- `utils/`: Time formatting, measurement conversion

### Server Structure (`apps/server/src/`)

- `index.ts`: Main Hono app
  - tRPC endpoint: `/api/trpc/*`
  - Auth endpoint: `/api/auth/*`
  - Session middleware extracts user from request headers
- `lib/auth.ts`: Better Auth initialization
- `types.ts`: Environment variable types

### Working with the Database

**Database Connection**:
The database uses Neon's WebSocket driver (`drizzle-orm/neon-serverless`) for Cloudflare Workers compatibility. A new connection pool is created for each request in the tRPC context, as WebSocket connections cannot outlive a single request in serverless environments.

**Connection Flow**:

1. `getDb(env)` in `packages/db/index.ts` creates a new `Pool` instance
2. Pool is passed to Drizzle ORM with schema
3. Connection is established when first query is executed
4. Connection automatically closes when request completes

**Making Schema Changes**:

1. Edit schema files in `packages/db/schemas/`
2. Run `bun run generate` to create migration
3. Run `bun run migrate` to apply migration

**Direct Schema Push** (development only):

```bash
bun run push  # Pushes schema directly without migrations
```

**Seeding**:
The seed script creates sample users, recipes, tags, and relationships. The `DATABASE_URL` is hardcoded in the package.json seed script. Note: The seed script uses the HTTP driver since it runs in Node.js, not Cloudflare Workers.

### Nx Caching

Nx caches build, lint, and check-types tasks. Cache outputs are stored in `{projectRoot}/dist/**`. Dev tasks (`dev`, `start`) are not cached.

Build tasks depend on upstream builds (`dependsOn: ["^build"]`), ensuring packages are built before apps.

### Environment Variables

Server requires these environment variables (set in Wrangler secrets or `.dev.vars`):

- `DATABASE_URL`: Neon PostgreSQL connection string
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth
- `FB_CLIENT_ID`, `FB_CLIENT_SECRET`: Facebook OAuth
- `BETTER_AUTH_SECRET`: Auth session secret
- `BETTER_AUTH_URL`: Backend URL for auth callbacks

### Recipe Scraper

The `@repo/recipe-scraper` package (`packages/recipe-scraper/`) extracts recipe data from URLs by:

1. Fetching HTML with rotating user agents (iOS/Android)
2. Parsing JSON-LD and Schema.org microdata
3. Normalizing to a `ScrapedRecipe` format

Main function: `scrapeRecipe(url)` returns structured recipe data (name, ingredients, instructions, images, times, nutrition).

### Type Safety

End-to-end type safety via tRPC:

- Frontend gets fully typed API client
- Input/output types exported from `@repo/trpc/client`
- No need for separate API type definitions

### Working with tRPC

**Adding New Endpoints**:

1. Create/update router in `packages/trpc/src/server/routers/`
2. Add to root router in `packages/trpc/src/server/index.ts`
3. Use `publicProcedure` or `authedProcedure`
4. Mobile app automatically gets typed hooks

**Using in Native App**:

```typescript
import { useTRPC } from "@/lib/trpc";

const trpc = useTRPC();
const { data } = trpc.recipe.getRecipeDetail.useQuery({ id: recipeId });
```

### Deployment

**Mobile App**:
Uses EAS Build for iOS/Android builds:

- `bun run build:dev` - Development build
- `bun run build:preview` - Preview build
- `bun run build:prod` - Production build

**Server**:
Deploy to Cloudflare Workers:

```bash
cd apps/server
bun run deploy
```

Cloudflare account ID: `46fa47bc2bba51d75383b4dfe6e3deb1`
Compatibility date: `2025-02-20`

### Testing and Quality

Run across all workspaces from root:

```bash
bun run lint          # ESLint + Prettier checks
bun run check-types   # TypeScript type checking
bun run test          # Run all tests
```

For individual packages, navigate to the package directory and run the same commands.
