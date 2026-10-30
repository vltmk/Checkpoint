// Shared motion tokens. Checkpoint is a dense utility, so motion stays crisp: a strong ease-out for anything that
// appears, short durations, and no bounce. Use these instead of hand-typed curves so every surface moves alike.

/** Strong ease-out for UI entering or leaving (starts fast, settles gently). */
export const EASE_OUT = [0.23, 1, 0.32, 1];

/** Popovers, selects, tooltips, menus. */
export const POPOVER = { duration: 0.12, ease: EASE_OUT };

/** Dialogs and sheets. */
export const DIALOG = { duration: 0.16, ease: EASE_OUT };

/** Scrims behind dialogs and drawers. */
export const SCRIM = { duration: 0.12, ease: EASE_OUT };

/** Side drawers (notification center, calculator). */
export const DRAWER = { type: 'spring', duration: 0.35, bounce: 0 };

/** The sliding pill in segmented controls and the theme switch. */
export const SPRING_PILL = { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 };

/** Screen changes inside the app frame: opacity only, short, because tab switching is frequent. */
export const SCREEN = { duration: 0.12, ease: EASE_OUT };

/** A screen arriving: slightly longer than SCREEN so the small rise reads, still under 200ms. */
export const SCREEN_ENTER = { duration: 0.18, ease: EASE_OUT };

/** A list row appearing or leaving: it grows open or folds shut, and the rows below follow. */
export const ROW = { duration: 0.2, ease: EASE_OUT };
