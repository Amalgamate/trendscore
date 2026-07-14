# ENGINEERING-BIBLE-02-Coding-Standards.md

## Naming
- PascalCase: Components
- camelCase: Variables
- kebab-case: Files
- snake_case only where database conventions require it.

## TypeScript
- Strict mode enabled.
- Avoid any.
- Prefer interfaces for contracts.

## React
- Functional components only.
- Hooks before custom state libraries.
- Keep components focused.

## Prisma
- One model per business entity.
- No duplicated tables.
- Always create migrations.

## Logging
- Structured logs.
- Correlation IDs.
- No sensitive data.

## Testing
- Unit tests
- Integration tests
- End-to-end tests for critical journeys

## Documentation
Every new module requires:
- README
- API documentation
- Architecture notes
- Changelog
