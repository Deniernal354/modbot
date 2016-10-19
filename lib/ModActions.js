'use strict';

const Time = require('./Time');

exports.default = class ModActions
{
	constructor(bot)
	{
		this.bot = bot;
		this.mutedOverwrites = {
			SEND_MESSAGES: false,
			SEND_TTS_MESSAGES: false,
			EMBED_LINKS: false,
			ATTACH_FILES: false,
			SPEAK: false
		};

		this.bot.on('channelCreate', channel =>
		{
			if (!channel.guild) return;
			if (channel.type === 'text' && !channel.permissionsFor(this.bot.user.id).hasPermission('MANAGE_ROLES_OR_PERMISSIONS')) return;
			console.log(`Setting 'Muted' role permissions in channel: ${channel.guild.name}/${channel.name}`);
			channel.overwritePermissions(channel.guild.roles.find('name', 'Muted'), this.mutedOverwrites).catch(console.log);
		});

		this.bot.on('guildCreate', guild =>
		{
			guild.owner.sendMessage(`Hello! I'm here to help you with your server moderation needs! To get started, in a text channel on your server that I would have 'read messages' permissions, execute the command \`?init\`. I'll tell you when I'm done setting up my business on your server. From there, should you choose, you can change my command prefix using \`?setprefix <prefix>\` from within your server.\n\nUse \`?help\` from within a server text channel to see the commands available for server moderation.`);
		});

		// Check current mutes and unmute users if the mute has expired
		this.muteTimer = new Promise(() =>
		{
			setInterval(() =>
			{
				let storage = this.bot.storage;
				storage.nonConcurrentAccess('activeMutes', key =>
				{
					let activeMutes = storage.getItem(key);
					if (!activeMutes) return;
					Object.keys(activeMutes).forEach(user =>
					{
						if (activeMutes[user].length === 0)
						{
							delete activeMutes[user];
							return;
						}
						let oldMutes = activeMutes[user];
						let newMutes = activeMutes[user];
						oldMutes.forEach((mute, index) =>
						{
							if (!mute.duration) return;
							if (Time.difference(mute.duration, Time.now() - mute.timestamp).ms < 1)
							{
								console.log(`Removing expired mute for user '${mute.raw}'`);
								let guild = this.bot.guilds.get(mute.guild);
								newMutes.splice(index, 1);
								let member = guild.members.get(mute.user);
								if (!member) return;
								member.removeRole(guild.roles.find('name', 'Muted'));
								member.sendMessage(`Your mute on ${guild.name} has expired. You may now send messages.`);
							}
						});
						activeMutes[user] = newMutes;
					});
					storage.setItem(key, activeMutes);
				}).catch(console.log);
			}, 1 * 1000 * 60);
		});
	}

	initGuild(guild)
	{
		return Promise.resolve()
			.then(() =>
			{
				if (!guild.roles.find('name', 'Muted')) return guild.createRole({ name: 'Muted' });
				else return Promise.resolve();
			})
			.then(() =>
			{
				if (!guild.roles.find('name', 'Mod')) return guild.createRole({ name: 'Mod' });
				else return Promise.resolve();
			})
			.then(() =>
			{
				if (!guild.channels.find('name', 'mod-logs')) return guild.createChannel('mod-logs');
				else return Promise.resolve();
			})
			.then(() =>
			{
				if (!guild.channels.find('name', 'ban-appeals')) return guild.createChannel('ban-appeals');
				else return Promise.resolve();
			})
			.then(() =>
			{ // eslint-disable-line
				return guild.channels.find('name', 'mod-logs')
					.overwritePermissions(guild.roles.find('name', '@everyone'), { SEND_MESSAGES: false });
			})
			.then(() =>
			{ // eslint-disable-line
				return guild.channels.find('name', 'mod-logs')
					.overwritePermissions(guild.roles.find('name', 'YAMDBF Mod'), { SEND_MESSAGES: true });
			})
			.then(() =>
			{ // eslint-disable-line
				return guild.channels.find('name', 'ban-appeals')
					.overwritePermissions(guild.roles.find('name', '@everyone'), {
						SEND_MESSAGES: false,
						READ_MESSAGES: false
					});
			})
			.then(() =>
			{ // eslint-disable-line
				return guild.channels.find('name', 'ban-appeals')
					.overwritePermissions(guild.roles.find('name', 'Mod'), {
						SEND_MESSAGES: true,
						READ_MESSAGES: true
					});
			})
			.then(() =>
			{ // eslint-disable-line
				return guild.channels.find('name', 'ban-appeals')
					.overwritePermissions(guild.roles.find('name', 'YAMDBF Mod'), {
						SEND_MESSAGES: true,
						READ_MESSAGES: true
					});
			})
			.then(() =>
			{
				guild.channels.forEach(channel =>
				{
					if (!guild.roles.find('name', 'Muted')) return;
					if (!channel.permissionOverwrites.get(guild.roles.find('name', 'Muted').id)
						&& channel.permissionsFor(this.bot.user.id).hasPermission('MANAGE_ROLES_OR_PERMISSIONS'))
					{
						console.log(`Setting 'Muted' role permissions in channel: ${channel.guild.name}/${channel.name}`);
						channel.overwritePermissions(guild.roles.find('name', 'Muted'), this.mutedOverwrites);
					}
				});
			})
			.catch(console.log);
	}

	// Increment the number of times the given user has
	// received a given type of formal moderation action
	count(user, guild, type)
	{
		let storage = this.bot.guildStorages.get(guild);
		let count = storage.getItem(type);
		if (!count)
		{
			count = {};
			count[user.id || user] = 0;
		}
		count[user.id || user]++;
		storage.setItem(type, count);
	}

	// Post the moderation case to the mod-logs channel
	caseLog(user, guild, type, reason, issuer, duration)
	{
		let storage = this.bot.guildStorages.get(guild);
		let caseNum = storage.getSetting('cases') || 0;
		caseNum++;
		storage.setSetting('cases', caseNum);
		return guild.channels.find('name', 'mod-logs').sendMessage(``
			+ `**Case ${caseNum} | ${type}**\n`
			+ `\`Member:\` ${user} (${user.username}#${user.discriminator})\n`
			+ `${duration ? '\`Length:\` ' + duration + '\n' : ''}` // eslint-disable-line
			+ `\`Reason:\` ${reason}\n`
			+ `\`Issuer:\` ${issuer.username}#${issuer.discriminator}`
		);
	}

	warn(user, guild)
	{
		this.count(user, guild, 'warnings');
		return Promise.resolve(user);
	}

	mute(user, guild)
	{
		this.count(user, guild, 'mutes');
		let member = guild.members.get(user.id || user);
		return member.addRole(guild.roles.find('name', 'Muted'));
	}

	unmute(user, guild)
	{
		let member = guild.members.get(user.id || user);
		return member.removeRole(guild.roles.find('name', 'Muted'));
	}

	kick(user, guild)
	{
		// TODO: notify user of kick, give rejoin information
		this.count(user, guild, 'kicks');
		let member = guild.members.get(user.id || user);
		return member.kick();
	}

	ban(user, guild)
	{
		this.count(user, guild, 'bans');
		let member = guild.members.get(user.id || user);
		return guild.ban(member, 7);
	}

	unban(id, guild)
	{
		return guild.unban(id);
	}

	softBan(user, guild)
	{
		// TODO: notify user of kick, give rejoin information
		let member = guild.members.get(user.id || user);
		return guild.ban(member, 7).then(user = guild.unban(user.id));
	}
};