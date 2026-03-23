---
trigger: always_on
---

# Frontend Discipline

- No business logic inside UI components. Extract logic to custom React Hooks.
- Separate UI components, state management, and API layers strictly.
- Components must be reusable and isolated.
- No direct coupling to backend internals. Access only via typed API services.
- Always use the recommended code and best practice paradigms.
- Always make it compatible with Dark and Light themes (`next-themes`, generic `cn` Tailwind variants).
- Always use `@tanstack/react-query` for API requests.
- Always use `zustand` for global state stores.
- Always split components to prevent long lines of code and keep files focused on single concerns.
