module.exports = {
  proxy: "localhost:3000",
  files: [
    "views/**/*.ejs",
    "public/css/**/*.css",
    "public/js/**/*.js"
  ],
  ignored: [
    "public/uploads/**/*",
    "public/resources/**/*",
    "node_modules",
    "*.log"
  ],
  port: 3001,
  reloadOnRestart: true,
  notify: false
};