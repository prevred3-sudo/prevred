# Security Specification — PrevRiesgos PRL Firestore Rules

## 1. Data Invariants
1. Every document in `/incidents/{incidentId}` must have `reporterUid == request.auth.uid` on creation, verified email (`request.auth.token.email_verified == true`), and `createdAt == request.time`, `updatedAt == request.time`.
2. `reporterUid` and `createdAt` are immutable after creation.
3. Terminal status locking: Once an incident has `status == 'Cerrado'`, non-admin users cannot update it. Only an admin (`prevred3@gmail.com` verified or listed in `/admins/{uid}`) can modify or reopen a closed incident or delete any incident.
4. Only verified authenticated users can trigger an SOS alert in `/emergencies/{emergencyId}` (`triggeredByUid == request.auth.uid`), and only admins can clear/dismiss an active emergency (`active == false`).
5. No user can self-assign admin privileges in `/admins/{userId}`.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read or write to `/incidents/inc-1` (`request.auth == null`).
2. Unverified email write to `/incidents/inc-1` (`email_verified == false`).
3. Spoofed `reporterUid` on create (`reporterUid != request.auth.uid`).
4. Shadow/ghost field injection on create (`{ ..., isAdmin: true }`).
5. Oversized ID poisoning (`/incidents/${'a'.repeat(200)}`).
6. Invalid ID characters (`/incidents/bad$id`).
7. Oversized `title` (`title.size() > 300`) or `description` (`description.size() > 2000`).
8. Unbounded `correctiveActions` array (`correctiveActions.size() > 25`).
9. Client-spoofed `createdAt` timestamp (`createdAt != request.time`).
10. Non-admin updating `status` or `severity` on another user's incident.
11. Non-admin modifying an incident already in terminal state `status == 'Cerrado'`.
12. Non-admin attempting to write to `/admins/{uid}` or delete an incident.
