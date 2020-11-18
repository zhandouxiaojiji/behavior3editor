const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  entry: {
    "bundle": ["./render-process/index.tsx"],
    "main": ["./main-process/MainProcess.tsx"]
  },
  output: {
    filename: "[name].js",
    path: __dirname + "/dist"
  },

  devtool: "source-map",

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"]
  },

  module: {
    rules: [
      { test: /\.tsx?$/, loader: "ts-loader" },
      { test: /\.(jpe?g|png|gif|svg)$/i, loader: "file-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
      {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader']
      },
      {//https://github.com/ashtuchkin/iconv-lite/issues/205
        test: /node_modules[\/\\](iconv-lite)[\/\\].+/,
        resolve: {
          aliasFields: ['main']
        }
      }
    ]
  },

  plugins: [
  ],

  target: "electron-renderer",

  externals: [{
    'electron-reload': 'require("electron-reload")'
  }]
};