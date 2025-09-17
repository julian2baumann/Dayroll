import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('highlights the Daily Feed value proposition', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /everything new today/i,
      }),
    ).toBeInTheDocument()

    const toolingItems = screen.getAllByText(/Playwright|Vitest|ESLint/i)
    expect(toolingItems.length).toBeGreaterThanOrEqual(1)
  })
})
