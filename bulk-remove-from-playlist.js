// Paste into the browser console on a YouTube playlist page.
// Removes every video from the playlist, top-down.
(async function () {
  const REMOVE_DELAY = 1500;
  const MENU_OPEN_DELAY = 400;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const findFirstVideo = () => {
    const videos = document.querySelectorAll('ytd-playlist-video-renderer');
    for (const video of videos) {
      const btn = video.querySelector('button[aria-label="More actions"]');
      if (btn) return { video, btn };
    }
    return null;
  };

  const findRemoveMenuItem = () => {
    const items = document.querySelectorAll('yt-list-item-view-model[role="menuitem"]');
    for (const item of items) {
      const title = item.querySelector('.ytListItemViewModelTitle');
      if (title && title.textContent.trim().toLowerCase().startsWith('remove from')) {
        return item.querySelector('button') || item;
      }
    }
    return null;
  };

  const closeMenu = () => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  };

  let removed = 0;
  while (true) {
    const found = findFirstVideo();
    if (!found) {
      console.log(`Done. Removed ${removed} video(s).`);
      return;
    }

    const title =
      found.video.querySelector('#video-title')?.textContent?.trim() ||
      '(unknown title)';

    found.btn.click();
    await wait(MENU_OPEN_DELAY);

    const removeBtn = findRemoveMenuItem();
    if (!removeBtn) {
      console.warn(
        `Remove menu item not found after opening menu for: ${title}. Stopping.`,
      );
      closeMenu();
      return;
    }

    removeBtn.click();
    removed++;
    console.log(`Removed (${removed}): ${title}`);
    await wait(REMOVE_DELAY);
  }
})();
