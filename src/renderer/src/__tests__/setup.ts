import '@testing-library/jest-dom'

// Reset window.api before each test
beforeEach(() => {
  // Clean up any mock API between tests
  if (typeof window !== 'undefined') {
    delete (window as Record<string, unknown>).api
  }
})
