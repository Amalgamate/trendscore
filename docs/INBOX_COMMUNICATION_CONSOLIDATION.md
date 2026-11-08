# Inbox and school communication consolidation

## User-facing model

Inbox is the shared school communication page for Admin, Teacher, Student, and Parent. It combines private conversations with school announcements, and provides search, unread and archived views, pin, mute, mark unread, archive, restore, and new-message actions. The same inbox route is used by the parent portal and school communication menu.

The TrendSCORE Assistant is a separate help agent. It is not a person-to-person chat and does not create school conversations. Parents open it from the persistent Assistant action beside Inbox; other roles can open it from the global assistant launcher.

## Who can contact whom

| Sender | Approved direct recipients |
| --- | --- |
| Admin, Head Teacher, Deputy Head Teacher, Super Admin | Active users in the current school environment; Super Admin accounts are excluded as recipients |
| Teacher | School colleagues and parents or family-account users linked to learners in the teacher's assigned classes |
| Parent | Their child's assigned teachers and designated school office contacts |
| Student | Their assigned teachers, their own parent, and designated school office contacts |
| Other school staff | School colleagues only for now |

Recipient search is a convenience, not the security boundary. The server validates new direct conversations and existing conversation access, and the socket handler checks access before joining a live conversation room. Multi-person groups stay staff-only. The school deployment cannot start or continue a parent-to-student direct conversation.

## Existing storage and delivery paths

The interface is now one Inbox, while the existing records retain their distinct purposes:

1. `Conversation` and `ChatMessage` store private two-way conversations and their read cursors.
2. `Message` and `MessageReceipt` store school announcements and delivery/read state; they appear in Inbox as announcements.
3. `SupportTicket` and `SupportMessage` stay in product support. They are not school inbox conversations.
4. TrendSCORE Assistant history remains AI session data and is not included as a conversation.

In-app is the shared Inbox experience. SMS, WhatsApp, and email remain outbound delivery channels for school notices; web push and Socket.IO are notification/realtime transports. An incoming SMS callback exists separately and is not an inbox conversation. These delivery channels do not create extra parent-to-student messaging routes.

## Rollout notes

The inbox preference migration must be applied before archiving or pinning is used in an environment. Existing chat panels and support pages still exist as code paths, but the role navigation now routes school messages to the consolidated Inbox. This change does not merge historical announcement rows into chat rows or move support conversations into the school inbox.
