# Jello Kanban (sse-jakoblangtry-com)

Jello Kanban is a web-based Kanban board application designed for task and project management. It allows users to create boards, organize tasks into columns and cards, and collaborate with others by sharing boards.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Development Server](#running-the-development-server)
  - [Building for Production](#building-for-production)
- [Database](#database)
- [Authentication](#authentication)
- [Styling](#styling)
- [Linting & Formatting](#linting--formatting)
- [Testing](#testing)
- [Scripts](#scripts)

## Overview

This project implements a feature-rich Kanban board application using Next.js, Prisma, and Tailwind CSS. It supports user authentication, board creation and management, drag-and-drop for cards and columns, and board sharing functionalities.

## Features

- User registration and authentication (NextAuth with email/password & potentially OAuth providers)
- Create, read, update, and delete boards
- Create, read, update, and delete columns within boards
- Create, read, update, and delete cards within columns
- Drag-and-drop functionality for reordering cards and columns (@dnd-kit)
- Assign properties to cards: title, description, labels, due dates, priority, assignees
- Board sharing with other registered users
- Email notifications for board invitations (Nodemailer)
- Responsive design for various screen sizes

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (v15+) with App Router
- **UI Library:** [React](https://react.dev/) (v19+)
- **Database ORM:** [Prisma](https://www.prisma.io/) (with MySQL)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [ShadCN UI](https://ui.shadcn.com/) (built on Radix UI primitives)
- **Drag & Drop:** [@dnd-kit](https://dndkit.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **State Management:** React Context API
- **Form Handling:** (Primarily custom with ShadCN components)
- **Notifications/Toasts:** [Sonner](https://sonner.emilkowal.ski/)
- **Email Service:** [Nodemailer](https://nodemailer.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Validation:** [Zod](https://zod.dev/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Environment Variables:** [@t3-oss/env-nextjs](https://env.t3.gg/)

## Project Structure

The project follows a standard Next.js application structure:

```
sse-jakoblangtry-com/
├── .cursor/            # Cursor AI related files (e.g., rules)
├── .next/              # Next.js build output (development)
├── out/                # Next.js build output (production, if `distDir` is '''out''')
├── prisma/             # Prisma schema, migrations, and seed scripts
│   └── schema.prisma   # Database schema definition
│   └── seed.ts         # Database seeding script
├── public/             # Static assets (images, fonts, etc.)
├── src/                # Main application source code
│   ├── app/            # Next.js App Router (pages, API routes, layouts)
│   │   ├── (main)/     # Main application routes and layouts
│   │   ├── api/        # API route handlers
│   │   └── auth/       # Authentication related pages (signin, register)
│   ├── components/     # Reusable UI components
│   │   ├── board/      # Components specific to the Kanban board
│   │   ├── layout/     # Layout components (e.g., Sidebar, Header)
│   │   └── ui/         # Base UI components (often from ShadCN)
│   ├── common/         # Common utilities or constants (review usage)
│   ├── constants/      # Application-wide constant values
│   ├── contexts/       # React Context API providers
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Core library functions (e.g., Prisma client, auth config, email utils)
│   ├── services/       # Business logic, data fetching, context (e.g., BoardContext)
│   ├── styles/         # Global styles (e.g., globals.css)
│   └── types/          # TypeScript type definitions
├── .env                # Environment variables (local, gitignored)
├── .env.example        # Example environment variables
├── .eslintrc.json      # ESLint configuration
├── next.config.js      # Next.js configuration
├── package.json        # Project metadata and dependencies
├── postcss.config.js   # PostCSS configuration (for Tailwind CSS)
├── prettier.config.js  # Prettier configuration
├── tailwind.config.ts  # Tailwind CSS configuration
└── tsconfig.json       # TypeScript configuration
```

- **`src/app/`**: Contains all routes, API endpoints, and UI for the Next.js App Router.
  - **`api/`**: Backend API logic.
  - **`auth/`**: Pages related to user authentication.
  - Other directories typically map to URL segments.
- **`src/components/`**: Shared React components used throughout the application.
  - **`ui/`**: Base UI elements, often wrappers around ShadCN UI components.
- **`src/lib/`**: Utility functions, Prisma client instantiation, NextAuth configuration.
- **`src/services/`**: Higher-level services, context providers (e.g., `BoardContext` for managing board state).
- **`src/hooks/`**: Custom React Hooks for reusable logic.
- **`prisma/`**: Contains `schema.prisma` defining the database models and a `seed.ts` for populating initial data.

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm, yarn, or pnpm
- A MySQL database instance

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd sse-jakoblangtry-com
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

### Environment Variables

1.  Create a `.env` file in the root of the project by copying `.env.example` (if it exists) or creating a new one.
2.  Populate the `.env` file with the necessary environment variables. Key variables include:
    *   `DB_URL`: Your MySQL database connection string (e.g., `mysql://user:password@host:port/database`)
    *   `NEXTAUTH_SECRET`: A secret key for NextAuth. Generate one using `openssl rand -hex 32`.
    *   `NEXTAUTH_URL`: The canonical URL of your application (e.g., `http://localhost:3000` for development).
    *   Email server variables (for Nodemailer, if configured for board sharing notifications):
        *   `EMAIL_SERVER_HOST`
        *   `EMAIL_SERVER_PORT`
        *   `EMAIL_USER`
        *   `EMAIL_PASSWORD`
        *   `EMAIL_FROM`

    Refer to `src/env.js` for a schema of expected environment variables if `@t3-oss/env-nextjs` is used.

3.  Generate Prisma Client:
    ```bash
    npx prisma generate
    ```
    (This is also run automatically via `postinstall` script after `npm install`)

4.  Push database schema changes:
    ```bash
    npx prisma db push
    ```
    This command synchronizes your database schema with `prisma/schema.prisma`. For production, consider using migrations (`prisma migrate dev` and `prisma migrate deploy`).

5.  (Optional) Seed the database with initial data:
    ```bash
    npm run seed
    ```

### Running the Development Server

```bash
npm run dev
```
The application will be available at `http://localhost:3000` (or the configured port). The `--turbo` flag is used for faster development builds with Turbopack.

### Building for Production

1.  Build the application:
    ```bash
    npm run build
    ```
    This will create an optimized production build in the `out/` directory (as configured in `next.config.js`).

2.  Start the production server:
    ```bash
    npm run start
    ```

## Database

This project uses [Prisma](https://www.prisma.io/) as its ORM to interact with a MySQL database.
- The database schema is defined in `prisma/schema.prisma`.
- To apply schema changes to your database during development, use:
  ```bash
  npx prisma db push
  ```
- For generating migrations in a development or production workflow:
  ```bash
  npx prisma migrate dev --name your-migration-name
  ```
- To apply pending migrations:
  ```bash
  npx prisma migrate deploy
  ```
- The `prisma/seed.ts` script can be used to populate the database with initial data using `npm run seed`.

## Authentication

User authentication is handled by [NextAuth.js](https://next-auth.js.org/), configured with the Prisma adapter to store user data and sessions in the database.
- Configuration can be found in `src/lib/auth/` or a similar path containing NextAuth options.
- Protected routes and API endpoints should use NextAuth's session management.

## Styling

Styling is managed with [Tailwind CSS](https://tailwindcss.com/).
- Configuration: `tailwind.config.ts` and `postcss.config.js`.
- Global styles: `src/styles/globals.css`.
- UI components are largely based on [ShadCN UI](https://ui.shadcn.com/), which provides accessible and customizable components built with Radix UI and Tailwind CSS.

## Linting & Formatting

- **ESLint:** For code linting. Configuration is in `.eslintrc.json`.
  - Run: `npm run lint`
  - Fix: `npm run lint:fix`
- **Prettier:** For code formatting.
  - Check: `npm run format:check`
  - Write: `npm run format:write`

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration testing.
- Run tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`

## Scripts

Key scripts from `package.json`:

- `npm run dev`: Starts the Next.js development server with Turbopack.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the Next.js production server.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run lint:fix`: Fixes linting errors automatically.
- `npm run format:check`: Checks code formatting with Prettier.
- `npm run format:write`: Formats code with Prettier.
- `npm run typecheck`: Performs TypeScript type checking.
- `npm run test`: Runs tests using Vitest.
- `npm run test:watch`: Runs tests in watch mode.
- `npm run seed`: Executes the Prisma seed script (`prisma/seed.ts`).
- `npm run check`: Runs both linting and type checking.
