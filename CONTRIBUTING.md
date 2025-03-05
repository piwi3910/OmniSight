# Contributing to OmniSight

Thank you for your interest in contributing to OmniSight! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others.

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Docker and Docker Compose
- PostgreSQL (for local development without Docker)
- Git

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```
   git clone https://github.com/piwi3910/OmniSight.git
   cd OmniSight
   ```

3. Install dependencies for all services:
   ```
   ./scripts/install-all.sh
   ```

4. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your own values if needed.

5. Start the development environment:
   ```
   docker-compose up -d
   ```

## Project Structure

OmniSight follows a microservices architecture:

- `services/stream-ingestion`: Handles multi-protocol camera stream connections
- `services/recording`: Manages video recording and storage
- `services/object-detection`: Processes video frames for detection with hardware acceleration
- `services/metadata-events`: Stores and manages metadata and events
- `services/api-gateway`: Unified entry point for frontend and external integrations
- `services/frontend`: React-based UI
- `shared/camera-protocols`: Protocol abstraction layer
- `shared/hardware-acceleration`: Hardware acceleration framework

## Development Workflow

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `bugfix/*`: Bug fix branches
- `release/*`: Release preparation branches

### Creating a New Feature

1. Create a new branch from `develop`:
   ```
   git checkout develop
   git pull
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, following the coding standards
3. Write tests for your changes
4. Run tests to ensure they pass
5. Commit your changes with descriptive commit messages
6. Push your branch to your fork
7. Create a pull request to the `develop` branch

### Commit Message Guidelines

Follow the conventional commits specification:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to the build process or auxiliary tools

Example: `feat(recording): add support for MP4 segmentation`

## Pull Request Process

1. Update the README.md or documentation with details of changes if needed
2. Update the version numbers in package.json files following semantic versioning
3. The PR will be merged once it receives approval from maintainers

## Coding Standards

### TypeScript

- Follow the TypeScript best practices
- Use interfaces for object shapes
- Use proper typing, avoid `any` when possible
- Use async/await for asynchronous code

### React

- Use functional components with hooks
- Use TypeScript for component props
- Follow the React best practices

### API Design

- Follow RESTful principles
- Use proper HTTP methods and status codes
- Document APIs using OpenAPI/Swagger

## Testing

- Write unit tests for all new code
- Ensure all tests pass before submitting a PR
- Aim for good test coverage

## Documentation

- Update documentation when adding or changing features
- Document APIs, configurations, and important concepts
- Use clear and concise language

## Maintainers

This project is maintained by:
- Pascal Watteel
- Email: Pascal@watteel.com
- GitHub: [https://github.com/piwi3910](https://github.com/piwi3910)

## Questions?

If you have any questions or need help, please open an issue on the [GitHub repository](https://github.com/piwi3910/OmniSight) or contact the maintainer directly at Pascal@watteel.com.

Thank you for contributing to OmniSight!