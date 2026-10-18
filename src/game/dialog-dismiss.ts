/** Give static and dynamically created dialogs the same always-reachable exit. */
export function setupDialogDismissals(root: HTMLElement): () => void {
  const controller = new AbortController(), { signal } = controller;
  const bars = new Set<HTMLElement>();
  const registered = new WeakSet<HTMLDialogElement>();
  const install = (dialog: HTMLDialogElement) => {
    if (registered.has(dialog)) return;
    registered.add(dialog);
    const bar = document.createElement('div'); bar.className = 'dialog-dismiss-bar';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'dialog-dismiss-button';
    button.textContent = '×'; button.setAttribute('aria-label', 'ポップアップを閉じる');
    button.title = '閉じる（Esc）';
    const dismiss = () => {
      if (!dialog.open) return;
      // Honor the same cancel handlers as Escape; keep older browsers supported.
      if (typeof dialog.requestClose === 'function') dialog.requestClose();
      else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    };
    button.addEventListener('click', dismiss, { signal });
    bar.append(button); dialog.prepend(bar); bars.add(bar);
    dialog.classList.add('has-dismiss-controls');
    const outside = (event: MouseEvent) => {
      const bounds = dialog.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom;
    };
    let startedOutside = false;
    dialog.addEventListener('pointerdown', event => {
      startedOutside = event.isPrimary && event.button === 0 && event.target === dialog && outside(event);
    }, { signal });
    dialog.addEventListener('pointercancel', () => { startedOutside = false; }, { signal });
    dialog.addEventListener('click', event => {
      const dismissBackdrop = startedOutside && event.button === 0 && event.target === dialog && outside(event);
      startedOutside = false;
      if (dismissBackdrop) dismiss();
    }, { signal });
    dialog.addEventListener('close', () => { startedOutside = false; }, { signal });
    // Native autofocus may scroll a long dialog to a heading or selected control.
    // Always open at its beginning; leave docked chat and its message position alone.
    dialog.addEventListener('toggle', () => {
      if (!dialog.open || !dialog.matches(':modal')) return;
      dialog.scrollTop = 0;
      dialog.querySelectorAll<HTMLElement>('.dialog-scroll').forEach(body => { body.scrollTop = 0; });
    }, { signal });
  };
  const scan = (element: Element) => {
    if (element instanceof HTMLDialogElement) install(element);
    element.querySelectorAll<HTMLDialogElement>('dialog').forEach(install);
  };
  scan(root);
  // Chat and development controls append their dialogs after the map starts.
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) scan(node);
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => {
    observer.disconnect(); controller.abort();
    for (const bar of bars) { bar.parentElement?.classList.remove('has-dismiss-controls'); bar.remove(); }
  };
}
