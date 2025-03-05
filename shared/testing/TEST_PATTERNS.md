# OmniSight Testing Patterns Guide

This document provides standardized patterns and practices for writing tests across all OmniSight microservices.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [Directory Structure](#directory-structure)
4. [Naming Conventions](#naming-conventions)
5. [Test Setup](#test-setup)
6. [Mocking Strategies](#mocking-strategies)
7. [Controller Tests](#controller-tests)
8. [Service Tests](#service-tests)
9. [Model Tests](#model-tests)
10. [Middleware Tests](#middleware-tests)
11. [Integration Tests](#integration-tests)
12. [Code Coverage](#code-coverage)
13. [Best Practices](#best-practices)

## Testing Philosophy

The OmniSight testing approach is guided by the following principles:

- **Tests should provide confidence**, not just coverage.
- **Isolation** - Tests should be independent of each other.
- **Readability** - Tests should be clear and easy to understand.
- **Maintainability** - Tests should be easy to maintain as the codebase evolves.
- **Speed** - Tests should run quickly to provide fast feedback.
- **Reliability** - Tests should provide consistent results.

## Test Types

We organize tests into the following categories:

1. **Unit Tests**: Test isolated components with all dependencies mocked.
2. **Integration Tests**: Test the interaction between components.
3. **API Tests**: Test API endpoints from request to response.
4. **Performance Tests**: Test system performance under load.
5. **End-to-End Tests**: Test complete user flows.

## Directory Structure

Tests should be organized alongside the code they test:

```
src/
  controllers/
    __tests__/           # Unit tests for controllers
      userController.test.ts
    userController.ts
  services/
    __tests__/           # Unit tests for services
      userService.test.ts
    userService.ts
  models/
    __tests__/           # Unit tests for models
      User.test.ts
    User.ts
  __integration__/       # Integration tests
    user-flow.test.ts
```

For general test utilities:

```
src/
  test/
    setup.ts             # Jest setup file
    global-setup.ts      # Jest global setup
    global-teardown.ts   # Jest global teardown
    utils/               # Test utilities
      test-utils.ts
```

## Naming Conventions

- Test files should be named with the pattern: `{filename}.test.ts`
- Integration test files: `{feature}.integration.test.ts`
- Performance test files: `{feature}.perf.test.ts`
- Test function names should clearly describe what they test:
  - `it('should return 404 when user not found')`
  - `it('should create a new user when provided valid data')`

## Test Setup

Each service should have the following setup files:

- `jest.config.js` - Main Jest configuration
- `jest.integration.config.js` - Configuration for integration tests
- `src/test/setup.ts` - Runs before each test
- `src/test/global-setup.ts` - Runs once before all tests
- `src/test/global-teardown.ts` - Runs once after all tests

## Mocking Strategies

### External Dependencies

Always mock external dependencies:

```typescript
// Mock database
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      // ... other methods
    },
    // ... other models
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

// Mock message queue
jest.mock('amqplib', () => ({
  connect: jest.fn(() => ({
    createChannel: jest.fn(() => ({
      assertQueue: jest.fn(),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
    })),
    close: jest.fn(),
  })),
}));
```

### Internal Dependencies

Use Jest's mock functions for internal dependencies:

```typescript
// Mocking a service used by a controller
jest.mock('../../services/userService', () => ({
  findUsers: jest.fn(),
  createUser: jest.fn(),
  // ... other methods
}));
```

## Controller Tests

Controllers should be tested with mocked request/response objects and services:

```typescript
describe('UserController', () => {
  const mockRequest = (options = {}) => ({
    params: {},
    query: {},
    body: {},
    headers: {},
    ...options,
  });
  
  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('getUsers', () => {
    it('should return users when found', async () => {
      // Arrange
      const mockUsers = [{ id: '1', name: 'User 1' }];
      UserService.findUsers.mockResolvedValue(mockUsers);
      
      const req = mockRequest();
      const res = mockResponse();
      
      // Act
      await UserController.getUsers(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: mockUsers
      }));
    });
    
    it('should handle errors', async () => {
      // Arrange
      UserService.findUsers.mockRejectedValue(new Error('Test error'));
      
      const req = mockRequest();
      const res = mockResponse();
      
      // Act
      await UserController.getUsers(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
    });
  });
});
```

## Service Tests

Services should be tested with mocked repositories/models:

```typescript
describe('UserService', () => {
  describe('findUsers', () => {
    it('should return users when found', async () => {
      // Arrange
      const mockUsers = [{ id: '1', name: 'User 1' }];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      
      // Act
      const result = await UserService.findUsers();
      
      // Assert
      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
    
    it('should handle database errors', async () => {
      // Arrange
      prisma.user.findMany.mockRejectedValue(new Error('DB error'));
      
      // Act & Assert
      await expect(UserService.findUsers()).rejects.toThrow('DB error');
    });
  });
});
```

## Model Tests

Model tests should verify data validation, schema compliance, and any model methods:

```typescript
describe('User Model', () => {
  describe('validation', () => {
    it('should validate user data correctly', () => {
      // Test validation logic
    });
  });
  
  describe('methods', () => {
    it('should hash password before save', async () => {
      // Test password hashing
    });
  });
});
```

## Middleware Tests

Test middleware functions by creating mock req/res/next objects:

```typescript
describe('Auth Middleware', () => {
  it('should call next() when token is valid', () => {
    // Arrange
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = {};
    const next = jest.fn();
    
    // Mock JWT verification
    jwt.verify.mockReturnValue({ userId: '123' });
    
    // Act
    authMiddleware(req, res, next);
    
    // Assert
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: '123' });
  });
  
  it('should return 401 when token is invalid', () => {
    // Arrange
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    
    // Mock JWT verification to throw
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    
    // Act
    authMiddleware(req, res, next);
    
    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

## Integration Tests

Integration tests should test the flow between components:

```typescript
describe('User API Integration', () => {
  let app;
  let prisma;
  
  beforeAll(async () => {
    app = await setupApp();
    prisma = new PrismaClient();
    await prisma.$connect();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
    await closeApp(app);
  });
  
  beforeEach(async () => {
    // Clean database
    await prisma.user.deleteMany();
  });
  
  it('should create and retrieve a user', async () => {
    // Create user
    const createResponse = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' });
    
    expect(createResponse.status).toBe(201);
    const userId = createResponse.body.id;
    
    // Get created user
    const getResponse = await request(app)
      .get(`/api/users/${userId}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.name).toBe('Test User');
    expect(getResponse.body.email).toBe('test@example.com');
  });
});
```

## Code Coverage

We aim for high test coverage while prioritizing critical paths:

- Minimum coverage threshold: 80% overall
- Critical components: 90%+
- Edge cases and error handling must be covered

Run coverage reports with:

```bash
npm run test:coverage
```

## Best Practices

1. **Arrange-Act-Assert (AAA)** - Structure tests in three sections:
   - Arrange: Set up the test data and conditions
   - Act: Execute the code being tested
   - Assert: Verify the result

2. **One assertion per test** - Focus each test on a single behavior.

3. **Isolate tests** - Tests should not depend on each other or external state.

4. **Use descriptive test names** - Make it clear what's being tested and expected.

5. **Mock time** - Use `jest.useFakeTimers()` for testing time-dependent code.

6. **Test edge cases** - Include tests for error handling and boundary conditions.

7. **Avoid testing implementation details** - Focus on behavior, not implementation.

8. **Keep tests fast** - Slow tests discourage frequent testing.

9. **Use test factories** - Create helper functions to generate test data.

10. **Clean up after tests** - Reset any state modified by tests.