const Bot = require('yamdbf').Bot;
const config = require('./config.json');
const path = require('path');
const ModActions = require('./lib/ModActions').default;

const bot = new Bot({
	name: 'YAMDBF Mod',
	token: config.token,
	config: config,
	selfbot: false,
	version: '1.0.0',
	statusText: 'Obey the law.',
	commandsDir: path.join(__dirname, 'commands'),
	disableBase: [
		'disablegroup',
		'enablegroup',
		'listgroups',
		'version'
	]
}).start();

bot.mod = new ModActions(bot);
bot.setDefaultSetting('prefix', '?');
bot.setDefaultSetting('cases', 0);
bot.removeDefaultSetting('disabledGroups');