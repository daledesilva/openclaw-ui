# Architecture & Design Decisions

This document outlines the key architectural choices made for the `openclaw-ui` project.

## 1. Core Framework: Vite + React + TypeScript

- **Vite:** Chosen for its extremely fast Hot Module Replacement (HMR) and build speeds, providing a superior development experience compared to traditional bundlers like Webpack.
- **React:** The industry standard for building dynamic, component-based user interfaces.
- **TypeScript:** Ensures type safety, which significantly reduces runtime errors and improves code maintainability, especially as the project grows.

## 2. Progressive Web App (PWA)

- **`vite-plugin-pwa`:** This plugin was chosen to easily add PWA capabilities.
- **Rationale:** Making the UI a PWA allows for app-like installation on desktops and mobile devices, provides offline accessibility for cached assets, and offers a more native-feeling experience for the user.

## 3. Styling: Emotion (CSS-in-JS) & No Tailwind

- **Emotion:** A powerful CSS-in-JS library that allows for styling components with JavaScript. This approach co-locates styles with the components, making them more modular, reusable, and dynamically themeable.
- **Rationale:** We explicitly avoided utility-class frameworks like Tailwind CSS to favor a more structured, component-centric styling architecture. This prevents HTML bloat and makes it easier to manage complex styling logic and theming.

## 4. Component Library: Material UI (MUI)

- **MUI:** A comprehensive library of robust and well-tested React components that follow Material Design principles.
- **Rationale:** Using a mature library like MUI dramatically accelerates UI development. It provides a solid foundation for common UI elements like buttons, inputs, and layout structures, which we can then customize.

## 5. Pattern: Custom Component Wrappers

- **Atoms:** Shared styled shells used by multiple feature components live under `src/components/atoms/` (e.g. `ChatBubblePaper` for user and agent chat bubbles).
- **Strategy:** Every MUI component used in the application is wrapped within a custom component (e.g., `UserChatBubble.tsx`, `AgentChatBubble.tsx`, `MessageInput.tsx`).
- **Rationale:** This is the most critical architectural decision for long-term maintainability.
  - **Mass Customization:** It creates a single point of control for styling and behavior. If we need to change how all chat bubbles look, we only edit one file.
  - **Decoupling:** It decouples our application from MUI's specific API. If we were to ever switch component libraries, we would only need to update our wrapper components, not every instance of a component throughout the app.
  - **Consistency:** It ensures a consistent look, feel, and behavior for UI elements across the entire application.
