module.exports = {
  plugins: {
    // Tailwind v4 bundles Lightning CSS, which handles vendor prefixing and
    // @import — autoprefixer would be a redundant second pass.
    '@tailwindcss/postcss': {},
  },
};
