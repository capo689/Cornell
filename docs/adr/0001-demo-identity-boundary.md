# ADR: Keep demo roles visibly separate from production identity

## Context

The portfolio demo needs to show coordinator and member workflows without requiring reviewers to create accounts. A role switch makes both perspectives immediately inspectable, but request headers supplied by a browser are not authentication.

## Decision

Use `x-demo-role` and `x-demo-user` only for the Level 0 local demo. Enforce coordinator mutations with a server-side guard to demonstrate the authorization seam, label the limitation in the repository, and prohibit real data. A public version must validate OIDC tokens and derive actor and role claims server-side.

## Alternatives considered

- Add a hosted identity provider now: more realistic, but adds setup friction and external state unrelated to the five-minute portfolio story.
- Make authorization UI-only: simpler, but misleading and unable to demonstrate backend enforcement.
- Ship static mock data: fastest, but would not demonstrate persistence, validation, transactions, or audit behavior.

## Consequences

Reviewers can test both roles instantly and observe server rejection of member mutations. The demo must not be presented as secure authentication and must remain local/synthetic until the replacement is implemented.

## Reversal plan

Add an OIDC strategy and token validation middleware, map immutable subject and role claims into the existing guard/audit boundary, remove browser-controlled actor headers, then add authentication, authorization, expiry, and ownership integration tests.
