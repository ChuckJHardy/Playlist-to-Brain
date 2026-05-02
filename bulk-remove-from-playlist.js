// Paste into the browser console on a YouTube playlist page.
// Removes every video from the playlist, top-down. Stops on its own when empty.
(() => {
  let removed = 0;
  let emptyTicks = 0;

  const id = setInterval(() => {
    const video = document.getElementsByTagName('ytd-playlist-video-renderer')[0];
    if (!video) {
      if (++emptyTicks >= 3) {
        clearInterval(id);
        console.log(`Done. Removed ${removed} video(s).`);
      }
      return;
    }
    emptyTicks = 0;

    const title =
      video.querySelector('#video-title')?.textContent?.trim() ?? '(unknown title)';

    video.querySelector('#primary button')?.click();

    const matches = document.evaluate(
      '//span[contains(text(),"Remove from")]',
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );

    for (let i = 0; i < matches.snapshotLength; i++) {
      matches.snapshotItem(i).click();
    }

    if (matches.snapshotLength > 0) {
      console.log(`Removed (${++removed}): ${title}`);
    }
  }, 1000);

  console.log('bulk-remove started. Refresh the tab to stop early.');
})();
