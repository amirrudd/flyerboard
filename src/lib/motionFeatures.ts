// Async feature bundle for framer-motion's <LazyMotion>. Keeps the full
// domMax feature set (layout/layoutId/drag are used across ~14 call sites)
// out of the eager entry chunk — App.tsx loads this via dynamic import.
export { domMax as default } from "framer-motion";
