// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for documentation on Workbox modules.

// We need this in Webpack plugin (refer to 'webpack.config.js')
// to get the list of assets to precache.
self.__WB_MANIFEST;

// This is the code piece that GenerateSW mode produces in the service worker file.
self.addEventListener('install', (event) => {
  // Perform install steps.
  // For example, you can cache some assets.
});

self.addEventListener('fetch', (event) => {
  // You can add your own fetch handler here.
  // For example, to serve assets from the cache.
});
