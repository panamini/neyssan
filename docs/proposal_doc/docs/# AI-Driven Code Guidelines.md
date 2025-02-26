# AI-Driven Code Guidelines

## 1. Code Style & Structure
- **Use TypeScript** for all code; favor interfaces over types.
- **Prefer functional programming** and avoid class-based components.
- **Structure files properly**: main exported component, subcomponents, helpers, static content, types.
- **Follow DRY and SOLID principles** to avoid duplication.
- **Use named exports** for components.

## 2. Naming Conventions
- Use **lowercase with dashes** for directories (e.g., `components/auth-wizard`).
- Use **descriptive variable names** with auxiliary verbs (`isLoading`, `hasError`).
- Follow **consistent naming conventions** across components, hooks, and utility functions.

## 3. TypeScript & Type Safety
- Use **strict TypeScript configurations**.
- Define **comprehensive interfaces** for blockchain and UI data.
- Avoid enums; use **maps instead**.
- Use **Zod** for runtime type validation.
- Ensure **proper error handling** for Web3 interactions.

## 4. Syntax & Formatting
- Use the **function keyword** for pure functions.
- Avoid unnecessary **curly braces** in simple conditionals.
- Use **declarative JSX** to improve readability.

## 5. UI & Styling
- Use **Shadcn UI, Radix UI, and TailwindCSS** for styling.
- Use **Framer motion, Postcss** for animation.

- Implement **mobile-first design** and dark/light mode support.
- Use **CSS variables** for theme consistency.

## 6. Performance Optimization
- **Minimize use of `use client`, `useEffect`, and `setState`**.
- Favor **React Server Components (RSC)** when possible.
- Wrap **client components in Suspense** with fallbacks.
- Use **dynamic imports** for non-critical components.
- Optimize images: **WebP format, include size data, and lazy loading**.

## 7. Web3 Development Standards
- Handle **wallet connection states** correctly.
- Implement **proper transaction feedback**.
- Consider **gas optimization strategies**.
- Ensure proper **network switching handling**.
- Use **React Query for data fetching**.

## 8. Best Practices
- **Follow Next.js docs** for Data Fetching, Rendering, and Routing.
- Optimize **Web Vitals (LCP, CLS, FID)**.
- Use **absolute imports** and proper folder structures.
- Implement **proper SEO** practices.
- Follow **security best practices** for Web3 and Next.js.
- Use **environment variables** correctly.

## 9. React Code Optimization
### Unnecessary Rerenders
- **Minimize state changes high in the tree** to prevent excessive rerenders.
- **Use React.memo** for components that don’t change frequently.
- **Stabilize objects and functions** using `useMemo` and `useCallback`.
- Avoid passing **inline objects/arrays/functions** as props.

### Context Usage
- Prevent **unnecessary context re-renders** by structuring contexts granularly.
- Use **lifting state up** or **direct prop passing** where applicable.

### Virtual DOM & Reconciliation
- **Understand the difference** between React rerendering and actual DOM updates.
- Ensure **minimal virtual DOM diffing** by keeping component structures efficient.

## 10. AI-Driven Code Review Standards
### Priority Levels
- 🚨 **Critical Security Issues** (e.g., SQL Injection, XSS, Hardcoded Secrets)
- ⚠️ **High Priority** (Performance Antipatterns, Resource Leaks, Error Handling)
- 🔍 **Medium Priority** (Code Smells, Maintainability Issues, Documentation Gaps)
- ℹ️ **Low Priority** (Style Violations, Test Coverage, Deprecation Warnings)

### Security Patterns
```javascript
// BAD: SQL injection vulnerable
db.query(`SELECT * FROM users WHERE id = ${userInput}`);

// GOOD: Parameterized query
db.query('SELECT * FROM users WHERE id = $1', [userInput]);
```

### Performance Patterns
```javascript
// BAD: N+1 query problem
for (const user of users) {
  console.log(await getUserProfile(user.id));
}

// GOOD: Batch fetch
const profiles = await getUserProfiles(users.map(user => user.id));
profiles.forEach(profile => console.log(profile));
```

### Review Output Format
```markdown
[Severity]: {🚨|⚠️|🔍|ℹ️} {CWE-XXX} {OWASP-YYY}
[Category]: Security/Performance/Maintainability
[Confidence]: High/Medium/Low (90% pattern match)
[Location]: File:Line (src/app.js:42)

**Problem**: Missing validation for input sanitization.
**Impact**: Potential security vulnerability (XSS or SQL Injection).
**Remediation**: Implement proper input sanitization using a validation library.
**Context**: Ensure all user-generated content is properly escaped.
```

This guideline ensures structured, efficient, and high-quality AI-assisted coding and reviews.

