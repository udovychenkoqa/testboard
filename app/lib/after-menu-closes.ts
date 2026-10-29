// With HeroUI animations off, a menu item's press closes the menu and mounts whatever it opens (a modal) in the
// same tick, so the rest of that click lands on the new modal's backdrop and closes it at once. Run the
// action after the click has finished instead.
export const afterMenuCloses = (action: () => void): void => {
  setTimeout(action, 0);
};
