/** Match the layout used by a landscape touch tablet, including an attached mouse. */
export const TABLET_WORKSPACE_QUERY = '(any-pointer: coarse) and (min-width: 900px) and (orientation: landscape)';
export const isTabletWorkspace = () => window.matchMedia(TABLET_WORKSPACE_QUERY).matches;
