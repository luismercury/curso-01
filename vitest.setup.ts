/**
 * jsdom project setup — loads @testing-library/jest-dom matchers
 * (toBeInTheDocument, toHaveTextContent, etc.) for RTL component tests
 * under the route-segment _components folders.
 *
 * INV-03 / INV-08: this setup imports only the jest-dom matchers, never
 * the HTTP helper or the server-only service. Tests in the node project
 * run server-side without this file.
 */
import "@testing-library/jest-dom/vitest";