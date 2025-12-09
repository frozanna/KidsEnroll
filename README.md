# KidsEnroll

## Project Description

KidsEnroll is a web application designed to streamline the management of extracurricular activities in preschools and kindergartens. It features two main panels:

- **Administrator Panel**: Allows management of class offerings, instructors, and user accounts.
- **Parent Panel**: Enables parents to browse available classes and enroll their children.

This digital solution replaces inefficient manual methods, providing a centralized platform to manage all activity enrollments.

## Tech Stack

- **Astro 5**: For building fast and efficient web pages with minimal JavaScript.
- **React 19**: Powers interactive components within the application.
- **TypeScript 5**: Provides static type checking and enhances development tooling.
- **Tailwind CSS 4**: Enables rapid and responsive design with utility-first styling.
- **Shadcn/ui**: Offers a collection of accessible React UI components.
- **Supabase**: Serves as the backend for authentication and database management.
- **Openrouter.ai**: Integrates with various AI models for extended functionalities.
 - **Vitest + Testing Library**: Provide a lightweight unit/integration testing setup for React components and utilities.
 - **Playwright**: Powers end-to-end tests in Chromium/Desktop Chrome.

## Getting Started Locally

### Prerequisites

- [Node.js](https://nodejs.org/) version specified in [`.nvmrc`](.nvmrc) (Node **22.14.0**)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**:
   ```sh
   git clone https://github.com/frozanna/KidsEnroll.git
   cd KidsEnroll
   ```
2. **Install dependencies**:
   ```sh
   npm install
   ```
3. **Start the development server**:
   ```sh
   npm run dev
   ```
4. **Build for production**:
   ```sh
   npm run build
   ```

## Available Scripts

The following npm scripts are available:

- **npm run dev**: Starts the Astro development server.
- **npm run build**: Builds the project for production deployment.
- **npm run preview**: Previews the production build locally.
- **npm run astro**: Accesses Astro CLI commands.
- **npm run lint**: Runs ESLint to analyze code quality.
- **npm run lint:fix**: Automatically fixes linting issues.
- **npm run format**: Formats the codebase with Prettier.
 - **npm run test** / **npm run test:unit**: Runs the unit test suite with Vitest.
 - **npm run test:watch**: Runs unit tests in watch mode during development.
 - **npm run test:e2e**: Runs Playwright end-to-end tests in headless mode.
 - **npm run test:e2e:ui**: Opens the Playwright UI to explore and run E2E tests.

## Project Scope

- **Administrator Panel**:
  - Predefined administrator account
  - Manage activities (add, edit, delete).
  - Assign and manage instructors.
  - Simulate email notifications for class changes.

- **Parent Panel**:
  - User registration and login.
  - Onboarding that requires adding at least one child profile.
  - Browse available classes with validations (e.g., enrollment limits).
  - Manage enrollments with cancellation policies (e.g., up to 24 hours before classes start).
  - Generate weekly cost reports in Excel format.

### Excluded from MVP (Planned Future Enhancements):

- Payment integrations and real-time scheduling tools.
- Advanced role management beyond basic parent and administrator roles.
- Detailed AI-based recommendations.

## Project Status

The project is currently in the MVP stage, focusing on delivering core functionalities with plans for future enhancements.

## License

This project is licensed under the MIT License.
