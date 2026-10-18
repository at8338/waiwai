// Small UI pictograms; accessible names live on their buttons.
const paths: Record<string, string> = {
  'mouse-move-toggle': '<path d="m5 2 15 10-8 2-3 8L5 2Z"/>',
  'office-focus-toggle': '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M9 9h6v6H9z"/>',
  'voice-toggle': '<path d="M3 16v-5a9 9 0 0 1 18 0v5M3 14h4v8H3zm14 0h4v8h-4"/>',
  'mic-toggle': '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11v2a7 7 0 0 0 14 0v-2m-7 9v4m-4 0h8"/>',
  'focus-personal-open': '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M18 4l1-1m1 5h2"/>',
  'chat-open': '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/>',
  'people-open': '<circle cx="9" cy="7" r="3"/><path d="M2 19v-2a7 7 0 0 1 12-5"/><circle cx="17" cy="16" r="4"/><path d="m20 19 3 3"/>',
  'daily-event-go': '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/>',
  'event-journal-open': '<path d="M4 3h16v18H4zM8 3v18M12 8h4m-4 4h4m-4 4h2"/>',
  'office-calendar-open': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m3 0h2m3 0h1M7 18h2m3 0h2"/>',
  'broadcast-open': '<path d="M3 9h5l11-5v15L8 15H3V9Zm5 6 2 6H6l-2-6m18-6v6"/>',
  'schedule-open': '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  'focus-furniture-toggle': '<path d="M2 9h20v4H2zM5 13v8m14-8v8M7 9V3h10v6M8 16h8"/>',
  'avatar-edit': '<path d="m8 3 4 3 4-3 6 5-4 4-2-2v11H8V10l-2 2-4-4 6-5Z"/>',
  'buddy-edit': '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 7V3m-2 0h4M1 11v5m22-5v5M8 16h8"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/>',
  'pokemon-journal-open': '<circle cx="12" cy="12" r="9"/><path d="M3 12h5m8 0h5"/><circle cx="12" cy="12" r="4"/>',
  'birthday-open': '<path d="M4 12h16v9H4zm0 4c3 3 5-3 8 0s5-3 8 0M8 12V8m8 4V8M8 5V3m8 2V3"/>',
  'focus-lost-open': '<path d="M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-6 5a2 2 0 1 1 3 2c-1 0-1 1-1 2m0 2v1"/>',
  'spells-open': '<path d="m4 20 12-12 4 4L8 24M6 2v6M3 5h6m11-4v4m-2-2h4m-2 15v4m-2-2h4"/>',
  'vehicle-open': '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-10 5 10H5Zm5-10h7l2 10M8 4h4m3-1h3l1 4"/>',
  'room-picker-open': '<path d="M3 21V3h18v18M9 21V6l8 2v13M2 21h20m-8-8v2"/>',
  'reset-position': '<path d="m8 5-5 5 5 5m-5-5h11a6 6 0 0 1 0 12h-3"/>',
  'help-button': '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3m0 3v1"/>',
  'admin-open': '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  'dev-world-open': '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
};
export function focusIcon(id: string): string {
  return `<svg viewBox="0 0 24 26" width="21" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] ?? paths['help-button']}</svg>`;
}
