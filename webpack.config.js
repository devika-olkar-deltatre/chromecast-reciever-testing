const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { DefinePlugin, BannerPlugin, Compilation } = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const pkg = require("./package.json");
const fs = require("fs");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

module.exports = (env, argv) => {
	const isProduction = argv.mode === "production";
	const includeOsDebugger = env && env.osdebugger === "true";

	return {
		mode: isProduction ? "production" : "development",
		entry: {
			diva: [
			'./src/plugins/conviva.js',
			'./src/diva.js',
			'./src/sass/diva.scss',
			...(includeOsDebugger ? ['./src/osb/osdebugger.js'] : []),
			],
		},
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist"),
			publicPath: "./",
		},
		devtool: 'source-map',
		module: {
			rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
				loader: "babel-loader",
				options: {
					presets: ["@babel/preset-env"],
				},
				},
			},
			{
				test: /\.(png|jpg|gif|svg)$/,
				type: "asset/resource",
				generator: {
				filename: "img/[name][ext]",
				},
			},
			{
				test: /\.s?css$/,
				use: [
				MiniCssExtractPlugin.loader,
				{
					loader: "css-loader",
					options: {
					sourceMap: true,
					},
				},
				{
					loader: "postcss-loader",
					options: {
					sourceMap: true,
					},
				},
				{
					loader: "resolve-url-loader",
					options: {
					sourceMap: true,
					},
				},
				{
					loader: "sass-loader",
					options: {
					sourceMap: true,
					implementation: require("sass"),
					},
				},
				],
			},
			],
		},
		optimization: {
			minimize: true,
			minimizer: [new TerserPlugin()],
		},
		plugins: [
			new CleanWebpackPlugin({
			protectWebpackAssets: false,
			cleanAfterEveryBuildPatterns: ["*.LICENSE.txt"],
			}),
			new HtmlWebpackPlugin({
			templateContent: () => {
				let html = fs.readFileSync("./src/index-dist.html", "utf8")
				.replace("%%APP_VERSION%%", pkg.version);

				if (includeOsDebugger) {
					const osdScript = `
	<script>
	window.osdConfig = {
		preset: "chromecast",
		consoleFilter: ">>>"
	};
	</script>
					`;
					// Inject before closing </head>
					html = html.replace("</head>", `${osdScript}\n</head>`);
				}

				return html;
			},
			filename: "index.html",
			}),
			new CopyWebpackPlugin({
			patterns: [
				{ from: "src/img", to: "img" },
				{ from: "src/favicon.ico", to: "" },
				{ from: "src/lib/diva-html5-conviva-plugin.js", to: "lib" },
				{ from: "src/lib/shaka-player.compiled.js", to: "lib" },
				//{ from: "src/lib/shaka-player.compiled.map", to: "lib" },
			],
			}),
			new MiniCssExtractPlugin({
			filename: "diva.css",
			}),
			new DefinePlugin({
                APP_VERSION: JSON.stringify(pkg.version),
                DEBUG_ENABLED: process.env.DEBUG_ENABLED || false,
                CONVIVA_CUSTOMER_KEY: JSON.stringify(process.env.ROGERS_CONVIVA_CUSTOMER_KEY),
                CONVIVA_GATEWAY_URL: JSON.stringify(process.env.ROGERS_CONVIVA_GATEWAY_URL),
			}),
			new BannerPlugin({
			banner: () => {
				const headerContent = fs.readFileSync("src/diva_header.js", "utf8")
				.replace("%%APP_VERSION%%", pkg.version)
				.replace("%%BUILD_DATE%%", new Date().toISOString())
				.replace("%%DEBUG_ENABLED%%", process.env.DEBUG_ENABLED || false);
				return headerContent;
			},
			raw: true,
			entryOnly: true,
			include: /diva.js/,
			stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
			}),
		],
		devServer: {
			static: {
			directory: path.join(__dirname, "dist"),
			},
			compress: true,
			port: 8080,
			historyApiFallback: true,
		},
	};
};