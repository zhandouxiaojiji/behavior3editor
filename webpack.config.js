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
      { test: /\.svg?$/, loader: "file-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
      {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader']
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